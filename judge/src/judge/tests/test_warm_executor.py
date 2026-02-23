"""Warm fork executor behavior tests."""

from __future__ import annotations

import ctypes.util
import os
import sys
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from judge.problems import Comparison, Problem
from judge.problems import TestCase as ProblemTestCase
from judge.runner import IsolateConfig
from judge.warm_executor import (
    _SECCOMP_DENY_FILE_METADATA_SYSCALLS,
    _SECCOMP_DENY_SYSCALLS,
    WarmForkExecutor,
    WarmForkUnavailableError,
    _CgroupV2Sandbox,
)


def _problem(*, time_limit_s: int = 1) -> Problem:
    public_case = ProblemTestCase(
        id="case-public",
        input_code="a = 1\nb = 2\n",
        expected=3,
        hidden=False,
    )
    return Problem(
        id="sample/01-basics/01-add",
        version="v1",
        runner="add(a, b)",
        requires_torch=False,
        time_limit_s=time_limit_s,
        memory_mb=256,
        comparison=Comparison(type="exact", rtol=1e-5, atol=1e-8),
        public_tests=[public_case],
        hidden_tests=[],
    )


def _isolate_config() -> IsolateConfig:
    return IsolateConfig(
        executable="/usr/bin/isolate",
        box_id=1,
        use_cgroups=True,
        process_limit=32,
        wall_time_extra_s=0,
        timeout_grace_s=0,
        fsize_kb=1024,
    )


def _env_problem() -> Problem:
    public_case = ProblemTestCase(
        id="case-env",
        input_code="",
        expected=None,
        hidden=False,
    )
    return Problem(
        id="sample/01-basics/01-env",
        version="v1",
        runner="read_env()",
        requires_torch=False,
        time_limit_s=1,
        memory_mb=256,
        comparison=Comparison(type="exact", rtol=1e-5, atol=1e-8),
        public_tests=[public_case],
        hidden_tests=[],
    )


def _executor(**overrides: object) -> WarmForkExecutor:
    """Create an executor with test defaults.

    Tests run as root on the production VM, so allow_root is on by
    default.  Torch preloading and no-new-privs are disabled to keep
    the test harness lightweight and portable.
    """
    defaults: dict[str, object] = {
        "enable_no_new_privs": False,
        "enable_seccomp": False,
        "allow_root": True,
        "child_nofile_limit": 64,
        "preload_torch": False,
    }
    defaults.update(overrides)
    return WarmForkExecutor(**defaults)


class WarmForkExecutorTests(TestCase):
    def test_run_problem_returns_accepted_for_valid_solution(self) -> None:
        executor = _executor()

        result = executor.run_problem(
            _problem(),
            "def add(a, b):\n    return a + b\n",
            max_output_chars=2000,
            include_hidden=False,
            detail_mode="all",
            isolate=_isolate_config(),
        )

        self.assertEqual(result.get("status"), "Accepted")
        self.assertEqual(result.get("error"), None)
        self.assertEqual(result.get("summary", {}).get("passed"), 1)
        self.assertEqual(result.get("summary", {}).get("failed"), 0)

    def test_run_problem_times_out_for_slow_solution(self) -> None:
        executor = _executor()

        result = executor.run_problem(
            _problem(time_limit_s=1),
            "import time\n"
            "def add(a, b):\n"
            "    time.sleep(5)\n"
            "    return a + b\n",
            max_output_chars=2000,
            include_hidden=False,
            detail_mode="all",
            isolate=_isolate_config(),
        )

        self.assertEqual(result.get("status"), "Time Limit Exceeded")
        self.assertEqual(result.get("error_kind"), "user")
        self.assertIn("Time Limit Exceeded", result.get("error", ""))

    def test_abrupt_child_exit_is_reported_as_user_runtime_error(self) -> None:
        executor = _executor()

        result = executor.run_problem(
            _problem(time_limit_s=1),
            "import os\n"
            "def add(a, b):\n"
            "    os._exit(7)\n",
            max_output_chars=2000,
            include_hidden=False,
            detail_mode="all",
            isolate=_isolate_config(),
        )

        self.assertEqual(result.get("status"), "Runtime Error")
        self.assertEqual(result.get("error_kind"), "user")

    def test_run_problem_does_not_expose_parent_env(self) -> None:
        executor = _executor(enable_seccomp=False, clear_env=True)
        with patch.dict(os.environ, {"JUDGE_SECRET_TOKEN": "should-not-leak"}, clear=False):
            result = executor.run_problem(
                _env_problem(),
                "import os\n"
                "def read_env():\n"
                "    return os.getenv('JUDGE_SECRET_TOKEN')\n",
                max_output_chars=2000,
                include_hidden=False,
                detail_mode="all",
                isolate=_isolate_config(),
            )

        self.assertEqual(result.get("status"), "Accepted")
        self.assertEqual(result.get("error"), None)

    def test_seccomp_requires_no_new_privs_on_linux(self) -> None:
        if not sys.platform.startswith("linux"):
            self.skipTest("seccomp requirement is Linux-only")
        with self.assertRaisesRegex(
            ValueError,
            "enable_no_new_privs must be true when enable_seccomp is true",
        ):
            _executor(enable_no_new_privs=False, enable_seccomp=True)

    def test_constructor_rejects_root_execution_by_default(self) -> None:
        with patch("judge.warm_executor.os.geteuid", return_value=0):
            with self.assertRaisesRegex(
                WarmForkUnavailableError,
                "must not run as root",
            ):
                WarmForkExecutor(preload_torch=False)

    def test_seccomp_deny_filesystem_blocks_host_file_reads(self) -> None:
        if not sys.platform.startswith("linux"):
            self.skipTest("seccomp is Linux-only")
        if ctypes.util.find_library("seccomp") is None:
            self.skipTest("libseccomp not available")

        executor = _executor(
            enable_no_new_privs=True,
            enable_seccomp=True,
            seccomp_fail_closed=True,
            clear_env=True,
            deny_filesystem=True,
        )

        result = executor.run_problem(
            _env_problem(),
            "def read_env():\n"
            "    try:\n"
            "        with open('/etc/passwd', 'r'):\n"
            "            return 'leaked'\n"
            "    except Exception:\n"
            "        return None\n",
            max_output_chars=2000,
            include_hidden=False,
            detail_mode="all",
            isolate=_isolate_config(),
        )
        self.assertEqual(result.get("status"), "Accepted")

    def test_seccomp_profile_covers_cross_process_escape_syscalls(self) -> None:
        self.assertIn("process_vm_readv", _SECCOMP_DENY_SYSCALLS)
        self.assertIn("process_vm_writev", _SECCOMP_DENY_SYSCALLS)
        self.assertIn("pidfd_open", _SECCOMP_DENY_SYSCALLS)
        self.assertIn("pidfd_getfd", _SECCOMP_DENY_SYSCALLS)
        self.assertIn("prlimit64", _SECCOMP_DENY_SYSCALLS)
        self.assertIn("statx", _SECCOMP_DENY_FILE_METADATA_SYSCALLS)
        self.assertIn("newfstatat", _SECCOMP_DENY_FILE_METADATA_SYSCALLS)

    def test_prepare_child_sandbox_applies_limits_before_seccomp(self) -> None:
        executor = _executor(
            enable_no_new_privs=True,
            enable_seccomp=True,
            seccomp_fail_closed=False,
            clear_env=True,
        )
        calls: list[str] = []

        with (
            patch("judge.warm_executor.os.setsid", return_value=None),
            patch.object(executor, "_set_no_new_privs", side_effect=lambda: calls.append("nnp")),
            patch.object(
                executor,
                "_apply_resource_limits",
                side_effect=lambda **_kwargs: calls.append("limits"),
            ),
            patch.object(
                executor,
                "_apply_seccomp_filter",
                side_effect=lambda: calls.append("seccomp"),
            ),
            patch.object(
                executor,
                "_close_inherited_fds",
                side_effect=lambda: calls.append("fds"),
            ),
        ):
            executor._prepare_child_sandbox(  # noqa: SLF001
                problem=_problem(),
                isolate=_isolate_config(),
            )

        self.assertEqual(calls, ["nnp", "limits", "seccomp", "fds"])

    def test_job_count_increments_per_execution(self) -> None:
        executor = _executor()
        self.assertEqual(executor.job_count, 0)

        executor.run_problem(
            _problem(),
            "def add(a, b):\n    return a + b\n",
            max_output_chars=2000,
            include_hidden=False,
            detail_mode="all",
            isolate=_isolate_config(),
        )
        self.assertEqual(executor.job_count, 1)

    def test_needs_recycle_false_when_unlimited(self) -> None:
        executor = _executor(max_jobs=0)
        self.assertFalse(executor.needs_recycle)

        executor.run_problem(
            _problem(),
            "def add(a, b):\n    return a + b\n",
            max_output_chars=2000,
            include_hidden=False,
            detail_mode="all",
            isolate=_isolate_config(),
        )
        self.assertFalse(executor.needs_recycle)

    def test_needs_recycle_true_after_max_jobs_reached(self) -> None:
        executor = _executor(max_jobs=2)
        self.assertFalse(executor.needs_recycle)

        for _ in range(2):
            executor.run_problem(
                _problem(),
                "def add(a, b):\n    return a + b\n",
                max_output_chars=2000,
                include_hidden=False,
                detail_mode="all",
                isolate=_isolate_config(),
            )
        self.assertTrue(executor.needs_recycle)
        self.assertEqual(executor.job_count, 2)

    def test_multiple_sequential_jobs_all_succeed(self) -> None:
        executor = _executor()

        for i in range(3):
            result = executor.run_problem(
                _problem(),
                "def add(a, b):\n    return a + b\n",
                max_output_chars=2000,
                include_hidden=False,
                detail_mode="all",
                isolate=_isolate_config(),
            )
            self.assertEqual(result.get("status"), "Accepted", f"job {i + 1} failed")

        self.assertEqual(executor.job_count, 3)


class CgroupV2SandboxTests(TestCase):
    def test_unavailable_on_non_linux(self) -> None:
        if sys.platform.startswith("linux"):
            self.skipTest("test verifies non-Linux fallback")
        sandbox = _CgroupV2Sandbox()
        self.assertFalse(sandbox.available)

    def test_graceful_fallback_when_proc_cgroup_missing(self) -> None:
        with patch("judge.warm_executor.Path.read_text", side_effect=OSError("no such file")):
            sandbox = _CgroupV2Sandbox()
        self.assertFalse(sandbox.available)

    def test_create_child_returns_none_when_unavailable(self) -> None:
        sandbox = _CgroupV2Sandbox.__new__(_CgroupV2Sandbox)
        sandbox._root = None  # noqa: SLF001
        result = sandbox.create_child("test", memory_bytes=1024, pids_max=10)
        self.assertIsNone(result)

    def test_was_oom_killed_returns_false_when_no_events(self) -> None:
        sandbox = _CgroupV2Sandbox.__new__(_CgroupV2Sandbox)
        sandbox._root = None  # noqa: SLF001
        self.assertFalse(sandbox.was_oom_killed(Path("/nonexistent")))
