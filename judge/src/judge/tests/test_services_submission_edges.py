"""Submission service edge-case tests."""

from __future__ import annotations

from unittest import TestCase
from unittest.mock import Mock

from judge.problems import ProblemRouteInfo
from judge.services import (
    DEFAULT_STREAM_ROUTING,
    InvalidProblemError,
    ProblemNotFoundError,
    QueueFullError,
    QueueUnavailableError,
    SubmissionService,
)


class SubmissionServiceEdgeTests(TestCase):
    def _problem(self) -> ProblemRouteInfo:
        return ProblemRouteInfo(
            id="sample/01-basics/01-add",
            version="v1",
            requires_torch=False,
            time_limit_s=5,
            memory_mb=1024,
        )

    def test_submit_raises_problem_not_found(self) -> None:
        queue = Mock()
        results = Mock()
        problems = Mock()
        problems.get_route_info.side_effect = FileNotFoundError("missing")
        service = SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )

        with self.assertRaises(ProblemNotFoundError):
            service.submit(problem_key="sample/missing", kind="submit", code="pass")

        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_raises_invalid_problem_id(self) -> None:
        queue = Mock()
        results = Mock()
        problems = Mock()
        problems.get_route_info.side_effect = ValueError("invalid problem id")
        service = SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )

        with self.assertRaises(InvalidProblemError):
            service.submit(problem_key="bad//id", kind="submit", code="pass")

        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_raises_queue_unavailable_when_backlog_check_fails(self) -> None:
        queue = Mock()
        queue.backlog.side_effect = RuntimeError("redis down")
        results = Mock()
        problems = Mock()
        problems.get_route_info.return_value = self._problem()
        service = SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )

        with self.assertRaises(QueueUnavailableError):
            service.submit(
                problem_key="sample/01-basics/01-add",
                kind="submit",
                code="def add(a, b):\n    return a + b\n",
            )

        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_raises_queue_full_when_backlog_reaches_limit(self) -> None:
        queue = Mock()
        queue.backlog.return_value = 100
        results = Mock()
        problems = Mock()
        problems.get_route_info.return_value = self._problem()
        service = SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )

        with self.assertRaises(QueueFullError):
            service.submit(
                problem_key="sample/01-basics/01-add",
                kind="submit",
                code="def add(a, b):\n    return a + b\n",
            )

        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_persists_internal_error_when_enqueue_fails(self) -> None:
        queue = Mock()
        queue.backlog.return_value = 0
        queue.enqueue.side_effect = RuntimeError("enqueue failed")
        results = Mock()
        problems = Mock()
        problems.get_route_info.return_value = self._problem()
        service = SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
            job_id_factory=lambda: "job-enqueue-fail",
            now_factory=lambda: 1700000000,
        )

        with self.assertRaises(QueueUnavailableError):
            service.submit(
                problem_key="sample/01-basics/01-add",
                kind="submit",
                code="def add(a, b):\n    return a + b\n",
            )

        results.create_job.assert_called_once_with(
            "job-enqueue-fail",
            "sample/01-basics/01-add",
            "light",
            "submit",
            created_at=1700000000,
        )
        results.mark_error.assert_called_once_with(
            "job-enqueue-fail",
            "Failed to enqueue job",
            error_kind="internal",
        )
