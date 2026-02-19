"""API /result endpoint contract tests."""

from __future__ import annotations

import importlib.util
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None
HAS_HTTPX = importlib.util.find_spec("httpx") is not None

_INTERNAL_ERROR_MSG = "Internal judge error. Please retry."


class ResultEndpointTests(TestCase):
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

    def _build_client(self, *, results: Mock):
        dependencies = self.ApiDependencies(
            settings=SimpleNamespace(allowed_origins=[], queue_maxlen=0),
            queue=Mock(),
            results=results,
            problems=Mock(),
            submission=Mock(),
            stream_routing=self.DEFAULT_STREAM_ROUTING,
        )
        app = self.create_app(dependencies)
        return self.TestClient(app)

    def _base_job(self, *, job_id: str) -> dict[str, object]:
        return {
            "job_id": job_id,
            "status": "done",
            "problem_id": "sample/01-basics/01-add",
            "profile": "light",
            "created_at": 1700000000,
            "started_at": 1700000001,
            "finished_at": 1700000002,
            "attempts": 1,
            "error": None,
            "error_kind": None,
            "result": {
                "status": "Accepted",
                "summary": {"total": 1, "passed": 1, "failed": 0},
                "tests": [],
                "error": None,
            },
        }

    def test_result_returns_404_for_unknown_job(self) -> None:
        results = Mock()
        results.get_job.return_value = None
        client = self._build_client(results=results)

        response = client.get("/result/missing-job")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json().get("detail"), "Job not found")
        results.get_job.assert_called_once_with("missing-job")

    def test_result_masks_internal_errors(self) -> None:
        results = Mock()
        job = self._base_job(job_id="job-internal")
        job["status"] = "error"
        job["error_kind"] = "internal"
        job["error"] = "sensitive traceback"
        job["result"] = {
            "status": "Runtime Error",
            "summary": {"total": 1, "passed": 0, "failed": 1},
            "tests": [],
            "error": "raw internal trace",
            "error_kind": "internal",
        }
        results.get_job.return_value = job
        client = self._build_client(results=results)

        response = client.get("/result/job-internal")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload.get("error_kind"), "internal")
        self.assertEqual(payload.get("error"), _INTERNAL_ERROR_MSG)
        self.assertEqual(payload.get("result", {}).get("error"), _INTERNAL_ERROR_MSG)
        self.assertNotIn("error_kind", payload.get("result", {}))

    def test_result_keeps_user_errors(self) -> None:
        results = Mock()
        job = self._base_job(job_id="job-user")
        job["status"] = "error"
        job["error_kind"] = "user"
        job["error"] = "Line 3: RuntimeError: invalid input"
        job["result"] = {
            "status": "Runtime Error",
            "summary": {"total": 1, "passed": 0, "failed": 1},
            "tests": [],
            "error": "Line 3: RuntimeError: invalid input",
            "error_kind": "user",
        }
        results.get_job.return_value = job
        client = self._build_client(results=results)

        response = client.get("/result/job-user")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload.get("error_kind"), "user")
        self.assertEqual(payload.get("error"), "Line 3: RuntimeError: invalid input")
        self.assertEqual(
            payload.get("result", {}).get("error"),
            "Line 3: RuntimeError: invalid input",
        )
