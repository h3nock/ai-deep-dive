"""SQLite results store."""

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any


class ResultsStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._thread_local = threading.local()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = getattr(self._thread_local, "conn", None)
        if conn is not None:
            return conn

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA busy_timeout=5000")
        self._thread_local.conn = conn
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
                    error TEXT,
                    error_kind TEXT
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status)"
            )
            columns = {
                row["name"]
                for row in conn.execute("PRAGMA table_info(jobs)").fetchall()
            }
            if "error_kind" not in columns:
                conn.execute("ALTER TABLE jobs ADD COLUMN error_kind TEXT")

    def create_job(
        self,
        job_id: str,
        problem_id: str,
        profile: str,
        kind: str,
        created_at: int | None = None,
    ) -> None:
        now = created_at if created_at is not None else int(time.time())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO jobs (id, status, profile, problem_id, kind, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (job_id, "queued", profile, problem_id, kind, now),
            )

    def mark_running(self, job_id: str) -> bool:
        now = int(time.time())
        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE jobs
                SET status = ?, started_at = ?, attempts = attempts + 1
                WHERE id = ?
                  AND status IN ('queued', 'running')
                """,
                ("running", now, job_id),
            )
        return cursor.rowcount > 0

    def mark_done(self, job_id: str, result: dict[str, Any]) -> bool:
        now = int(time.time())
        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE jobs
                SET status = ?, finished_at = ?, result_json = ?, error = NULL, error_kind = NULL
                WHERE id = ?
                  AND status = 'running'
                """,
                ("done", now, json.dumps(result), job_id),
            )
        return cursor.rowcount > 0

    def mark_error(
        self,
        job_id: str,
        error: str,
        result: dict[str, Any] | None = None,
        error_kind: str | None = None,
    ) -> bool:
        now = int(time.time())
        result_json = json.dumps(result) if result is not None else None
        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE jobs
                SET status = ?, finished_at = ?, result_json = ?, error = ?, error_kind = ?
                WHERE id = ?
                  AND status IN ('queued', 'running')
                """,
                ("error", now, result_json, error, error_kind, job_id),
            )
        return cursor.rowcount > 0

    def get_job(self, job_id: str) -> dict[str, Any] | None:
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
            "error_kind": row["error_kind"],
        }

    def count_by_status(self) -> dict[str, int]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT status, COUNT(*) as count
                FROM jobs
                GROUP BY status
                """
            ).fetchall()
        return {row["status"]: row["count"] for row in rows}
