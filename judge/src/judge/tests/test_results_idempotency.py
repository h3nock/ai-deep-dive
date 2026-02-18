"""Results store idempotency regression tests."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest import TestCase

from judge.results import ResultsStore


class ResultsStoreIdempotencyTests(TestCase):
    def test_terminal_done_job_is_not_overwritten(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "judge.db"
            store = ResultsStore(db_path)
            store.create_job(
                job_id="job-1",
                problem_id="sample/01-basics/01-add",
                profile="light",
                kind="submit",
                created_at=1700000000,
            )

            self.assertTrue(store.mark_running("job-1"))
            self.assertTrue(store.mark_done("job-1", {"status": "Accepted"}))

            # Duplicate reclaim should not transition a terminal row again.
            self.assertFalse(store.mark_running("job-1"))
            self.assertFalse(
                store.mark_error(
                    "job-1",
                    "late worker error",
                    {"status": "Runtime Error"},
                    error_kind="internal",
                )
            )

            job = store.get_job("job-1")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job["status"], "done")
        self.assertEqual(job["result"], {"status": "Accepted"})
        self.assertEqual(job["attempts"], 1)

    def test_reclaimed_running_job_can_continue(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "judge.db"
            store = ResultsStore(db_path)
            store.create_job(
                job_id="job-2",
                problem_id="sample/01-basics/01-add",
                profile="light",
                kind="submit",
                created_at=1700000000,
            )

            self.assertTrue(store.mark_running("job-2"))
            self.assertTrue(store.mark_running("job-2"))
            self.assertTrue(store.mark_done("job-2", {"status": "Accepted"}))

            job = store.get_job("job-2")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job["status"], "done")
        self.assertEqual(job["attempts"], 2)

    def test_mark_error_allows_enqueue_failure_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "judge.db"
            store = ResultsStore(db_path)
            store.create_job(
                job_id="job-3",
                problem_id="sample/01-basics/01-add",
                profile="light",
                kind="submit",
                created_at=1700000000,
            )

            self.assertTrue(
                store.mark_error(
                    "job-3",
                    "Failed to enqueue job",
                    error_kind="internal",
                )
            )
            self.assertFalse(store.mark_done("job-3", {"status": "Accepted"}))

            job = store.get_job("job-3")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job["status"], "error")
        self.assertEqual(job["error"], "Failed to enqueue job")

