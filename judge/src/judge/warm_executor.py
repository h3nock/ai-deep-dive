"""Warm fork executor for torch-heavy jobs.

This executor keeps a long-lived parent process that preloads torch and forks
per submission. Child processes execute untrusted code with resource limits and
exit after each job, so Python-level state never leaks back to the parent.
"""

from __future__ import annotations

import ctypes
import ctypes.util
import errno
import json
import os
import resource
import signal
import sys
import tempfile
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from judge.problems import Problem
from judge.runner import (
    HARNESS_CODE,
    IsolateConfig,
    _build_error_summary,
    _build_test_config,
    _sanitize_item,
    _summarize_results,
)

_THREAD_ENV_DEFAULTS = {
    "OMP_NUM_THREADS": "1",
    "MKL_NUM_THREADS": "1",
    "OPENBLAS_NUM_THREADS": "1",
    "NUMEXPR_NUM_THREADS": "1",
    "VECLIB_MAXIMUM_THREADS": "1",
    "PYTORCH_NUM_THREADS": "1",
}
_OPTIONAL_ENV_VARS = (
    "PYTORCH_JIT",
    "CUDA_VISIBLE_DEVICES",
)
_SAFE_ENV_VARS = (
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TZ",
)
_INFRA_ERROR_MARKER = "__WARM_FORK_INFRA_ERROR__"
_PR_SET_NO_NEW_PRIVS = 38
_PR_SET_DUMPABLE = 4
_SCMP_ACT_ALLOW = 0x7FFF0000
_SCMP_ACT_ERRNO_BASE = 0x00050000
_SECCOMP_DENY_NETWORK_SYSCALLS = (
    # Network egress and local socket creation.
    "socket",
    "socketpair",
    "connect",
    "accept",
    "accept4",
    "bind",
    "listen",
    "sendto",
    "sendmsg",
    "sendmmsg",
    "recvfrom",
    "recvmsg",
    "recvmmsg",
    "getsockopt",
    "setsockopt",
    "shutdown",
)
_SECCOMP_DENY_PROCESS_CONTROL_SYSCALLS = (
    # Process execution / tracing / namespace manipulation.
    "execve",
    "execveat",
    "ptrace",
    "unshare",
    "setns",
    "mount",
    "umount2",
    "pivot_root",
    "chroot",
    # Prevent signaling other processes owned by the same UID.
    "kill",
    "tkill",
    "tgkill",
    "pidfd_send_signal",
    # Block direct cross-process memory/file-descriptor access attempts.
    "process_vm_readv",
    "process_vm_writev",
    "pidfd_open",
    "pidfd_getfd",
    "kcmp",
    "prlimit64",
)
_SECCOMP_DENY_HIGH_RISK_KERNEL_SURFACE = (
    # Kernel attack surface that user submissions never need.
    "bpf",
    "keyctl",
    "add_key",
    "request_key",
    "init_module",
    "finit_module",
    "delete_module",
    "kexec_load",
    "open_by_handle_at",
    # Additional kernel interfaces with a high exploit history.
    "io_uring_setup",
    "io_uring_enter",
    "io_uring_register",
    "userfaultfd",
    "perf_event_open",
)
_SECCOMP_DENY_SYSCALLS = (
    *_SECCOMP_DENY_NETWORK_SYSCALLS,
    *_SECCOMP_DENY_PROCESS_CONTROL_SYSCALLS,
    *_SECCOMP_DENY_HIGH_RISK_KERNEL_SURFACE,
)
_SECCOMP_DENY_FILE_OPEN_SYSCALLS = (
    # Disallow opening arbitrary host paths from untrusted submissions.
    "open",
    "openat",
    "openat2",
    "creat",
)
_SECCOMP_DENY_FILE_METADATA_SYSCALLS = (
    # Block host filesystem metadata probing (existence/discovery via stat/access/readdir).
    "stat",
    "lstat",
    "fstatat64",
    "newfstatat",
    "statx",
    "access",
    "faccessat",
    "faccessat2",
    "readlink",
    "readlinkat",
    "getdents",
    "getdents64",
)


class WarmForkUnavailableError(RuntimeError):
    """Raised when warm fork execution cannot run on the current platform."""


@dataclass(frozen=True)
class _ChildRunResult:
    returncode: int
    stdout: str
    stderr: str
    timed_out: bool
    signum: int | None = None


class WarmForkExecutor:
    """Executes jobs in forked child processes with a warm torch parent."""

    def __init__(
        self,
        *,
        enable_no_new_privs: bool = True,
        enable_seccomp: bool = True,
        seccomp_fail_closed: bool = True,
        clear_env: bool = True,
        deny_filesystem: bool = True,
        allow_root: bool = False,
        child_nofile_limit: int = 64,
        preload_torch: bool = True,
    ) -> None:
        if child_nofile_limit < 16:
            raise ValueError("child_nofile_limit must be >= 16")
        if os.name != "posix" or not hasattr(os, "fork"):
            raise WarmForkUnavailableError("warm fork executor requires POSIX fork support")
        if hasattr(os, "geteuid") and os.geteuid() == 0 and not allow_root:
            raise WarmForkUnavailableError(
                "warm fork executor must not run as root (set allow_root=True to override)"
            )

        self.enable_no_new_privs = enable_no_new_privs
        self.enable_seccomp = enable_seccomp
        self.seccomp_fail_closed = seccomp_fail_closed
        self.clear_env = clear_env
        self.deny_filesystem = deny_filesystem
        self.child_nofile_limit = child_nofile_limit
        self._compiled_harness = compile(HARNESS_CODE, "harness.py", "exec")
        self._libc = self._load_libc()
        self._seccomp_lib: ctypes.CDLL | None = None

        if (
            self.enable_seccomp
            and sys.platform.startswith("linux")
            and not self.enable_no_new_privs
        ):
            raise ValueError("enable_no_new_privs must be true when enable_seccomp is true")
        if self.enable_seccomp and sys.platform.startswith("linux"):
            self._seccomp_lib = self._load_seccomp_lib()
        self._harden_parent_process()

        if preload_torch:
            # Warm-import torch once in the parent. Child imports become cheap.
            import torch  # noqa: F401

    def run_problem(
        self,
        problem: Problem,
        user_code: str,
        max_output_chars: int,
        include_hidden: bool = True,
        detail_mode: str = "all",
        isolate: IsolateConfig | None = None,
    ) -> dict[str, Any]:
        if isolate is None:
            raise ValueError("isolate configuration is required")

        config = _build_test_config(problem, include_hidden)
        total_cases = len(config["cases"])
        wall_time = max(problem.time_limit_s + isolate.wall_time_extra_s, problem.time_limit_s + 1)
        timeout_s = wall_time + isolate.timeout_grace_s

        try:
            child = self._run_child(
                problem=problem,
                user_code=user_code,
                config=config,
                isolate=isolate,
                timeout_s=timeout_s,
            )
        except Exception as exc:
            return {
                "status": "Runtime Error",
                "summary": _build_error_summary(problem, include_hidden, total_cases),
                "tests": [],
                "error": f"Warm executor failed: {exc}",
                "error_kind": "internal",
            }

        if child.timed_out:
            return {
                "status": "Time Limit Exceeded",
                "summary": _build_error_summary(problem, include_hidden, total_cases),
                "tests": [],
                "error": f"Time Limit Exceeded ({problem.time_limit_s}s)",
                "error_kind": "user",
            }

        if child.returncode != 0:
            infra_error = _INFRA_ERROR_MARKER in child.stderr
            error_kind = "internal" if infra_error else "user"
            detail = child.stderr.strip() or "Runner failed"
            if child.signum is not None and not detail:
                detail = f"Runner killed by signal {child.signum}"
            return {
                "status": "Runtime Error",
                "summary": _build_error_summary(problem, include_hidden, total_cases),
                "tests": [],
                "error": detail,
                "error_kind": error_kind,
            }

        try:
            tests_raw = json.loads(child.stdout)
        except json.JSONDecodeError:
            return {
                "status": "Runtime Error",
                "summary": _build_error_summary(problem, include_hidden, total_cases),
                "tests": [],
                "error": f"Invalid runner output. Stdout: {child.stdout}\nStderr: {child.stderr}",
                "error_kind": "internal",
            }

        summary, first_failed = _summarize_results(tests_raw)
        status = "Accepted"
        if summary["failed"] > 0 and first_failed is not None:
            status = first_failed.get("status", "Wrong Answer")

        if detail_mode == "first_failure":
            tests = (
                [_sanitize_item(first_failed, max_output_chars)]
                if first_failed is not None
                else []
            )
        else:
            tests = [_sanitize_item(item, max_output_chars) for item in tests_raw]

        return {
            "status": status,
            "summary": summary,
            "tests": tests,
            "error": None,
        }

    def _run_child(
        self,
        *,
        problem: Problem,
        user_code: str,
        config: dict[str, Any],
        isolate: IsolateConfig,
        timeout_s: int,
    ) -> _ChildRunResult:
        with tempfile.TemporaryDirectory(prefix="judge-warm-fork-") as tmp_dir:
            root = Path(tmp_dir)
            workspace = root / "box"
            workspace.mkdir(parents=True, exist_ok=True)
            stdout_path = root / "stdout.txt"
            stderr_path = root / "stderr.txt"

            # Prevent parent buffered output from being duplicated into child files after fork.
            sys.stdout.flush()
            sys.stderr.flush()
            pid = os.fork()
            if pid == 0:
                self._child_entry(
                    workspace=workspace,
                    stdout_path=stdout_path,
                    stderr_path=stderr_path,
                    problem=problem,
                    user_code=user_code,
                    config=config,
                    isolate=isolate,
                )
                os._exit(1)

            status, timed_out = self._wait_for_child(pid=pid, timeout_s=timeout_s)
            stdout = stdout_path.read_text() if stdout_path.exists() else ""
            stderr = stderr_path.read_text() if stderr_path.exists() else ""

            if timed_out:
                return _ChildRunResult(
                    returncode=1,
                    stdout=stdout,
                    stderr=stderr,
                    timed_out=True,
                )

            if os.WIFEXITED(status):
                return _ChildRunResult(
                    returncode=os.WEXITSTATUS(status),
                    stdout=stdout,
                    stderr=stderr,
                    timed_out=False,
                )

            if os.WIFSIGNALED(status):
                signum = os.WTERMSIG(status)
                return _ChildRunResult(
                    returncode=128 + signum,
                    stdout=stdout,
                    stderr=stderr,
                    timed_out=False,
                    signum=signum,
                )

            return _ChildRunResult(
                returncode=1,
                stdout=stdout,
                stderr=stderr,
                timed_out=False,
            )

    def _child_entry(
        self,
        *,
        workspace: Path,
        stdout_path: Path,
        stderr_path: Path,
        problem: Problem,
        user_code: str,
        config: dict[str, Any],
        isolate: IsolateConfig,
    ) -> None:
        try:
            self._redirect_stdio(stdout_path=stdout_path, stderr_path=stderr_path)
            self._prepare_child_sandbox(workspace=workspace, problem=problem, isolate=isolate)
            self._execute_harness(
                user_code=user_code,
                config=config,
            )
            sys.stdout.flush()
            sys.stderr.flush()
            os._exit(0)
        except BaseException:
            try:
                traceback.print_exc(file=sys.stderr)
                sys.stdout.flush()
                sys.stderr.flush()
            except Exception:
                pass
            os._exit(1)

    def _prepare_child_sandbox(
        self,
        *,
        workspace: Path,
        problem: Problem,
        isolate: IsolateConfig,
    ) -> None:
        try:
            os.setsid()
        except OSError as exc:
            raise RuntimeError(f"{_INFRA_ERROR_MARKER} failed to create session: {exc}") from exc

        self._apply_child_env(workspace=workspace)
        os.umask(0o077)
        if self.enable_no_new_privs:
            self._set_no_new_privs()
        self._apply_resource_limits(problem=problem, isolate=isolate)
        if self.enable_seccomp:
            self._apply_seccomp_filter()
        self._close_inherited_fds()

    def _redirect_stdio(self, *, stdout_path: Path, stderr_path: Path) -> None:
        stdin_fd = os.open("/dev/null", os.O_RDONLY)
        stdout_fd = os.open(stdout_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        stderr_fd = os.open(stderr_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        try:
            os.dup2(stdin_fd, 0)
            os.dup2(stdout_fd, 1)
            os.dup2(stderr_fd, 2)
        finally:
            for fd in (stdin_fd, stdout_fd, stderr_fd):
                if fd > 2:
                    os.close(fd)

    def _build_child_env(self, *, workspace: Path, base_env: dict[str, str]) -> dict[str, str]:
        child_env: dict[str, str] = {}
        if not self.clear_env:
            child_env.update(base_env)
        else:
            for name in _SAFE_ENV_VARS:
                value = base_env.get(name)
                if value is not None:
                    child_env[name] = value

        for name, default in _THREAD_ENV_DEFAULTS.items():
            child_env[name] = base_env.get(name, default)
        for name in _OPTIONAL_ENV_VARS:
            value = base_env.get(name)
            if value is not None:
                child_env[name] = value

        tmp_dir = workspace / "tmp"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        child_env["HOME"] = str(workspace)
        child_env["TMPDIR"] = str(tmp_dir)
        child_env["TMP"] = str(tmp_dir)
        child_env["TEMP"] = str(tmp_dir)
        child_env["PATH"] = "/usr/bin:/bin"
        child_env["PYTHONNOUSERSITE"] = "1"
        return child_env

    def _apply_child_env(self, *, workspace: Path) -> None:
        child_env = self._build_child_env(workspace=workspace, base_env=dict(os.environ))
        os.environ.clear()
        os.environ.update(child_env)

    def _set_no_new_privs(self) -> None:
        if not sys.platform.startswith("linux"):
            return

        libc = self._libc
        if libc is None:
            raise RuntimeError(f"{_INFRA_ERROR_MARKER} libc not found for prctl()")
        result = libc.prctl(_PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)
        if result != 0:
            errno = ctypes.get_errno()
            detail = os.strerror(errno) if errno else "unknown error"
            raise RuntimeError(f"{_INFRA_ERROR_MARKER} prctl(PR_SET_NO_NEW_PRIVS) failed: {detail}")

    def _load_libc(self) -> ctypes.CDLL | None:
        libc_path = ctypes.util.find_library("c")
        if not libc_path:
            return None
        return ctypes.CDLL(libc_path, use_errno=True)

    def _harden_parent_process(self) -> None:
        if not sys.platform.startswith("linux"):
            return
        libc = self._libc
        if libc is None:
            raise RuntimeError(f"{_INFRA_ERROR_MARKER} libc not found for parent hardening")
        result = libc.prctl(_PR_SET_DUMPABLE, 0, 0, 0, 0)
        if result != 0:
            errno = ctypes.get_errno()
            detail = os.strerror(errno) if errno else "unknown error"
            raise RuntimeError(f"{_INFRA_ERROR_MARKER} prctl(PR_SET_DUMPABLE) failed: {detail}")

    def _load_seccomp_lib(self) -> ctypes.CDLL | None:
        if not sys.platform.startswith("linux"):
            return None

        seccomp_path = ctypes.util.find_library("seccomp")
        if not seccomp_path:
            if self.seccomp_fail_closed:
                raise RuntimeError(f"{_INFRA_ERROR_MARKER} libseccomp not found")
            return None

        lib = ctypes.CDLL(seccomp_path, use_errno=True)
        try:
            lib.seccomp_init.argtypes = [ctypes.c_uint32]
            lib.seccomp_init.restype = ctypes.c_void_p
            lib.seccomp_rule_add.argtypes = [
                ctypes.c_void_p,
                ctypes.c_uint32,
                ctypes.c_int,
                ctypes.c_uint32,
            ]
            lib.seccomp_rule_add.restype = ctypes.c_int
            lib.seccomp_load.argtypes = [ctypes.c_void_p]
            lib.seccomp_load.restype = ctypes.c_int
            lib.seccomp_release.argtypes = [ctypes.c_void_p]
            lib.seccomp_release.restype = None
            lib.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
            lib.seccomp_syscall_resolve_name.restype = ctypes.c_int
            return lib
        except AttributeError as exc:
            if self.seccomp_fail_closed:
                raise RuntimeError(
                    f"{_INFRA_ERROR_MARKER} invalid libseccomp interface: {exc}"
                ) from exc
            return None

    def _seccomp_errno_action(self, errno_value: int) -> int:
        return _SCMP_ACT_ERRNO_BASE | (errno_value & 0xFFFF)

    def _seccomp_error(self, message: str) -> None:
        if self.seccomp_fail_closed:
            raise RuntimeError(f"{_INFRA_ERROR_MARKER} {message}")

    def _apply_seccomp_filter(self) -> None:
        if not sys.platform.startswith("linux"):
            return

        lib = self._seccomp_lib or self._load_seccomp_lib()
        if lib is None:
            self._seccomp_error("seccomp requested but unavailable")
            return

        ctx = lib.seccomp_init(_SCMP_ACT_ALLOW)
        if not ctx:
            self._seccomp_error("seccomp_init failed")
            return

        deny_action = self._seccomp_errno_action(errno.EPERM)
        try:
            deny_syscalls = list(_SECCOMP_DENY_SYSCALLS)
            if self.deny_filesystem:
                deny_syscalls.extend(_SECCOMP_DENY_FILE_OPEN_SYSCALLS)
                deny_syscalls.extend(_SECCOMP_DENY_FILE_METADATA_SYSCALLS)

            for name in deny_syscalls:
                syscall_nr = lib.seccomp_syscall_resolve_name(name.encode("ascii"))
                if syscall_nr < 0:
                    continue
                rc = lib.seccomp_rule_add(ctx, deny_action, syscall_nr, 0)
                if rc != 0:
                    detail = os.strerror(-rc) if rc < 0 else f"code={rc}"
                    self._seccomp_error(f"seccomp_rule_add({name}) failed: {detail}")
                    return

            rc = lib.seccomp_load(ctx)
            if rc != 0:
                detail = os.strerror(-rc) if rc < 0 else f"code={rc}"
                self._seccomp_error(f"seccomp_load failed: {detail}")
                return
        finally:
            lib.seccomp_release(ctx)

    def _apply_resource_limits(self, *, problem: Problem, isolate: IsolateConfig) -> None:
        cpu_seconds = max(problem.time_limit_s, 1)
        memory_bytes = max(problem.memory_mb, 1) * 1024 * 1024
        fsize_bytes = max(isolate.fsize_kb, 1) * 1024
        proc_limit = max(isolate.process_limit, 1)
        nofile_limit = max(self.child_nofile_limit, 16)

        self._set_limit(resource.RLIMIT_CPU, cpu_seconds, "RLIMIT_CPU")
        self._set_limit(
            resource.RLIMIT_AS,
            memory_bytes,
            "RLIMIT_AS",
            required=sys.platform.startswith("linux"),
        )
        self._set_limit(resource.RLIMIT_FSIZE, fsize_bytes, "RLIMIT_FSIZE")
        if hasattr(resource, "RLIMIT_NPROC"):
            self._set_limit(resource.RLIMIT_NPROC, proc_limit, "RLIMIT_NPROC")
        self._set_limit(resource.RLIMIT_NOFILE, nofile_limit, "RLIMIT_NOFILE")
        if hasattr(resource, "RLIMIT_CORE"):
            self._set_limit(
                resource.RLIMIT_CORE,
                0,
                "RLIMIT_CORE",
                required=False,
                min_value=0,
            )

    def _set_limit(
        self,
        kind: int,
        value: int,
        name: str,
        *,
        required: bool = True,
        min_value: int = 1,
    ) -> None:
        current_soft, current_hard = resource.getrlimit(kind)
        target = value
        if current_hard != resource.RLIM_INFINITY:
            target = min(target, int(current_hard))

        if target < min_value:
            if required:
                raise RuntimeError(f"{_INFRA_ERROR_MARKER} invalid {name} target: {target}")
            return

        try:
            resource.setrlimit(kind, (target, target))
            return
        except (OSError, ValueError):
            pass

        # Fallback: keep hard limit unchanged, set only the soft cap.
        try:
            resource.setrlimit(kind, (target, current_hard))
        except (OSError, ValueError) as exc:
            if required:
                raise RuntimeError(f"{_INFRA_ERROR_MARKER} failed to set {name}: {exc}") from exc

    def _close_inherited_fds(self) -> None:
        try:
            max_fd = os.sysconf("SC_OPEN_MAX")
        except (ValueError, OSError):
            max_fd = 4096

        if max_fd <= 3:
            return
        max_fd = min(int(max_fd), 65536)
        os.closerange(3, max_fd)

    def _execute_harness(
        self,
        *,
        user_code: str,
        config: dict[str, Any],
    ) -> None:
        exec_globals: dict[str, Any] = {
            "__name__": "__main__",
            "__file__": "harness.py",
            "__judge_user_code__": user_code,
            "__judge_test_config__": config,
        }
        exec(self._compiled_harness, exec_globals)

    def _wait_for_child(self, *, pid: int, timeout_s: int) -> tuple[int, bool]:
        deadline = time.monotonic() + max(timeout_s, 1)
        while True:
            waited_pid, status = os.waitpid(pid, os.WNOHANG)
            if waited_pid == pid:
                return status, False

            if time.monotonic() >= deadline:
                self._kill_child_process_group(pid)
                waited_pid, status = os.waitpid(pid, 0)
                if waited_pid != pid:
                    return status, True
                return status, True
            time.sleep(0.01)

    def _kill_child_process_group(self, pid: int) -> None:
        try:
            os.killpg(pid, signal.SIGKILL)
            return
        except ProcessLookupError:
            return
        except OSError:
            pass

        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            return
