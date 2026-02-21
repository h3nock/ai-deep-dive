"""Warm fork executor for torch-heavy jobs.

This executor keeps a long-lived parent process that preloads torch and forks
per submission. Child processes execute untrusted code with resource limits and
exit after each job, so Python-level state never leaks back to the parent.

Per-job isolation layers (when available):
- cgroup v2: memory and PID limits with OOM kill detection
- seccomp-bpf: syscall deny filter (network, exec, filesystem)
- rlimits: CPU time, address space, file size, open files
- session and environment isolation
"""

from __future__ import annotations

import ctypes
import ctypes.util
import errno
import json
import logging
import os
import resource
import select
import signal
import sys
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

logger = logging.getLogger(__name__)

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
_HAS_PIDFD = hasattr(os, "pidfd_open")
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
# Maximum bytes the parent will buffer from child stdout+stderr combined.
# Beyond this limit the parent stops reading (but keeps waiting for exit).
_MAX_CHILD_OUTPUT_BYTES = 2 * 1024 * 1024  # 2 MB
# Interval between retry attempts during cgroup teardown.
_CGROUP_DESTROY_POLL_S = 0.005
_CGROUP_DESTROY_ATTEMPTS = 10


# ---------------------------------------------------------------------------
# cgroup v2 per-job sandbox
# ---------------------------------------------------------------------------

class _CgroupV2Sandbox:
    """Optional per-job cgroup v2 isolation with OOM kill detection.

    Auto-detects the unified cgroup v2 hierarchy and whether the current
    process owns a delegated subtree (systemd ``Delegate=yes``).  Falls back
    gracefully when cgroup control is unavailable.
    """

    def __init__(self, *, enabled: bool = True) -> None:
        self._root: Path | None = None
        if enabled:
            self._init_cgroup()

    @property
    def available(self) -> bool:
        return self._root is not None

    def _init_cgroup(self) -> None:
        if not sys.platform.startswith("linux"):
            return

        # Resolve our cgroup path from the unified hierarchy entry (0::).
        try:
            content = Path("/proc/self/cgroup").read_text()
        except OSError:
            return

        rel_path: str | None = None
        for line in content.splitlines():
            if line.startswith("0::"):
                rel_path = line[3:].strip()
                break
        if rel_path is None:
            return

        root = Path("/sys/fs/cgroup") / rel_path.lstrip("/")
        if not root.is_dir():
            return

        # Verify write access to subtree_control — requires Delegate=yes.
        subtree_ctl = root / "cgroup.subtree_control"
        if not os.access(subtree_ctl, os.W_OK):
            logger.info("cgroup v2 delegation not available (subtree_control not writable)")
            return

        try:
            subtree_ctl.write_text("+memory +pids\n")
        except OSError as exc:
            logger.info("cgroup v2 controller activation failed: %s", exc)
            return

        self._root = root
        logger.info("cgroup v2 sandbox enabled at %s", root)

    def create_child(
        self,
        name: str,
        memory_bytes: int,
        pids_max: int,
    ) -> Path | None:
        if self._root is None:
            return None

        child = self._root / name
        try:
            child.mkdir()
        except FileExistsError:
            # Stale dir from a previous crash — reclaim it.
            logger.warning("cgroup child %s already exists, reclaiming", child)
            self.destroy(child)
            try:
                child.mkdir()
            except OSError as exc:
                logger.error("cgroup child mkdir failed after reclaim: %s", exc)
                return None
        except OSError as exc:
            logger.error("cgroup child mkdir failed: %s", exc)
            return None

        try:
            (child / "memory.max").write_text(str(memory_bytes))
            (child / "pids.max").write_text(str(pids_max))
        except OSError as exc:
            logger.error("cgroup child config failed: %s", exc)
            self.destroy(child)
            return None

        return child

    def was_oom_killed(self, child: Path) -> bool:
        try:
            for line in (child / "memory.events").read_text().splitlines():
                key, _, value = line.partition(" ")
                if key == "oom_kill":
                    return int(value) > 0
        except (OSError, ValueError):
            pass
        return False

    def destroy(self, child: Path) -> None:
        if not child.is_dir():
            return

        procs_path = child / "cgroup.procs"
        for _ in range(_CGROUP_DESTROY_ATTEMPTS):
            try:
                pids_raw = procs_path.read_text().strip()
            except OSError:
                break
            if not pids_raw:
                break
            for pid_str in pids_raw.splitlines():
                try:
                    os.kill(int(pid_str), signal.SIGKILL)
                except (OSError, ValueError):
                    pass
            time.sleep(_CGROUP_DESTROY_POLL_S)

        for _ in range(_CGROUP_DESTROY_ATTEMPTS):
            try:
                child.rmdir()
                return
            except OSError:
                time.sleep(_CGROUP_DESTROY_POLL_S)


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

class WarmForkUnavailableError(RuntimeError):
    """Raised when warm fork execution cannot run on the current platform."""


@dataclass(frozen=True)
class _ChildRunResult:
    returncode: int
    stdout: str
    stderr: str
    timed_out: bool
    oom_killed: bool = False
    output_truncated: bool = False
    signum: int | None = None


# ---------------------------------------------------------------------------
# Executor
# ---------------------------------------------------------------------------

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
        enable_cgroup: bool = True,
        max_jobs: int = 0,
        preload_torch: bool = True,
    ) -> None:
        # Parameter validation (pure logic, no environment dependency).
        if child_nofile_limit < 16:
            raise ValueError("child_nofile_limit must be >= 16")
        if max_jobs < 0:
            raise ValueError("max_jobs must be >= 0")
        if enable_seccomp and sys.platform.startswith("linux") and not enable_no_new_privs:
            raise ValueError("enable_no_new_privs must be true when enable_seccomp is true")

        # Environment guards.
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
        self._job_seq = 0
        self._max_jobs = max_jobs

        if self.enable_seccomp and sys.platform.startswith("linux"):
            self._seccomp_lib = self._load_seccomp_lib()
        self._harden_parent_process()
        if enable_cgroup and not deny_filesystem:
            logger.warning(
                "enable_cgroup=True with deny_filesystem=False: "
                "child processes can write to cgroup control files"
            )
        self._cgroup = _CgroupV2Sandbox(enabled=enable_cgroup)

        if preload_torch:
            import torch  # noqa: F401

    @property
    def job_count(self) -> int:
        return self._job_seq

    @property
    def needs_recycle(self) -> bool:
        """True when the executor has reached its max_jobs limit and should be replaced."""
        return self._max_jobs > 0 and self._job_seq >= self._max_jobs

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

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

        if child.oom_killed:
            return {
                "status": "Memory Limit Exceeded",
                "summary": _build_error_summary(problem, include_hidden, total_cases),
                "tests": [],
                "error": f"Memory Limit Exceeded ({problem.memory_mb}MB)",
                "error_kind": "user",
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

        if child.output_truncated:
            cap_mb = _MAX_CHILD_OUTPUT_BYTES // (1024 * 1024)
            return {
                "status": "Runtime Error",
                "summary": _build_error_summary(problem, include_hidden, total_cases),
                "tests": [],
                "error": f"Output Limit Exceeded ({cap_mb}MB)",
                "error_kind": "user",
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

    # ------------------------------------------------------------------
    # Fork lifecycle
    # ------------------------------------------------------------------

    def _run_child(
        self,
        *,
        problem: Problem,
        user_code: str,
        config: dict[str, Any],
        isolate: IsolateConfig,
        timeout_s: float,
    ) -> _ChildRunResult:
        self._job_seq += 1
        cgroup_name = f"job-{self._job_seq}"
        cgroup_path = self._cgroup.create_child(
            cgroup_name,
            memory_bytes=max(problem.memory_mb, 1) * 1024 * 1024,
            pids_max=max(isolate.process_limit, 1),
        )

        devnull_fd = os.open(os.devnull, os.O_RDONLY)
        stdout_r, stdout_w = os.pipe()
        stderr_r, stderr_w = os.pipe()

        # Prevent parent buffered output from being duplicated after fork.
        sys.stdout.flush()
        sys.stderr.flush()

        try:
            pid = os.fork()
        except OSError:
            for fd in (devnull_fd, stdout_r, stdout_w, stderr_r, stderr_w):
                os.close(fd)
            if cgroup_path is not None:
                self._cgroup.destroy(cgroup_path)
            raise

        if pid == 0:
            os.close(stdout_r)
            os.close(stderr_r)
            self._child_entry(
                devnull_fd=devnull_fd,
                stdout_fd=stdout_w,
                stderr_fd=stderr_w,
                cgroup_path=cgroup_path,
                problem=problem,
                user_code=user_code,
                config=config,
                isolate=isolate,
            )
            os._exit(1)

        # Parent: close child-side fds.
        os.close(devnull_fd)
        os.close(stdout_w)
        os.close(stderr_w)

        try:
            return self._wait_and_collect(
                pid=pid,
                stdout_fd=stdout_r,
                stderr_fd=stderr_r,
                timeout_s=timeout_s,
                cgroup_path=cgroup_path,
            )
        finally:
            os.close(stdout_r)
            os.close(stderr_r)
            if cgroup_path is not None:
                self._cgroup.destroy(cgroup_path)

    def _child_entry(
        self,
        *,
        devnull_fd: int,
        stdout_fd: int,
        stderr_fd: int,
        cgroup_path: Path | None,
        problem: Problem,
        user_code: str,
        config: dict[str, Any],
        isolate: IsolateConfig,
    ) -> None:
        try:
            # Join cgroup before seccomp (requires file write to cgroup.procs).
            if cgroup_path is not None:
                self._join_cgroup(cgroup_path)

            self._redirect_child_stdio(
                devnull_fd=devnull_fd,
                stdout_fd=stdout_fd,
                stderr_fd=stderr_fd,
            )
            self._prepare_child_sandbox(problem=problem, isolate=isolate)
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

    # ------------------------------------------------------------------
    # Child sandbox setup
    # ------------------------------------------------------------------

    def _join_cgroup(self, cgroup_path: Path) -> None:
        try:
            (cgroup_path / "cgroup.procs").write_text(str(os.getpid()))
        except OSError as exc:
            raise RuntimeError(
                f"{_INFRA_ERROR_MARKER} failed to join cgroup: {exc}"
            ) from exc

    def _redirect_child_stdio(
        self,
        *,
        devnull_fd: int,
        stdout_fd: int,
        stderr_fd: int,
    ) -> None:
        os.dup2(devnull_fd, 0)
        os.dup2(stdout_fd, 1)
        os.dup2(stderr_fd, 2)
        for fd in (devnull_fd, stdout_fd, stderr_fd):
            if fd > 2:
                os.close(fd)
        # Reset Python-level stdio to match the new file descriptors.
        # After fork the parent's sys.stdout/stderr may be wrapped objects
        # (e.g. test framework capture, logging redirection) that no longer
        # correspond to fd 1/2.  Line buffering ensures print() flushes.
        sys.stdin = open(0, closefd=False)
        sys.stdout = open(1, "w", buffering=1, closefd=False)
        sys.stderr = open(2, "w", buffering=1, closefd=False)

    def _prepare_child_sandbox(
        self,
        *,
        problem: Problem,
        isolate: IsolateConfig,
    ) -> None:
        try:
            os.setsid()
        except OSError as exc:
            raise RuntimeError(f"{_INFRA_ERROR_MARKER} failed to create session: {exc}") from exc

        self._apply_child_env()
        os.umask(0o077)
        if self.enable_no_new_privs:
            self._set_no_new_privs()
        self._apply_resource_limits(problem=problem, isolate=isolate)
        if self.enable_seccomp:
            self._apply_seccomp_filter()
        self._close_inherited_fds()

    def _build_child_env(self, *, base_env: dict[str, str]) -> dict[str, str]:
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

        child_env["HOME"] = "/tmp"
        child_env["TMPDIR"] = "/tmp"
        child_env["TMP"] = "/tmp"
        child_env["TEMP"] = "/tmp"
        child_env["PATH"] = "/usr/bin:/bin"
        child_env["PYTHONNOUSERSITE"] = "1"
        return child_env

    def _apply_child_env(self) -> None:
        child_env = self._build_child_env(base_env=dict(os.environ))
        os.environ.clear()
        os.environ.update(child_env)

    # ------------------------------------------------------------------
    # Child wait and output collection (pidfd + poll)
    # ------------------------------------------------------------------

    def _wait_and_collect(
        self,
        *,
        pid: int,
        stdout_fd: int,
        stderr_fd: int,
        timeout_s: float,
        cgroup_path: Path | None,
    ) -> _ChildRunResult:
        pidfd = self._open_pidfd(pid)
        try:
            stdout_chunks, stderr_chunks, timed_out, output_truncated = self._poll_child_io(
                pid=pid,
                pidfd=pidfd,
                stdout_fd=stdout_fd,
                stderr_fd=stderr_fd,
                timeout_s=timeout_s,
            )
        finally:
            if pidfd >= 0:
                os.close(pidfd)

        if timed_out:
            self._kill_child_process_group(pid)

        _, status = os.waitpid(pid, 0)

        # Drain any data written between the last poll and child exit.
        if not output_truncated:
            stdout_chunks.extend(self._drain_fd(stdout_fd))
            stderr_chunks.extend(self._drain_fd(stderr_fd))

        oom_killed = (
            cgroup_path is not None
            and self._cgroup.was_oom_killed(cgroup_path)
        )

        stdout = b"".join(stdout_chunks).decode("utf-8", errors="replace")
        stderr = b"".join(stderr_chunks).decode("utf-8", errors="replace")

        return self._build_child_result(
            status=status,
            stdout=stdout,
            stderr=stderr,
            timed_out=timed_out,
            oom_killed=oom_killed,
            output_truncated=output_truncated,
        )

    def _poll_child_io(
        self,
        *,
        pid: int,
        pidfd: int,
        stdout_fd: int,
        stderr_fd: int,
        timeout_s: float,
    ) -> tuple[list[bytes], list[bytes], bool, bool]:
        """Returns (stdout_chunks, stderr_chunks, timed_out, output_truncated)."""
        poller = select.poll()
        if pidfd >= 0:
            poller.register(pidfd, select.POLLIN)
        poller.register(stdout_fd, select.POLLIN)
        poller.register(stderr_fd, select.POLLIN)

        stdout_chunks: list[bytes] = []
        stderr_chunks: list[bytes] = []
        total_bytes = 0
        truncated = False
        active_pipes = {stdout_fd, stderr_fd}
        deadline = time.monotonic() + max(timeout_s, 1)

        while True:
            remaining_ms = int((deadline - time.monotonic()) * 1000)
            if remaining_ms <= 0:
                return stdout_chunks, stderr_chunks, True, truncated

            events = poller.poll(remaining_ms)
            if not events:
                return stdout_chunks, stderr_chunks, True, truncated

            for fd, event in events:
                if fd == pidfd:
                    return stdout_chunks, stderr_chunks, False, truncated

                chunks = stdout_chunks if fd == stdout_fd else stderr_chunks
                if event & (select.POLLIN | select.POLLHUP):
                    try:
                        data = os.read(fd, 65536)
                    except OSError:
                        data = b""
                    if data:
                        total_bytes += len(data)
                        if total_bytes <= _MAX_CHILD_OUTPUT_BYTES:
                            chunks.append(data)
                        else:
                            truncated = True
                    if not data or event & select.POLLHUP:
                        poller.unregister(fd)
                        active_pipes.discard(fd)
                elif event & select.POLLERR:
                    poller.unregister(fd)
                    active_pipes.discard(fd)

            # Without pidfd, infer child exit when both pipes reach EOF.
            if pidfd < 0 and not active_pipes:
                return stdout_chunks, stderr_chunks, False, truncated

    def _open_pidfd(self, pid: int) -> int:
        if not _HAS_PIDFD:
            return -1
        try:
            return os.pidfd_open(pid, 0)
        except OSError:
            return -1

    def _drain_fd(self, fd: int) -> list[bytes]:
        chunks: list[bytes] = []
        os.set_blocking(fd, False)
        try:
            while True:
                data = os.read(fd, 65536)
                if not data:
                    break
                chunks.append(data)
        except OSError:
            pass
        return chunks

    def _build_child_result(
        self,
        *,
        status: int,
        stdout: str,
        stderr: str,
        timed_out: bool,
        oom_killed: bool,
        output_truncated: bool = False,
    ) -> _ChildRunResult:
        if timed_out:
            return _ChildRunResult(
                returncode=1,
                stdout=stdout,
                stderr=stderr,
                timed_out=True,
                oom_killed=oom_killed,
                output_truncated=output_truncated,
            )

        if os.WIFEXITED(status):
            return _ChildRunResult(
                returncode=os.WEXITSTATUS(status),
                stdout=stdout,
                stderr=stderr,
                timed_out=False,
                oom_killed=oom_killed,
                output_truncated=output_truncated,
            )

        if os.WIFSIGNALED(status):
            signum = os.WTERMSIG(status)
            return _ChildRunResult(
                returncode=128 + signum,
                stdout=stdout,
                stderr=stderr,
                timed_out=False,
                oom_killed=oom_killed,
                output_truncated=output_truncated,
                signum=signum,
            )

        return _ChildRunResult(
            returncode=1,
            stdout=stdout,
            stderr=stderr,
            timed_out=False,
            oom_killed=oom_killed,
            output_truncated=output_truncated,
        )

    # ------------------------------------------------------------------
    # Process control
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Security: prctl, seccomp, rlimits
    # ------------------------------------------------------------------

    def _set_no_new_privs(self) -> None:
        if not sys.platform.startswith("linux"):
            return

        libc = self._libc
        if libc is None:
            raise RuntimeError(f"{_INFRA_ERROR_MARKER} libc not found for prctl()")
        result = libc.prctl(_PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)
        if result != 0:
            err = ctypes.get_errno()
            detail = os.strerror(err) if err else "unknown error"
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
            err = ctypes.get_errno()
            detail = os.strerror(err) if err else "unknown error"
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
