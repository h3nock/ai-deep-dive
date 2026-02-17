"""Backup script tests."""

from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path
from unittest import TestCase

from judge.backup import _copy_db


class BackupTests(TestCase):
    def test_copy_db_fails_for_missing_source(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            src = Path(tmp_dir) / "missing.db"
            dest = Path(tmp_dir) / "backup.db"

            with self.assertRaises(FileNotFoundError):
                _copy_db(src, dest)

    def test_copy_db_creates_valid_copy(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            src = Path(tmp_dir) / "source.db"
            dest = Path(tmp_dir) / "backup.db"

            with sqlite3.connect(src) as conn:
                conn.execute("CREATE TABLE jobs (id TEXT PRIMARY KEY)")
                conn.execute("INSERT INTO jobs (id) VALUES ('job-1')")
                conn.commit()

            _copy_db(src, dest)

            with sqlite3.connect(dest) as conn:
                row = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()

        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row[0], 1)
