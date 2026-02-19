"""Readiness and liveness endpoint tests."""

from __future__ import annotations

import asyncio
import importlib.util
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None
HAS_REDIS = importlib.util.find_spec("redis") is not None


class ReadinessEndpointTests(TestCase):
    def setUp(self) -> None:
        if not HAS_FASTAPI or not HAS_REDIS:
            self.skipTest("fastapi/redis dependencies not installed")
        import judge.api as api

        self.api = api

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

    def test_health_stays_liveness_only(self) -> None:
        payload = asyncio.run(self.api.health())
        self.assertEqual(payload, {"status": "ok"})

    def test_ready_returns_ready_when_all_dependencies_pass(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            problems = self._problems_with_manifest(Path(tmp_dir))
            with (
                patch.object(self.api, "queue", self._healthy_queue()),
                patch.object(self.api, "results", self._healthy_results()),
                patch.object(self.api, "problems", problems),
            ):
                response = self.api.ready()

        self.assertEqual(response.status, "ready")
        self.assertTrue(response.checks.redis.ok)
        self.assertTrue(response.checks.db.ok)
        self.assertTrue(response.checks.problems.ok)

    def test_ready_returns_503_when_redis_unavailable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            queue = self._healthy_queue()
            queue.client.ping.side_effect = RuntimeError("redis down")
            problems = self._problems_with_manifest(Path(tmp_dir))
            with (
                patch.object(self.api, "queue", queue),
                patch.object(self.api, "results", self._healthy_results()),
                patch.object(self.api, "problems", problems),
            ):
                response = self.api.ready()

        self.assertEqual(response.status_code, 503)
        self.assertIn(b'"status":"not_ready"', response.body)
        self.assertIn(b'"redis":{"ok":false,"detail":"unavailable"}', response.body)

    def test_ready_returns_503_when_db_unavailable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            results = self._healthy_results()
            results.ping.side_effect = RuntimeError("db down")
            problems = self._problems_with_manifest(Path(tmp_dir))
            with (
                patch.object(self.api, "queue", self._healthy_queue()),
                patch.object(self.api, "results", results),
                patch.object(self.api, "problems", problems),
            ):
                response = self.api.ready()

        self.assertEqual(response.status_code, 503)
        self.assertIn(b'"status":"not_ready"', response.body)
        self.assertIn(b'"db":{"ok":false,"detail":"unavailable"}', response.body)

    def test_ready_returns_503_when_problem_root_missing(self) -> None:
        missing_root = Path(tempfile.gettempdir()) / "judge-readiness-missing-root"
        with (
            patch.object(self.api, "queue", self._healthy_queue()),
            patch.object(self.api, "results", self._healthy_results()),
            patch.object(self.api, "problems", SimpleNamespace(root=missing_root)),
        ):
            response = self.api.ready()

        self.assertEqual(response.status_code, 503)
        self.assertIn(b'"status":"not_ready"', response.body)
        self.assertIn(b'"problems":{"ok":false,"detail":"missing"}', response.body)

    def test_ready_returns_503_when_problem_root_has_no_manifests(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            root.mkdir(parents=True, exist_ok=True)
            with (
                patch.object(self.api, "queue", self._healthy_queue()),
                patch.object(self.api, "results", self._healthy_results()),
                patch.object(self.api, "problems", SimpleNamespace(root=root)),
            ):
                response = self.api.ready()

        self.assertEqual(response.status_code, 503)
        self.assertIn(b'"status":"not_ready"', response.body)
        self.assertIn(b'"problems":{"ok":false,"detail":"empty"}', response.body)
