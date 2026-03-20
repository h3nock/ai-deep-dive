"""End-to-end submit/result flow tests across API, services, and store."""

from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path
from types import SimpleNamespace
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

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None
HAS_HTTPX = importlib.util.find_spec("httpx") is not None


class _InMemoryQueue:
    def __init__(self) -> None:
        self.enqueued: list[tuple[str, dict[str, object]]] = []

    def backlog(self, stream: str, group: str) -> int:
        _ = stream, group
        return 0

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
            time_limit_s=5,
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


class EndToEndSubmitResultFlowTests(TestCase):
    def setUp(self) -> None:
        if not HAS_FASTAPI or not HAS_HTTPX:
            self.skipTest("fastapi/httpx dependencies not installed")

        from fastapi.testclient import TestClient

        from judge.api import ApiDependencies, create_app

        self.TestClient = TestClient
        self.ApiDependencies = ApiDependencies
        self.create_app = create_app

    def _build_client(self, *, queue: _InMemoryQueue, store: ResultsStore, problems: _ProblemRepositoryStub):
        submission = SubmissionService(
            queue=queue,
            results=store,
            problems=problems,
            queue_maxlen=100,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )
        dependencies = self.ApiDependencies(
            settings=SimpleNamespace(allowed_origins=[], queue_maxlen=100),
            queue=queue,
            results=store,
            problems=problems,
            submission=submission,
            stream_routing=DEFAULT_STREAM_ROUTING,
        )
        app = self.create_app(dependencies)
        return self.TestClient(app)

    def test_submit_then_worker_done_then_result_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            queue = _InMemoryQueue()
            store = ResultsStore(Path(tmp_dir) / "judge.db")
            problems = _ProblemRepositoryStub("sample/01-basics/01-add")
            client = self._build_client(queue=queue, store=store, problems=problems)

            submit_response = client.post(
                "/submit",
                json={
                    "problem_id": "sample/01-basics/01-add",
                    "code": "def add(a, b):\n    return a + b\n",
                },
            )

            self.assertEqual(submit_response.status_code, 200)
            job_id = submit_response.json().get("job_id")
            self.assertTrue(job_id)
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
            outcome = execution.execute(
                WorkerJob(
                    job_id=str(payload["job_id"]),
                    problem_id=str(payload["problem_id"]),
                    operation=str(payload["operation"]),
                    code=str(payload["code"]),
                )
            )
            self.assertEqual(outcome.status, "done")

            result_response = client.get(f"/result/{job_id}")
            self.assertEqual(result_response.status_code, 200)
            result_payload = result_response.json()
            self.assertEqual(result_payload.get("status"), "done")
            self.assertEqual(result_payload.get("error_kind"), None)
            self.assertEqual(result_payload.get("result", {}).get("status"), "Accepted")

    def test_submit_then_worker_user_error_then_result_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            queue = _InMemoryQueue()
            store = ResultsStore(Path(tmp_dir) / "judge.db")
            problems = _ProblemRepositoryStub("sample/01-basics/01-add")
            client = self._build_client(queue=queue, store=store, problems=problems)

            submit_response = client.post(
                "/submit",
                json={
                    "problem_id": "sample/01-basics/01-add",
                    "code": "def add(a, b):\n    raise RuntimeError('bad')\n",
                },
            )

            self.assertEqual(submit_response.status_code, 200)
            job_id = submit_response.json().get("job_id")
            self.assertTrue(job_id)
            self.assertEqual(len(queue.enqueued), 1)

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
            self.assertEqual(outcome.status, "error")
            self.assertEqual(outcome.error_kind, "user")

            result_response = client.get(f"/result/{job_id}")
            self.assertEqual(result_response.status_code, 200)
            result_payload = result_response.json()
            self.assertEqual(result_payload.get("status"), "error")
            self.assertEqual(result_payload.get("error_kind"), "user")
            self.assertEqual(result_payload.get("error"), "Line 2: RuntimeError: bad")
