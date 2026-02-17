"""Worker message parsing tests."""

from __future__ import annotations

import importlib.util
from unittest import TestCase

HAS_REDIS = importlib.util.find_spec("redis") is not None


class WorkerMessageParsingTests(TestCase):
    def _parse(self, fields: dict[str, str]) -> tuple[dict[str, object], str | None]:
        if not HAS_REDIS:
            self.skipTest("redis dependency not installed")
        from judge.worker import _parse_queue_message

        return _parse_queue_message(fields)

    def test_parse_queue_message_accepts_valid_payload(self) -> None:
        parsed, error = self._parse(
            {
                "job_id": "job-1",
                "problem_key": "sample/01-basics/01-add",
                "kind": "submit",
                "code": "print('hello')",
                "created_at": "1700000000",
            }
        )

        self.assertIsNone(error)
        self.assertEqual(parsed["job_id"], "job-1")
        self.assertEqual(parsed["problem_key"], "sample/01-basics/01-add")
        self.assertEqual(parsed["kind"], "submit")
        self.assertEqual(parsed["created_at"], 1700000000)

    def test_parse_queue_message_rejects_missing_job_id(self) -> None:
        parsed, error = self._parse({"problem_key": "sample/01-basics/01-add"})

        self.assertEqual(parsed, {})
        self.assertEqual(error, "missing job_id")

    def test_parse_queue_message_rejects_invalid_created_at(self) -> None:
        parsed, error = self._parse(
            {
                "job_id": "job-1",
                "problem_key": "sample/01-basics/01-add",
                "kind": "submit",
                "code": "",
                "created_at": "invalid",
            }
        )

        self.assertEqual(parsed, {})
        self.assertIn("invalid created_at", error or "")
