"""Worker dependency wiring tests for torch execution modes."""

from __future__ import annotations

import sys
import types
from pathlib import Path
from unittest import TestCase
from unittest.mock import Mock, patch

from judge.config import Settings
from judge.runner import run_problem
from judge.worker import build_worker_dependencies


def _settings(*, torch_execution_mode: str) -> Settings:
    return Settings(
        redis_url="redis://localhost:6379/0",
        results_db=Path("/tmp/judge-deps-test.db"),
        problems_root=Path("/tmp/problems"),
        max_output_chars=2000,
        queue_maxlen=10000,
        job_claim_idle_ms=30000,
        job_claim_count=10,
        isolate_bin="/usr/bin/isolate",
        isolate_use_cgroups=True,
        isolate_process_limit=64,
        isolate_wall_time_extra_s=2,
        isolate_timeout_grace_s=5,
        isolate_fsize_kb=1024,
        python_bin=sys.executable,
        torch_execution_mode=torch_execution_mode,
        warm_fork_enable_no_new_privs=True,
        warm_fork_enable_seccomp=True,
        warm_fork_seccomp_fail_closed=True,
        warm_fork_clear_env=True,
        warm_fork_deny_filesystem=True,
        warm_fork_allow_root=False,
        warm_fork_child_nofile=64,
        allowed_origins=[],
    )


def _fake_dependency_modules(
    *,
    queue_obj: object,
    results_obj: object,
    problems_obj: object,
) -> dict[str, types.ModuleType]:
    queue_module = types.ModuleType("judge.queue")
    queue_module.RedisQueue = lambda *_args, **_kwargs: queue_obj

    results_module = types.ModuleType("judge.results")
    results_module.ResultsStore = lambda *_args, **_kwargs: results_obj

    problems_module = types.ModuleType("judge.problems")
    problems_module.ProblemRepository = lambda *_args, **_kwargs: problems_obj

    return {
        "judge.queue": queue_module,
        "judge.results": results_module,
        "judge.problems": problems_module,
    }


class WorkerDependencyWiringTests(TestCase):
    def test_torch_stream_uses_warm_executor_when_enabled(self) -> None:
        queue_obj = Mock()
        results_obj = Mock()
        problems_obj = Mock()
        warm_executor_instance = Mock()

        with (
            patch.dict(
                sys.modules,
                _fake_dependency_modules(
                    queue_obj=queue_obj,
                    results_obj=results_obj,
                    problems_obj=problems_obj,
                ),
            ),
            patch("judge.worker.WarmForkExecutor", return_value=warm_executor_instance) as warm_cls,
        ):
            deps = build_worker_dependencies(
                stream="queue:torch",
                consumer="torch-1",
                settings=_settings(torch_execution_mode="warm_fork"),
            )

        warm_cls.assert_called_once_with(
            enable_no_new_privs=True,
            enable_seccomp=True,
            seccomp_fail_closed=True,
            clear_env=True,
            deny_filesystem=True,
            allow_root=False,
            child_nofile_limit=64,
        )
        self.assertIs(deps.execution.run_problem_fn, warm_executor_instance.run_problem)

    def test_torch_stream_defaults_to_isolate_executor(self) -> None:
        queue_obj = Mock()
        results_obj = Mock()
        problems_obj = Mock()

        with (
            patch.dict(
                sys.modules,
                _fake_dependency_modules(
                    queue_obj=queue_obj,
                    results_obj=results_obj,
                    problems_obj=problems_obj,
                ),
            ),
            patch("judge.worker.WarmForkExecutor") as warm_cls,
        ):
            deps = build_worker_dependencies(
                stream="queue:torch",
                consumer="torch-1",
                settings=_settings(torch_execution_mode="isolate"),
            )

        warm_cls.assert_not_called()
        self.assertIs(deps.execution.run_problem_fn, run_problem)

    def test_light_stream_never_uses_warm_executor(self) -> None:
        queue_obj = Mock()
        results_obj = Mock()
        problems_obj = Mock()

        with (
            patch.dict(
                sys.modules,
                _fake_dependency_modules(
                    queue_obj=queue_obj,
                    results_obj=results_obj,
                    problems_obj=problems_obj,
                ),
            ),
            patch("judge.worker.WarmForkExecutor") as warm_cls,
        ):
            deps = build_worker_dependencies(
                stream="queue:light",
                consumer="light-1",
                settings=_settings(torch_execution_mode="warm_fork"),
            )

        warm_cls.assert_not_called()
        self.assertIs(deps.execution.run_problem_fn, run_problem)
