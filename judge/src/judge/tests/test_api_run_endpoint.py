"""HTTP-level /run endpoint contract tests."""

from __future__ import annotations

import importlib.util
import json
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None
HAS_HTTPX = importlib.util.find_spec("httpx") is not None


class RunEndpointTests(TestCase):
    def setUp(self) -> None:
        if not HAS_FASTAPI or not HAS_HTTPX:
            self.skipTest("fastapi/httpx dependencies not installed")

        from fastapi.testclient import TestClient

        from judge.api import ApiDependencies, create_app
        from judge.problems import ArgumentSpec, Comparison, ProblemSpec, TestCaseCompiler
        from judge.services import DEFAULT_STREAM_ROUTING, SubmissionService

        self.TestClient = TestClient
        self.ApiDependencies = ApiDependencies
        self.create_app = create_app
        self.ArgumentSpec = ArgumentSpec
        self.Comparison = Comparison
        self.ProblemSpec = ProblemSpec
        self.TestCaseCompiler = TestCaseCompiler
        self.DEFAULT_STREAM_ROUTING = DEFAULT_STREAM_ROUTING
        self.SubmissionService = SubmissionService

    def _problem(self) -> object:
        return self.ProblemSpec(
            problem_id="sample/01-basics/01-add",
            arguments=(self.ArgumentSpec("a"), self.ArgumentSpec("b")),
            runner="add(a, b)",
            execution_profile="light",
            comparison=self.Comparison(type="exact"),
            time_limit_s=10,
            memory_mb=1024,
        )

    def _build_client(
        self,
        *,
        queue: Mock,
        results: Mock,
        problems: Mock,
    ):
        submission = self.SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=0,
            stream_routing=self.DEFAULT_STREAM_ROUTING,
        )
        dependencies = self.ApiDependencies(
            settings=SimpleNamespace(allowed_origins=[], queue_maxlen=0),
            queue=queue,
            results=results,
            problems=problems,
            submission=submission,
            stream_routing=self.DEFAULT_STREAM_ROUTING,
        )
        app = self.create_app(dependencies)
        return self.TestClient(app)

    def test_run_accepts_valid_request_and_enqueues_compiled_cases(self) -> None:
        queue = Mock()
        queue.enqueue.return_value = "1-0"
        results = Mock()
        problems = Mock()
        problems.get_problem_spec.return_value = self._problem()
        problems.compiler = self.TestCaseCompiler()

        client = self._build_client(queue=queue, results=results, problems=problems)

        response = client.post(
            "/run",
            json={
                "problem_id": "sample/01-basics/01-add",
                "code": "def add(a, b):\n    return a + b\n",
                "cases": [
                    {
                        "id": "case1",
                        "inputs": {"b": "2", "a": "1"},
                        "expected_literal": "3",
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload.get("status"), "queued")
        self.assertTrue(payload.get("job_id"))
        results.create_job.assert_called_once()
        queue.enqueue.assert_called_once()

        _, enqueue_payload = queue.enqueue.call_args.args
        self.assertEqual(enqueue_payload["operation"], "run")
        compiled_cases = json.loads(enqueue_payload["cases_json"])
        self.assertEqual(
            compiled_cases,
            [
                {
                    "id": "case1",
                    "input_code": "a = 1\nb = 2\n",
                    "expected_literal": "3",
                }
            ],
        )

    def test_run_rejects_unknown_case_field_at_http_boundary(self) -> None:
        queue = Mock()
        results = Mock()
        problems = Mock()
        problems.get_problem_spec.return_value = self._problem()
        problems.compiler = self.TestCaseCompiler()

        client = self._build_client(queue=queue, results=results, problems=problems)

        response = client.post(
            "/run",
            json={
                "problem_id": "sample/01-basics/01-add",
                "code": "def add(a, b):\n    return a + b\n",
                "cases": [
                    {
                        "id": "case1",
                        "inputs": {"a": "1", "b": "2"},
                        "expected_literal": "3",
                        "extra": "nope",
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 422)
        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_run_rejects_empty_case_list(self) -> None:
        queue = Mock()
        results = Mock()
        problems = Mock()
        problems.get_problem_spec.return_value = self._problem()
        problems.compiler = self.TestCaseCompiler()

        client = self._build_client(queue=queue, results=results, problems=problems)

        response = client.post(
            "/run",
            json={
                "problem_id": "sample/01-basics/01-add",
                "code": "def add(a, b):\n    return a + b\n",
                "cases": [],
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("between 1 and 10", response.text)
        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_run_rejects_oversized_cases_payload(self) -> None:
        queue = Mock()
        results = Mock()
        problems = Mock()
        problems.get_problem_spec.return_value = self._problem()
        problems.compiler = self.TestCaseCompiler()

        client = self._build_client(queue=queue, results=results, problems=problems)

        huge_expr = repr("x" * (300 * 1024))
        response = client.post(
            "/run",
            json={
                "problem_id": "sample/01-basics/01-add",
                "code": "def add(a, b):\n    return a + b\n",
                "cases": [
                    {
                        "id": "case1",
                        "inputs": {"a": huge_expr, "b": "2"},
                        "expected_literal": "3",
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("serialized cases payload must be <=", response.text)
        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()
