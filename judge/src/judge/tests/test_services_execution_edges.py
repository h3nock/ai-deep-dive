"""Worker execution service edge-case tests."""

from __future__ import annotations

from unittest import TestCase
from unittest.mock import Mock

from judge.runner import IsolateConfig
from judge.services import WorkerExecutionService, WorkerJob


class WorkerExecutionServiceEdgeTests(TestCase):
    def _service(
        self,
        *,
        results: Mock,
        problems: Mock,
        run_problem_fn,
    ) -> WorkerExecutionService:
        return WorkerExecutionService(
            results=results,
            problems=problems,
            isolate=IsolateConfig(executable="/usr/bin/isolate", box_id=1),
            max_output_chars=2000,
            run_problem_fn=run_problem_fn,
            log=Mock(),
        )

    def test_run_kind_uses_public_mode(self) -> None:
        results = Mock()
        results.mark_running.return_value = True
        results.mark_done.return_value = True
        problems = Mock()
        problems.get_for_run.return_value = {"id": "run-problem"}
        run_problem_fn = Mock(return_value={"status": "Accepted", "summary": {}, "tests": [], "error": None})
        service = self._service(results=results, problems=problems, run_problem_fn=run_problem_fn)

        outcome = service.execute(
            WorkerJob(
                job_id="job-run",
                problem_key="sample/01-basics/01-add",
                kind="run",
                code="def add(a, b):\n    return a + b\n",
            )
        )

        self.assertTrue(outcome.executed)
        self.assertEqual(outcome.status, "done")
        problems.get_for_run.assert_called_once_with("sample/01-basics/01-add")
        run_problem_fn.assert_called_once()
        self.assertEqual(run_problem_fn.call_args.kwargs["include_hidden"], False)
        self.assertEqual(run_problem_fn.call_args.kwargs["detail_mode"], "all")

    def test_submit_kind_uses_hidden_mode(self) -> None:
        results = Mock()
        results.mark_running.return_value = True
        results.mark_done.return_value = True
        problems = Mock()
        problems.get_for_submit.return_value = {"id": "submit-problem"}
        run_problem_fn = Mock(return_value={"status": "Accepted", "summary": {}, "tests": [], "error": None})
        service = self._service(results=results, problems=problems, run_problem_fn=run_problem_fn)

        outcome = service.execute(
            WorkerJob(
                job_id="job-submit",
                problem_key="sample/01-basics/01-add",
                kind="submit",
                code="def add(a, b):\n    return a + b\n",
            )
        )

        self.assertTrue(outcome.executed)
        self.assertEqual(outcome.status, "done")
        problems.get_for_submit.assert_called_once_with("sample/01-basics/01-add")
        run_problem_fn.assert_called_once()
        self.assertEqual(run_problem_fn.call_args.kwargs["include_hidden"], True)
        self.assertEqual(run_problem_fn.call_args.kwargs["detail_mode"], "first_failure")

    def test_invalid_kind_is_persisted_as_internal_error(self) -> None:
        results = Mock()
        results.mark_running.return_value = True
        results.mark_error.return_value = True
        problems = Mock()
        run_problem_fn = Mock()
        service = self._service(results=results, problems=problems, run_problem_fn=run_problem_fn)

        outcome = service.execute(
            WorkerJob(
                job_id="job-invalid",
                problem_key="sample/01-basics/01-add",
                kind="invalid-kind",
                code="pass",
            )
        )

        self.assertTrue(outcome.executed)
        self.assertEqual(outcome.status, "error")
        self.assertEqual(outcome.error_kind, "internal")
        self.assertTrue(outcome.should_ack)
        run_problem_fn.assert_not_called()
        results.mark_error.assert_called_once()

    def test_unpersistable_worker_exception_disables_ack(self) -> None:
        results = Mock()
        results.mark_running.return_value = True
        results.mark_error.side_effect = RuntimeError("db unavailable")
        problems = Mock()

        def _raise(*_args, **_kwargs):
            raise RuntimeError("runner failed")

        service = self._service(results=results, problems=problems, run_problem_fn=_raise)

        outcome = service.execute(
            WorkerJob(
                job_id="job-no-ack",
                problem_key="sample/01-basics/01-add",
                kind="submit",
                code="pass",
            )
        )

        self.assertTrue(outcome.executed)
        self.assertEqual(outcome.status, "error")
        self.assertEqual(outcome.error_kind, "internal")
        self.assertFalse(outcome.should_ack)
