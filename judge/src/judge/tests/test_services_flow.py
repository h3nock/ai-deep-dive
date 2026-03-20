"""Integration-style flow tests for run/submit services."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest import TestCase

from judge.problems import (
    ArgumentSpec,
    CompiledTestCase,
    Comparison,
    ProblemSpec,
    TestCaseCompiler,
)
from judge.results import ResultsStore
from judge.runner import IsolateConfig
from judge.services import (
    DEFAULT_STREAM_ROUTING,
    SubmissionService,
    WorkerExecutionService,
    WorkerJob,
)


class _InMemoryQueue:
    def __init__(self, *, backlog_value: int = 0) -> None:
        self.backlog_value = backlog_value
        self.enqueued: list[tuple[str, dict[str, object]]] = []

    def backlog(self, stream: str, group: str) -> int:
        return self.backlog_value

    def enqueue(self, stream: str, payload: dict[str, object]) -> str:
        self.enqueued.append((stream, dict(payload)))
        return "1-0"


class _ProblemRepositoryStub:
    def __init__(self, problem_id: str) -> None:
        self.problem_id = problem_id
        self.compiler = TestCaseCompiler()

    def get_problem_spec(self, problem_id: str) -> ProblemSpec:
        if problem_id != self.problem_id:
            raise FileNotFoundError(problem_id)
        return ProblemSpec(
            problem_id=self.problem_id,
            arguments=(ArgumentSpec("a"), ArgumentSpec("b")),
            runner="add(a, b)",
            execution_profile="light",
            comparison=Comparison(type="exact"),
            time_limit_s=10,
            memory_mb=1024,
        )

    def get_compiled_public_cases(self, problem_id: str) -> list[CompiledTestCase]:
        if problem_id != self.problem_id:
            raise FileNotFoundError(problem_id)
        return [
            CompiledTestCase(
                id="case-public",
                input_code="a = 1\nb = 2\n",
                expected_literal="3",
            )
        ]

    def get_hidden_cases(self, problem_id: str) -> list[CompiledTestCase]:
        if problem_id != self.problem_id:
            raise FileNotFoundError(problem_id)
        return [
            CompiledTestCase(
                id="case-hidden",
                input_code="a = 5\nb = 6\n",
                expected_literal="11",
            )
        ]


class ServicesFlowTests(TestCase):
    def test_submit_then_execute_persists_done_result(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            store = ResultsStore(Path(tmp_dir) / "judge.db")
            queue = _InMemoryQueue()
            problems = _ProblemRepositoryStub("sample/01-basics/01-add")

            submission = SubmissionService(
                queue=queue,
                results=store,
                problems=problems,
                queue_maxlen=100,
                stream_routing=DEFAULT_STREAM_ROUTING,
                job_id_factory=lambda: "job-accepted",
                now_factory=lambda: 1700000000,
            )

            submitted = submission.enqueue_submit(
                problem_id="sample/01-basics/01-add",
                code="def add(a, b):\n    return a + b\n",
            )

            self.assertEqual(submitted.job_id, "job-accepted")
            self.assertEqual(submitted.status, "queued")
            self.assertEqual(len(queue.enqueued), 1)

            _, payload = queue.enqueued[0]

            def _run_execution_plan_ok(*_args, **_kwargs):
                return {
                    "status": "Accepted",
                    "summary": {
                        "total": 2,
                        "passed": 2,
                        "failed": 0,
                    },
                    "tests": [],
                    "error": None,
                }

            execution = WorkerExecutionService(
                results=store,
                problems=problems,
                isolate=IsolateConfig(executable="/usr/bin/isolate", box_id=1),
                max_output_chars=2000,
                run_execution_plan_fn=_run_execution_plan_ok,
            )

            started = {"called": False}

            outcome = execution.execute(
                WorkerJob(
                    job_id=str(payload["job_id"]),
                    problem_id=str(payload["problem_id"]),
                    operation=str(payload["operation"]),
                    code=str(payload["code"]),
                ),
                on_started=lambda: started.__setitem__("called", True),
            )

            self.assertTrue(started["called"])
            self.assertTrue(outcome.executed)
            self.assertEqual(outcome.status, "done")
            self.assertEqual(outcome.error_kind, "none")
            self.assertTrue(outcome.should_ack)

            job = store.get_job("job-accepted")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job["status"], "done")
        self.assertEqual(job["attempts"], 1)
        self.assertEqual(
            job["result"],
            {
                "status": "Accepted",
                "summary": {
                    "total": 2,
                    "passed": 2,
                    "failed": 0,
                },
                "tests": [],
                "error": None,
            },
        )

    def test_submit_then_execute_persists_runner_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            store = ResultsStore(Path(tmp_dir) / "judge.db")
            queue = _InMemoryQueue()
            problems = _ProblemRepositoryStub("sample/01-basics/01-add")

            submission = SubmissionService(
                queue=queue,
                results=store,
                problems=problems,
                queue_maxlen=100,
                stream_routing=DEFAULT_STREAM_ROUTING,
                job_id_factory=lambda: "job-error",
                now_factory=lambda: 1700000000,
            )

            submission.enqueue_submit(
                problem_id="sample/01-basics/01-add",
                code="def add(a, b):\n    raise RuntimeError('bad')\n",
            )
            _, payload = queue.enqueued[0]

            def _run_execution_plan_error(*_args, **_kwargs):
                return {
                    "status": "Runtime Error",
                    "summary": {
                        "total": 2,
                        "passed": 0,
                        "failed": 2,
                    },
                    "tests": [],
                    "error": "Line 2: RuntimeError: bad",
                    "error_kind": "user",
                }

            execution = WorkerExecutionService(
                results=store,
                problems=problems,
                isolate=IsolateConfig(executable="/usr/bin/isolate", box_id=1),
                max_output_chars=2000,
                run_execution_plan_fn=_run_execution_plan_error,
            )

            outcome = execution.execute(
                WorkerJob(
                    job_id=str(payload["job_id"]),
                    problem_id=str(payload["problem_id"]),
                    operation=str(payload["operation"]),
                    code=str(payload["code"]),
                )
            )

            self.assertTrue(outcome.executed)
            self.assertEqual(outcome.status, "error")
            self.assertEqual(outcome.error_kind, "user")
            self.assertTrue(outcome.should_ack)

            job = store.get_job("job-error")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job["status"], "error")
        self.assertEqual(job["error"], "Line 2: RuntimeError: bad")
        self.assertEqual(job["error_kind"], "user")

    def test_execution_skips_terminal_job_without_reprocessing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            store = ResultsStore(Path(tmp_dir) / "judge.db")
            problems = _ProblemRepositoryStub("sample/01-basics/01-add")

            store.create_job(
                job_id="job-terminal",
                problem_id="sample/01-basics/01-add",
                profile="light",
                operation="submit",
                created_at=1700000000,
            )
            self.assertTrue(store.mark_running("job-terminal"))
            self.assertTrue(store.mark_done("job-terminal", {"status": "Accepted"}))

            execution = WorkerExecutionService(
                results=store,
                problems=problems,
                isolate=IsolateConfig(executable="/usr/bin/isolate", box_id=1),
                max_output_chars=2000,
            )

            outcome = execution.execute(
                WorkerJob(
                    job_id="job-terminal",
                    problem_id="sample/01-basics/01-add",
                    operation="submit",
                    code="def add(a, b):\n    return a + b\n",
                )
            )

        self.assertFalse(outcome.executed)
        self.assertEqual(outcome.status, "skipped")
        self.assertEqual(outcome.error_kind, "none")
        self.assertTrue(outcome.should_ack)
