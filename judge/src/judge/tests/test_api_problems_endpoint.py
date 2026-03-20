"""API /problems endpoint contract tests."""

from __future__ import annotations

import importlib.util
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None
HAS_HTTPX = importlib.util.find_spec("httpx") is not None


class ProblemsEndpointTests(TestCase):
    def setUp(self) -> None:
        if not HAS_FASTAPI or not HAS_HTTPX:
            self.skipTest("fastapi/httpx dependencies not installed")

        from fastapi.testclient import TestClient

        from judge.api import ApiDependencies, create_app
        from judge.problems import ArgumentSpec, Comparison, ProblemSpec
        from judge.services import DEFAULT_STREAM_ROUTING

        self.TestClient = TestClient
        self.ApiDependencies = ApiDependencies
        self.create_app = create_app
        self.ArgumentSpec = ArgumentSpec
        self.Comparison = Comparison
        self.ProblemSpec = ProblemSpec
        self.DEFAULT_STREAM_ROUTING = DEFAULT_STREAM_ROUTING

    def _build_client(self, *, problems: Mock):
        dependencies = self.ApiDependencies(
            settings=SimpleNamespace(allowed_origins=[], queue_maxlen=0),
            queue=Mock(),
            results=Mock(),
            problems=problems,
            submission=Mock(),
            stream_routing=self.DEFAULT_STREAM_ROUTING,
        )
        app = self.create_app(dependencies)
        return self.TestClient(app)

    def test_problems_returns_metadata_for_valid_problem(self) -> None:
        problems = Mock()
        problems.get_problem_spec.return_value = self.ProblemSpec(
            problem_id="sample/01-basics/01-add",
            arguments=(self.ArgumentSpec("a"), self.ArgumentSpec("b")),
            runner="add(a, b)",
            execution_profile="light",
            comparison=self.Comparison(type="exact"),
            time_limit_s=5,
            memory_mb=1024,
        )
        client = self._build_client(problems=problems)

        response = client.get("/problems/sample/01-basics/01-add")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload.get("id"), "sample/01-basics/01-add")
        self.assertEqual(payload.get("execution_profile"), "light")
        self.assertEqual(payload.get("time_limit_s"), 5)
        self.assertEqual(payload.get("memory_mb"), 1024)

    def test_problems_returns_404_for_unknown_problem(self) -> None:
        problems = Mock()
        problems.get_problem_spec.side_effect = FileNotFoundError("missing")
        client = self._build_client(problems=problems)

        response = client.get("/problems/sample/unknown/problem")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json().get("detail"), "Problem not found")

    def test_problems_returns_400_for_invalid_problem_id(self) -> None:
        problems = Mock()
        problems.get_problem_spec.side_effect = ValueError("invalid id")
        client = self._build_client(problems=problems)

        response = client.get("/problems/not//valid")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("detail"), "Invalid problem id")
