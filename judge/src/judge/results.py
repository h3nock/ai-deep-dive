"""SQLite results store."""

import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional


class ResultsStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    profile TEXT NOT NULL,
                    problem_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    started_at INTEGER,
                    finished_at INTEGER,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    result_json TEXT,
                    error TEXT
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status)"
            )

    def create_job(self, job_id: str, problem_id: str, profile: str, kind: str) -> None:
        now = int(time.time())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO jobs (id, status, profile, problem_id, kind, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (job_id, "queued", profile, problem_id, kind, now),
            )

    def mark_running(self, job_id: str) -> None:
        now = int(time.time())
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = ?, started_at = ?, attempts = attempts + 1
                WHERE id = ?
                """,
                ("running", now, job_id),
            )

    def mark_done(self, job_id: str, result: dict[str, Any]) -> None:
        now = int(time.time())
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = ?, finished_at = ?, result_json = ?, error = NULL
                WHERE id = ?
                """,
                ("done", now, json.dumps(result), job_id),
            )

    def mark_error(self, job_id: str, error: str, result: Optional[dict[str, Any]] = None) -> None:
        now = int(time.time())
        result_json = json.dumps(result) if result else None
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = ?, finished_at = ?, result_json = ?, error = ?
                WHERE id = ?
                """,
                ("error", now, result_json, error, job_id),
            )

    def get_job(self, job_id: str) -> Optional[dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            return None
        result = json.loads(row["result_json"]) if row["result_json"] else None
        return {
            "job_id": row["id"],
            "status": row["status"],
            "profile": row["profile"],
            "problem_id": row["problem_id"],
            "kind": row["kind"],
            "created_at": row["created_at"],
            "started_at": row["started_at"],
            "finished_at": row["finished_at"],
            "attempts": row["attempts"],
            "result": result,
            "error": row["error"],
        }
