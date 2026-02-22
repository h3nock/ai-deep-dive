"""Worker message parsing tests."""

from __future__ import annotations

import os
import socket
import tempfile
from unittest import TestCase
from unittest.mock import patch


class WorkerMessageParsingTests(TestCase):
    def _parse(self, fields: dict[str, str]) -> tuple[dict[str, object], str | None]:
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


class WorkerSystemdNotifyTests(TestCase):
    def test_notify_systemd_writes_datagram(self) -> None:
        from judge.worker import _notify_systemd

        with tempfile.TemporaryDirectory() as tmp_dir:
            socket_path = os.path.join(tmp_dir, "notify.sock")
            server = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
            server.bind(socket_path)
            self.addCleanup(server.close)
            server.settimeout(1.0)

            with patch.dict(os.environ, {"NOTIFY_SOCKET": socket_path}):
                _notify_systemd("READY=1")

            payload = server.recv(128).decode("utf-8")
            self.assertEqual(payload, "READY=1")

    def test_watchdog_enabled_checks_watchdog_usec(self) -> None:
        from judge.worker import _watchdog_enabled

        with patch.dict(os.environ, {"WATCHDOG_USEC": "60000000"}, clear=True):
            self.assertTrue(_watchdog_enabled())

        with patch.dict(os.environ, {"WATCHDOG_USEC": "0"}, clear=True):
            self.assertFalse(_watchdog_enabled())

        with patch.dict(os.environ, {"WATCHDOG_USEC": "abc"}, clear=True):
            self.assertFalse(_watchdog_enabled())
