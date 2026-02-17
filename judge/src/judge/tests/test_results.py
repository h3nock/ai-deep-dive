"""Results storage regression tests."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest import TestCase

from judge.results import ResultsStore


class ResultsStoreTests(TestCase):
    def test_mark_error_preserves_empty_result_object(self) -> None:
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

            store.mark_error(
                "job-1",
                "failed",
                result={},
                error_kind="internal",
            )

            job = store.get_job("job-1")

        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job["result"], {})
        self.assertEqual(job["status"], "error")
