"""Periodic cleanup for judge data."""

from __future__ import annotations

import os
import sqlite3
import time

from judge.config import load_settings


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc


def _cleanup_jobs(db_path: str, retention_days: int) -> int:
    if retention_days <= 0:
        return 0
    cutoff = int(time.time()) - retention_days * 86400
    with sqlite3.connect(db_path) as conn:
        cur = conn.execute(
            """
            DELETE FROM jobs
            WHERE status IN ('done', 'error')
              AND finished_at IS NOT NULL
              AND finished_at < ?
            """,
            (cutoff,),
        )
        conn.commit()
        return cur.rowcount if cur.rowcount is not None else 0


def main() -> None:
    settings = load_settings()
    retention_days = _env_int("JUDGE_JOB_RETENTION_DAYS", 7)

    deleted = _cleanup_jobs(str(settings.results_db), retention_days)

    print(
        f"cleanup: deleted_jobs={deleted} "
        f"retention_days={retention_days}"
    )


if __name__ == "__main__":
    main()
