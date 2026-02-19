"""API result contract regression tests."""

from __future__ import annotations

import importlib.util
from unittest import TestCase

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None

_INTERNAL_ERROR_MSG = "Internal judge error. Please retry."


class ApiResultContractTests(TestCase):
    def setUp(self) -> None:
        if not HAS_FASTAPI:
            self.skipTest("fastapi dependency not installed")
        from judge.api import _sanitize_job

        self.sanitize_job = _sanitize_job

    def test_internal_error_is_masked_and_kind_is_preserved(self) -> None:
        job = {
            "job_id": "job-1",
            "status": "error",
            "problem_id": "sample/01-basics/01-add",
            "profile": "light",
            "created_at": 1700000000,
            "error_kind": "internal",
            "error": "sensitive internal details",
            "result": {
                "status": "Runtime Error",
                "summary": {"total": 1, "passed": 0, "failed": 1},
                "tests": [],
                "error": "raw internal trace",
                "error_kind": "internal",
            },
        }

        sanitized = self.sanitize_job(job)

        self.assertEqual(sanitized.get("error_kind"), "internal")
        self.assertEqual(sanitized.get("error"), _INTERNAL_ERROR_MSG)
        result = sanitized.get("result")
        self.assertIsInstance(result, dict)
        assert isinstance(result, dict)
        self.assertEqual(result.get("error"), _INTERNAL_ERROR_MSG)
        self.assertNotIn("error_kind", result)

    def test_user_error_is_not_masked_and_kind_is_preserved(self) -> None:
        job = {
            "job_id": "job-2",
            "status": "error",
            "problem_id": "sample/01-basics/01-add",
            "profile": "light",
            "created_at": 1700000000,
            "error_kind": "user",
            "error": "Line 3: RuntimeError: bad input",
            "result": {
                "status": "Runtime Error",
                "summary": {"total": 1, "passed": 0, "failed": 1},
                "tests": [],
                "error": "Line 3: RuntimeError: bad input",
                "error_kind": "user",
            },
        }

        sanitized = self.sanitize_job(job)

        self.assertEqual(sanitized.get("error_kind"), "user")
        self.assertEqual(sanitized.get("error"), "Line 3: RuntimeError: bad input")
        result = sanitized.get("result")
        self.assertIsInstance(result, dict)
        assert isinstance(result, dict)
        self.assertEqual(result.get("error"), "Line 3: RuntimeError: bad input")
        self.assertNotIn("error_kind", result)

    def test_unknown_error_kind_is_normalized_to_none(self) -> None:
        job = {
            "job_id": "job-3",
            "status": "error",
            "problem_id": "sample/01-basics/01-add",
            "profile": "light",
            "created_at": 1700000000,
            "error_kind": "legacy-kind",
            "error": "legacy message",
            "result": None,
        }

        sanitized = self.sanitize_job(job)

        self.assertIsNone(sanitized.get("error_kind"))
        self.assertEqual(sanitized.get("error"), "legacy message")

    def test_invalid_result_payload_is_dropped(self) -> None:
        job = {
            "job_id": "job-4",
            "status": "error",
            "problem_id": "sample/01-basics/01-add",
            "profile": "light",
            "created_at": 1700000000,
            "error_kind": "user",
            "error": "legacy row with empty result",
            "result": {},
        }

        sanitized = self.sanitize_job(job)

        self.assertEqual(sanitized.get("error_kind"), "user")
        self.assertIsNone(sanitized.get("result"))
