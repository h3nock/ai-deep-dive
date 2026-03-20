"""Submission service edge-case tests."""

from __future__ import annotations

from unittest import TestCase
from unittest.mock import Mock

from judge.problems import ArgumentSpec, Comparison, ProblemSpec, TestCase as ProblemTestCase, TestCaseCompiler
from judge.services import (
    DEFAULT_STREAM_ROUTING,
    InvalidProblemError,
    InvalidRunRequestError,
    ProblemNotFoundError,
    QueueFullError,
    QueueUnavailableError,
    SubmissionService,
)


class SubmissionServiceEdgeTests(TestCase):
    def _problem(self) -> ProblemSpec:
        return ProblemSpec(
            problem_id="sample/01-basics/01-add",
            arguments=(ArgumentSpec("a"), ArgumentSpec("b")),
            runner="add(a, b)",
            execution_profile="light",
            comparison=Comparison(type="exact"),
            time_limit_s=5,
            memory_mb=1024,
        )

    def test_submit_raises_problem_not_found(self) -> None:
        queue = Mock()
        results = Mock()
        problems = Mock()
        problems.get_problem_spec.side_effect = FileNotFoundError("missing")
        service = SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )

        with self.assertRaises(ProblemNotFoundError):
            service.enqueue_submit(problem_id="sample/missing", code="pass")

        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_raises_invalid_problem_id(self) -> None:
        queue = Mock()
        results = Mock()
        problems = Mock()
        problems.get_problem_spec.side_effect = ValueError("invalid problem id")
        service = SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )

        with self.assertRaises(InvalidProblemError):
            service.enqueue_submit(problem_id="bad//id", code="pass")

        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_raises_queue_unavailable_when_backlog_check_fails(self) -> None:
        queue = Mock()
        queue.backlog.side_effect = RuntimeError("redis down")
        results = Mock()
        problems = Mock()
        problems.get_problem_spec.return_value = self._problem()
        service = SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )

        with self.assertRaises(QueueUnavailableError):
            service.enqueue_submit(
                problem_id="sample/01-basics/01-add",
                code="def add(a, b):\n    return a + b\n",
            )

        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_raises_queue_full_when_backlog_reaches_limit(self) -> None:
        queue = Mock()
        queue.backlog.return_value = 100
        results = Mock()
        problems = Mock()
        problems.get_problem_spec.return_value = self._problem()
        service = SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )

        with self.assertRaises(QueueFullError):
            service.enqueue_submit(
                problem_id="sample/01-basics/01-add",
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
        problems.get_problem_spec.return_value = self._problem()
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
            service.enqueue_submit(
                problem_id="sample/01-basics/01-add",
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

    def test_enqueue_run_raises_invalid_run_request_for_bad_cases(self) -> None:
        queue = Mock()
        results = Mock()
        problems = Mock()
        problems.get_problem_spec.return_value = self._problem()
        problems.compiler = TestCaseCompiler()
        service = SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )

        with self.assertRaises(InvalidRunRequestError):
            service.enqueue_run(
                problem_id="sample/01-basics/01-add",
                code="def add(a, b):\n    return a + b\n",
                cases=[
                    ProblemTestCase(
                        id="case1",
                        inputs={"a": "1", "c": "2"},
                        expected_literal="3",
                    )
                ],
            )

        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()
