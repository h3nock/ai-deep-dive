"""Worker queue-entry processing contract tests."""

from __future__ import annotations

from unittest import TestCase
from unittest.mock import Mock, patch

from judge.services import WorkerExecutionOutcome
from judge.worker import _process_queue_entry


class WorkerProcessEntryTests(TestCase):
    def _run_entry(
        self,
        *,
        fields: dict[str, str],
        execution_outcome: WorkerExecutionOutcome | None = None,
    ) -> tuple[Mock, Mock, Mock]:
        queue = Mock()
        results = Mock()
        execution = Mock()
        if execution_outcome is not None:
            execution.execute.return_value = execution_outcome

        with (
            patch("judge.worker.logger"),
            patch("judge.worker.worker_heartbeat"),
            patch("judge.worker.job_started"),
            patch("judge.worker.observe_job_queue_wait"),
            patch("judge.worker.observe_job_duration"),
            patch("judge.worker.job_finished"),
        ):
            _process_queue_entry(
                stream="queue:light",
                group="workers-light",
                consumer="light-1",
                worker_profile="light",
                msg_id="1-0",
                fields=fields,
                queue=queue,
                results=results,
                execution=execution,
            )
        return queue, results, execution

    def test_invalid_payload_without_job_id_is_acked_and_not_executed(self) -> None:
        queue, results, execution = self._run_entry(fields={"problem_key": "sample/01-basics/01-add"})

        execution.execute.assert_not_called()
        results.mark_error.assert_not_called()
        queue.ack_and_delete.assert_called_once_with("queue:light", "workers-light", "1-0")

    def test_invalid_payload_with_job_id_is_persisted_and_acked(self) -> None:
        fields = {
            "job_id": "job-invalid",
            "problem_key": "sample/01-basics/01-add",
            "kind": "submit",
            "code": "pass",
            "created_at": "not-a-number",
        }
        queue, results, execution = self._run_entry(fields=fields)

        execution.execute.assert_not_called()
        results.mark_error.assert_called_once()
        queue.ack_and_delete.assert_called_once_with("queue:light", "workers-light", "1-0")

    def test_processed_job_is_acked_when_execution_requests_ack(self) -> None:
        fields = {
            "job_id": "job-ack",
            "problem_key": "sample/01-basics/01-add",
            "kind": "submit",
            "code": "pass",
            "created_at": "1700000000",
        }
        queue, results, execution = self._run_entry(
            fields=fields,
            execution_outcome=WorkerExecutionOutcome(
                executed=False,
                status="skipped",
                error_kind="none",
                should_ack=True,
            ),
        )

        results.mark_error.assert_not_called()
        execution.execute.assert_called_once()
        queue.ack_and_delete.assert_called_once_with("queue:light", "workers-light", "1-0")

    def test_processed_job_is_not_acked_when_execution_disables_ack(self) -> None:
        fields = {
            "job_id": "job-no-ack",
            "problem_key": "sample/01-basics/01-add",
            "kind": "submit",
            "code": "pass",
            "created_at": "1700000000",
        }
        queue, results, execution = self._run_entry(
            fields=fields,
            execution_outcome=WorkerExecutionOutcome(
                executed=True,
                status="error",
                error_kind="internal",
                should_ack=False,
            ),
        )

        results.mark_error.assert_not_called()
        execution.execute.assert_called_once()
        queue.ack_and_delete.assert_not_called()
