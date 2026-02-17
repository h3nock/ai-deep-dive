"""Queue contract tests."""

from __future__ import annotations

import importlib.util
from unittest import TestCase
from unittest.mock import Mock

HAS_REDIS = importlib.util.find_spec("redis") is not None


class RedisQueueEnqueueValidationTests(TestCase):
    def setUp(self) -> None:
        if not HAS_REDIS:
            self.skipTest("redis dependency not installed")

        from judge.queue import RedisQueue

        self.queue = RedisQueue("redis://localhost:6379/0")
        self.queue.client.xadd = Mock(return_value="1-0")

    def _payload(self) -> dict[str, object]:
        return {
            "job_id": "job-1",
            "problem_id": "sample/01-basics/01-add",
            "problem_key": "sample/01-basics/01-add",
            "profile": "light",
            "kind": "submit",
            "code": "def add(a, b):\n    return a + b\n",
            "created_at": 1700000000,
        }

    def test_enqueue_accepts_valid_payload(self) -> None:
        payload = self._payload()

        msg_id = self.queue.enqueue("queue:light", payload)

        self.assertEqual(msg_id, "1-0")
        self.queue.client.xadd.assert_called_once_with(
            "queue:light",
            {
                "job_id": "job-1",
                "problem_id": "sample/01-basics/01-add",
                "problem_key": "sample/01-basics/01-add",
                "profile": "light",
                "kind": "submit",
                "code": "def add(a, b):\n    return a + b\n",
                "created_at": "1700000000",
            },
        )

    def test_enqueue_rejects_missing_job_id(self) -> None:
        payload = self._payload()
        payload.pop("job_id")

        with self.assertRaisesRegex(ValueError, "job_id"):
            self.queue.enqueue("queue:light", payload)

        self.queue.client.xadd.assert_not_called()

    def test_enqueue_rejects_invalid_kind(self) -> None:
        payload = self._payload()
        payload["kind"] = "execute"

        with self.assertRaisesRegex(ValueError, "kind"):
            self.queue.enqueue("queue:light", payload)

        self.queue.client.xadd.assert_not_called()

    def test_enqueue_rejects_non_integer_created_at(self) -> None:
        payload = self._payload()
        payload["created_at"] = True

        with self.assertRaisesRegex(ValueError, "created_at"):
            self.queue.enqueue("queue:light", payload)

        self.queue.client.xadd.assert_not_called()
