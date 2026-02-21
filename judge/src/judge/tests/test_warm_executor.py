"""Warm fork executor behavior tests."""

from __future__ import annotations

import ctypes.util
import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from judge.problems import Comparison, Problem
from judge.problems import TestCase as ProblemTestCase
from judge.runner import IsolateConfig
from judge.warm_executor import (
    _SECCOMP_DENY_FILE_METADATA_SYSCALLS,
    WarmForkExecutor,
    WarmForkUnavailableError,
    _SECCOMP_DENY_SYSCALLS,
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
        requires_torch=True,
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
        requires_torch=True,
        time_limit_s=1,
        memory_mb=256,
        comparison=Comparison(type="exact", rtol=1e-5, atol=1e-8),
        public_tests=[public_case],
        hidden_tests=[],
    )


class WarmForkExecutorTests(TestCase):
    def test_run_problem_returns_accepted_for_valid_solution(self) -> None:
        executor = WarmForkExecutor(
            enable_no_new_privs=False,
            child_nofile_limit=64,
            preload_torch=False,
        )

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
        executor = WarmForkExecutor(
            enable_no_new_privs=False,
            child_nofile_limit=64,
            preload_torch=False,
        )

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
        executor = WarmForkExecutor(
            enable_no_new_privs=False,
            child_nofile_limit=64,
            preload_torch=False,
        )

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
        executor = WarmForkExecutor(
            enable_no_new_privs=False,
            enable_seccomp=False,
            clear_env=True,
            child_nofile_limit=64,
            preload_torch=False,
        )
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
            WarmForkExecutor(
                enable_no_new_privs=False,
                enable_seccomp=True,
                preload_torch=False,
            )

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

        executor = WarmForkExecutor(
            enable_no_new_privs=True,
            enable_seccomp=True,
            seccomp_fail_closed=True,
            clear_env=True,
            deny_filesystem=True,
            allow_root=True,
            preload_torch=False,
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
        executor = WarmForkExecutor(
            enable_no_new_privs=True,
            enable_seccomp=True,
            seccomp_fail_closed=False,
            clear_env=True,
            allow_root=True,
            preload_torch=False,
        )
        calls: list[str] = []

        with (
            tempfile.TemporaryDirectory(prefix="warm-order-test-") as tmp_dir,
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
                workspace=Path(tmp_dir),
                problem=_problem(),
                isolate=_isolate_config(),
            )

        self.assertEqual(calls, ["nnp", "limits", "seccomp", "fds"])
