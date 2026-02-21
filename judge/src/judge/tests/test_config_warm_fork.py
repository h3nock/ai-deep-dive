"""Settings parsing tests for warm torch execution mode."""

from __future__ import annotations

import os
from unittest import TestCase
from unittest.mock import patch

from judge.config import load_settings


class WarmForkSettingsTests(TestCase):
    def test_defaults_use_isolate_mode(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            settings = load_settings()

        self.assertEqual(settings.torch_execution_mode, "isolate")
        self.assertTrue(settings.warm_fork_enable_no_new_privs)
        self.assertTrue(settings.warm_fork_enable_seccomp)
        self.assertTrue(settings.warm_fork_seccomp_fail_closed)
        self.assertTrue(settings.warm_fork_clear_env)
        self.assertTrue(settings.warm_fork_deny_filesystem)
        self.assertFalse(settings.warm_fork_allow_root)
        self.assertEqual(settings.warm_fork_child_nofile, 64)
        self.assertTrue(settings.warm_fork_enable_cgroup)
        self.assertEqual(settings.warm_fork_max_jobs, 0)

    def test_explicit_warm_fork_settings_parse(self) -> None:
        with patch.dict(
            os.environ,
            {
                "JUDGE_TORCH_EXECUTION_MODE": "warm_fork",
                "JUDGE_WARM_FORK_ENABLE_NO_NEW_PRIVS": "0",
                "JUDGE_WARM_FORK_ENABLE_SECCOMP": "0",
                "JUDGE_WARM_FORK_SECCOMP_FAIL_CLOSED": "0",
                "JUDGE_WARM_FORK_CLEAR_ENV": "0",
                "JUDGE_WARM_FORK_DENY_FILESYSTEM": "0",
                "JUDGE_WARM_FORK_ALLOW_ROOT": "1",
                "JUDGE_WARM_FORK_CHILD_NOFILE": "128",
                "JUDGE_WARM_FORK_ENABLE_CGROUP": "0",
                "JUDGE_WARM_FORK_MAX_JOBS": "500",
            },
            clear=True,
        ):
            settings = load_settings()

        self.assertEqual(settings.torch_execution_mode, "warm_fork")
        self.assertFalse(settings.warm_fork_enable_no_new_privs)
        self.assertFalse(settings.warm_fork_enable_seccomp)
        self.assertFalse(settings.warm_fork_seccomp_fail_closed)
        self.assertFalse(settings.warm_fork_clear_env)
        self.assertFalse(settings.warm_fork_deny_filesystem)
        self.assertTrue(settings.warm_fork_allow_root)
        self.assertEqual(settings.warm_fork_child_nofile, 128)
        self.assertFalse(settings.warm_fork_enable_cgroup)
        self.assertEqual(settings.warm_fork_max_jobs, 500)

    def test_invalid_torch_execution_mode_is_rejected(self) -> None:
        with patch.dict(
            os.environ,
            {"JUDGE_TORCH_EXECUTION_MODE": "fork_magic"},
            clear=True,
        ):
            with self.assertRaisesRegex(
                ValueError,
                "JUDGE_TORCH_EXECUTION_MODE must be one of: isolate, warm_fork",
            ):
                load_settings()

    def test_invalid_warm_fork_nofile_limit_is_rejected(self) -> None:
        with patch.dict(
            os.environ,
            {"JUDGE_WARM_FORK_CHILD_NOFILE": "8"},
            clear=True,
        ):
            with self.assertRaisesRegex(
                ValueError,
                "JUDGE_WARM_FORK_CHILD_NOFILE must be >= 16",
            ):
                load_settings()

    def test_seccomp_requires_no_new_privs(self) -> None:
        with patch.dict(
            os.environ,
            {
                "JUDGE_WARM_FORK_ENABLE_SECCOMP": "1",
                "JUDGE_WARM_FORK_ENABLE_NO_NEW_PRIVS": "0",
            },
            clear=True,
        ):
            with self.assertRaisesRegex(
                ValueError,
                "JUDGE_WARM_FORK_ENABLE_NO_NEW_PRIVS must be enabled when JUDGE_WARM_FORK_ENABLE_SECCOMP=1",
            ):
                load_settings()
