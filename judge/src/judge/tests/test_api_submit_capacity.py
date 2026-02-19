"""Submit queue-capacity behavior tests."""

from __future__ import annotations

import importlib.util
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None
HAS_HTTPX = importlib.util.find_spec("httpx") is not None


class SubmitQueueCapacityTests(TestCase):
    def setUp(self) -> None:
        if not HAS_FASTAPI or not HAS_HTTPX:
            self.skipTest("fastapi/httpx dependencies not installed")

        from fastapi.testclient import TestClient

        from judge.api import ApiDependencies, create_app
        from judge.problems import ProblemRouteInfo
        from judge.services import DEFAULT_STREAM_ROUTING, SubmissionService

        self.TestClient = TestClient
        self.ApiDependencies = ApiDependencies
        self.create_app = create_app
        self.ProblemRouteInfo = ProblemRouteInfo
        self.DEFAULT_STREAM_ROUTING = DEFAULT_STREAM_ROUTING
        self.SubmissionService = SubmissionService

    def _problem(self) -> object:
        return self.ProblemRouteInfo(
            id="sample/01-basics/01-add",
            version="v1",
            requires_torch=False,
            time_limit_s=10,
            memory_mb=1024,
        )

    def _build_client(
        self,
        *,
        queue_maxlen: int,
        queue: Mock,
        results: Mock,
        problems: Mock,
    ):
        submission = self.SubmissionService(
            queue=queue,
            results=results,
            problems=problems,
            queue_maxlen=queue_maxlen,
            stream_routing=self.DEFAULT_STREAM_ROUTING,
        )
        dependencies = self.ApiDependencies(
            settings=SimpleNamespace(allowed_origins=[], queue_maxlen=queue_maxlen),
            queue=queue,
            results=results,
            problems=problems,
            submission=submission,
            stream_routing=self.DEFAULT_STREAM_ROUTING,
        )
        app = self.create_app(dependencies)
        return self.TestClient(app)

    def test_submit_rejects_when_queue_is_full(self) -> None:
        queue = Mock()
        queue.backlog.return_value = 10000
        problems = Mock()
        problems.get_route_info.return_value = self._problem()
        results = Mock()

        client = self._build_client(
            queue_maxlen=10000,
            queue=queue,
            results=results,
            problems=problems,
        )

        response = client.post(
            "/submit",
            json={
                "problem_id": "sample/01-basics/01-add",
                "kind": "submit",
                "code": "def add(a, b):\n    return a + b\n",
            },
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json().get("detail"), "Judge queue is full. Please retry.")
        queue.backlog.assert_called_once_with("queue:light", "workers-light")
        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_rejects_when_queue_length_check_fails(self) -> None:
        queue = Mock()
        queue.backlog.side_effect = RuntimeError("redis unavailable")
        problems = Mock()
        problems.get_route_info.return_value = self._problem()
        results = Mock()

        client = self._build_client(
            queue_maxlen=10000,
            queue=queue,
            results=results,
            problems=problems,
        )

        response = client.post(
            "/submit",
            json={
                "problem_id": "sample/01-basics/01-add",
                "kind": "submit",
                "code": "def add(a, b):\n    return a + b\n",
            },
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json().get("detail"), "Judge queue unavailable")
        queue.backlog.assert_called_once_with("queue:light", "workers-light")
        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_skips_capacity_check_when_limit_disabled(self) -> None:
        queue = Mock()
        queue.enqueue.return_value = "1-0"
        problems = Mock()
        problems.get_route_info.return_value = self._problem()
        results = Mock()

        client = self._build_client(
            queue_maxlen=0,
            queue=queue,
            results=results,
            problems=problems,
        )

        response = client.post(
            "/submit",
            json={
                "problem_id": "sample/01-basics/01-add",
                "kind": "submit",
                "code": "def add(a, b):\n    return a + b\n",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload.get("status"), "queued")
        self.assertTrue(payload.get("job_id"))
        queue.backlog.assert_not_called()
        results.create_job.assert_called_once()
        queue.enqueue.assert_called_once()
