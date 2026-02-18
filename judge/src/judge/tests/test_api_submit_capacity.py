"""Submit queue-capacity behavior tests."""

from __future__ import annotations

import importlib.util
from dataclasses import replace
from unittest import TestCase
from unittest.mock import Mock, patch

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None
HAS_REDIS = importlib.util.find_spec("redis") is not None


class SubmitQueueCapacityTests(TestCase):
    def setUp(self) -> None:
        if not HAS_FASTAPI or not HAS_REDIS:
            self.skipTest("fastapi/redis dependencies not installed")

        from fastapi import HTTPException

        from judge.api import submit
        from judge.models import SubmitRequest
        from judge.problems import ProblemRouteInfo

        self.submit = submit
        self.SubmitRequest = SubmitRequest
        self.ProblemRouteInfo = ProblemRouteInfo
        self.HTTPException = HTTPException

    def _problem(self):
        return self.ProblemRouteInfo(
            id="sample/01-basics/01-add",
            version="v1",
            requires_torch=False,
            time_limit_s=10,
            memory_mb=1024,
        )

    def test_submit_rejects_when_queue_is_full(self) -> None:
        import judge.api as api

        queue = Mock()
        queue.backlog.return_value = 10000
        problems = Mock()
        problems.get_route_info.return_value = self._problem()
        results = Mock()
        settings = replace(api.settings, queue_maxlen=10000)

        request = self.SubmitRequest(
            problem_id="sample/01-basics/01-add",
            kind="submit",
            code="def add(a, b):\n    return a + b\n",
        )

        with (
            patch.object(api, "settings", settings),
            patch.object(api, "queue", queue),
            patch.object(api, "problems", problems),
            patch.object(api, "results", results),
        ):
            with self.assertRaises(self.HTTPException) as ctx:
                self.submit(request)

        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(ctx.exception.detail, "Judge queue is full. Please retry.")
        queue.backlog.assert_called_once_with("queue:light", "workers-light")
        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_rejects_when_queue_length_check_fails(self) -> None:
        import judge.api as api

        queue = Mock()
        queue.backlog.side_effect = RuntimeError("redis unavailable")
        problems = Mock()
        problems.get_route_info.return_value = self._problem()
        results = Mock()
        settings = replace(api.settings, queue_maxlen=10000)

        request = self.SubmitRequest(
            problem_id="sample/01-basics/01-add",
            kind="submit",
            code="def add(a, b):\n    return a + b\n",
        )

        with (
            patch.object(api, "settings", settings),
            patch.object(api, "queue", queue),
            patch.object(api, "problems", problems),
            patch.object(api, "results", results),
        ):
            with self.assertRaises(self.HTTPException) as ctx:
                self.submit(request)

        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(ctx.exception.detail, "Judge queue unavailable")
        queue.backlog.assert_called_once_with("queue:light", "workers-light")
        results.create_job.assert_not_called()
        queue.enqueue.assert_not_called()

    def test_submit_skips_capacity_check_when_limit_disabled(self) -> None:
        import judge.api as api

        queue = Mock()
        queue.enqueue.return_value = "1-0"
        problems = Mock()
        problems.get_route_info.return_value = self._problem()
        results = Mock()
        settings = replace(api.settings, queue_maxlen=0)

        request = self.SubmitRequest(
            problem_id="sample/01-basics/01-add",
            kind="submit",
            code="def add(a, b):\n    return a + b\n",
        )

        with (
            patch.object(api, "settings", settings),
            patch.object(api, "queue", queue),
            patch.object(api, "problems", problems),
            patch.object(api, "results", results),
        ):
            response = self.submit(request)

        self.assertEqual(response.status, "queued")
        self.assertTrue(response.job_id)
        queue.backlog.assert_not_called()
        results.create_job.assert_called_once()
        queue.enqueue.assert_called_once()
