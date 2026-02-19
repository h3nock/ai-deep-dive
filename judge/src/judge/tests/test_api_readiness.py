"""Readiness and liveness endpoint tests."""

from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None
HAS_HTTPX = importlib.util.find_spec("httpx") is not None


class ReadinessEndpointTests(TestCase):
    def setUp(self) -> None:
        if not HAS_FASTAPI or not HAS_HTTPX:
            self.skipTest("fastapi/httpx dependencies not installed")

        from fastapi.testclient import TestClient

        from judge.api import ApiDependencies, create_app
        from judge.services import DEFAULT_STREAM_ROUTING

        self.TestClient = TestClient
        self.ApiDependencies = ApiDependencies
        self.create_app = create_app
        self.DEFAULT_STREAM_ROUTING = DEFAULT_STREAM_ROUTING

    def _healthy_queue(self) -> Mock:
        queue = Mock()
        queue.client = Mock()
        queue.client.ping.return_value = True
        return queue

    def _healthy_results(self) -> Mock:
        results = Mock()
        results.ping.return_value = None
        return results

    def _problems_with_manifest(self, root: Path) -> SimpleNamespace:
        problem_dir = root / "sample" / "01-basics" / "01-add"
        problem_dir.mkdir(parents=True, exist_ok=True)
        (problem_dir / "manifest.json").write_text("{}")
        return SimpleNamespace(root=root)

    def _build_client(self, *, queue: Mock, results: Mock, problems: object):
        dependencies = self.ApiDependencies(
            settings=SimpleNamespace(allowed_origins=[], queue_maxlen=0),
            queue=queue,
            results=results,
            problems=problems,
            submission=Mock(),
            stream_routing=self.DEFAULT_STREAM_ROUTING,
        )
        app = self.create_app(dependencies)
        return self.TestClient(app)

    def test_health_stays_liveness_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            client = self._build_client(
                queue=self._healthy_queue(),
                results=self._healthy_results(),
                problems=self._problems_with_manifest(Path(tmp_dir)),
            )

            response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_ready_returns_ready_when_all_dependencies_pass(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            client = self._build_client(
                queue=self._healthy_queue(),
                results=self._healthy_results(),
                problems=self._problems_with_manifest(Path(tmp_dir)),
            )

            response = client.get("/ready")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body.get("status"), "ready")
        self.assertTrue(body["checks"]["redis"]["ok"])
        self.assertTrue(body["checks"]["db"]["ok"])
        self.assertTrue(body["checks"]["problems"]["ok"])

    def test_ready_returns_503_when_redis_unavailable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            queue = self._healthy_queue()
            queue.client.ping.side_effect = RuntimeError("redis down")
            client = self._build_client(
                queue=queue,
                results=self._healthy_results(),
                problems=self._problems_with_manifest(Path(tmp_dir)),
            )

            response = client.get("/ready")

        self.assertEqual(response.status_code, 503)
        body = response.json()
        self.assertEqual(body.get("status"), "not_ready")
        self.assertEqual(body["checks"]["redis"], {"ok": False, "detail": "unavailable"})

    def test_ready_returns_503_when_db_unavailable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            results = self._healthy_results()
            results.ping.side_effect = RuntimeError("db down")
            client = self._build_client(
                queue=self._healthy_queue(),
                results=results,
                problems=self._problems_with_manifest(Path(tmp_dir)),
            )

            response = client.get("/ready")

        self.assertEqual(response.status_code, 503)
        body = response.json()
        self.assertEqual(body.get("status"), "not_ready")
        self.assertEqual(body["checks"]["db"], {"ok": False, "detail": "unavailable"})

    def test_ready_returns_503_when_problem_root_missing(self) -> None:
        missing_root = Path(tempfile.gettempdir()) / "judge-readiness-missing-root"
        client = self._build_client(
            queue=self._healthy_queue(),
            results=self._healthy_results(),
            problems=SimpleNamespace(root=missing_root),
        )

        response = client.get("/ready")

        self.assertEqual(response.status_code, 503)
        body = response.json()
        self.assertEqual(body.get("status"), "not_ready")
        self.assertEqual(body["checks"]["problems"], {"ok": False, "detail": "missing"})

    def test_ready_returns_503_when_problem_root_has_no_manifests(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            root.mkdir(parents=True, exist_ok=True)
            client = self._build_client(
                queue=self._healthy_queue(),
                results=self._healthy_results(),
                problems=SimpleNamespace(root=root),
            )

            response = client.get("/ready")

        self.assertEqual(response.status_code, 503)
        body = response.json()
        self.assertEqual(body.get("status"), "not_ready")
        self.assertEqual(body["checks"]["problems"], {"ok": False, "detail": "empty"})
