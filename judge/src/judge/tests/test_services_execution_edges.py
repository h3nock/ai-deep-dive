"""Worker execution service edge-case tests."""

from __future__ import annotations

from unittest import TestCase
from unittest.mock import Mock

from judge.problems import ArgumentSpec, Comparison, ProblemSpec
from judge.runner import IsolateConfig
from judge.services import WorkerExecutionService, WorkerJob


class WorkerExecutionServiceEdgeTests(TestCase):
    def _service(
        self,
        *,
        results: Mock,
        problems: Mock,
        run_execution_plan_fn,
    ) -> WorkerExecutionService:
        return WorkerExecutionService(
            results=results,
            problems=problems,
            isolate=IsolateConfig(executable="/usr/bin/isolate", box_id=1),
            max_output_chars=2000,
            run_execution_plan_fn=run_execution_plan_fn,
            log=Mock(),
        )

    def test_run_operation_builds_plan_from_compiled_cases(self) -> None:
        results = Mock()
        results.mark_running.return_value = True
        results.mark_done.return_value = True
        problems = Mock()
        problems.get_problem_spec.return_value = ProblemSpec(
            problem_id="sample/01-basics/01-add",
            arguments=(ArgumentSpec("a"), ArgumentSpec("b")),
            runner="add(a, b)",
            execution_profile="light",
            comparison=Comparison(type="exact"),
            time_limit_s=5,
            memory_mb=512,
        )
        run_execution_plan_fn = Mock(return_value={"status": "Accepted", "summary": {}, "tests": [], "error": None})
        service = self._service(results=results, problems=problems, run_execution_plan_fn=run_execution_plan_fn)
        service.plan_factory = Mock()
        service.plan_factory.build_run_plan.return_value = {"id": "run-plan"}

        outcome = service.execute(
            WorkerJob(
                job_id="job-run",
                problem_id="sample/01-basics/01-add",
                operation="run",
                code="def add(a, b):\n    return a + b\n",
                cases_payload=[
                    {
                        "id": "case1",
                        "input_code": "a = 1\nb = 2\n",
                        "expected_literal": "3",
                    }
                ],
            )
        )

        self.assertTrue(outcome.executed)
        self.assertEqual(outcome.status, "done")
        problems.get_problem_spec.assert_called_once_with("sample/01-basics/01-add")
        service.plan_factory.build_run_plan.assert_called_once()
        run_execution_plan_fn.assert_called_once()

    def test_submit_operation_uses_submit_plan(self) -> None:
        results = Mock()
        results.mark_running.return_value = True
        results.mark_done.return_value = True
        problems = Mock()
        run_execution_plan_fn = Mock(return_value={"status": "Accepted", "summary": {}, "tests": [], "error": None})
        service = self._service(results=results, problems=problems, run_execution_plan_fn=run_execution_plan_fn)
        service.plan_factory = Mock()
        service.plan_factory.build_submit_plan.return_value = {"id": "submit-plan"}

        outcome = service.execute(
            WorkerJob(
                job_id="job-submit",
                problem_id="sample/01-basics/01-add",
                operation="submit",
                code="def add(a, b):\n    return a + b\n",
            )
        )

        self.assertTrue(outcome.executed)
        self.assertEqual(outcome.status, "done")
        service.plan_factory.build_submit_plan.assert_called_once_with("sample/01-basics/01-add")
        run_execution_plan_fn.assert_called_once()

    def test_invalid_operation_is_persisted_as_internal_error(self) -> None:
        results = Mock()
        results.mark_running.return_value = True
        results.mark_error.return_value = True
        problems = Mock()
        run_execution_plan_fn = Mock()
        service = self._service(results=results, problems=problems, run_execution_plan_fn=run_execution_plan_fn)

        outcome = service.execute(
            WorkerJob(
                job_id="job-invalid",
                problem_id="sample/01-basics/01-add",
                operation="invalid",
                code="pass",
            )
        )

        self.assertTrue(outcome.executed)
        self.assertEqual(outcome.status, "error")
        self.assertEqual(outcome.error_kind, "internal")
        self.assertTrue(outcome.should_ack)
        results.mark_error.assert_called_once()

    def test_unpersistable_worker_exception_disables_ack(self) -> None:
        results = Mock()
        results.mark_running.return_value = True
        results.mark_error.side_effect = RuntimeError("db unavailable")
        problems = Mock()

        def _raise(*_args, **_kwargs):
            raise RuntimeError("runner failed")

        service = self._service(results=results, problems=problems, run_execution_plan_fn=_raise)
        service.plan_factory = Mock()
        service.plan_factory.build_submit_plan.return_value = {"id": "submit-plan"}

        outcome = service.execute(
            WorkerJob(
                job_id="job-no-ack",
                problem_id="sample/01-basics/01-add",
                operation="submit",
                code="pass",
            )
        )

        self.assertTrue(outcome.executed)
        self.assertEqual(outcome.status, "error")
        self.assertEqual(outcome.error_kind, "internal")
        self.assertFalse(outcome.should_ack)
