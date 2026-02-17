"""Periodic cleanup for judge data."""

from __future__ import annotations

import os
import sqlite3
import time
from collections.abc import Iterable

from judge.config import load_settings
from judge.queue import RedisQueue


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


def _trim_streams(redis_url: str, streams: Iterable[str], maxlen: int) -> int:
    if maxlen <= 0:
        return 0
    queue = RedisQueue(redis_url)
    trimmed = 0
    for stream in streams:
        stream = stream.strip()
        if not stream:
            continue
        queue.client.xtrim(stream, maxlen=maxlen, approximate=True)
        trimmed += 1
    return trimmed


def main() -> None:
    settings = load_settings()
    retention_days = _env_int("JUDGE_JOB_RETENTION_DAYS", 7)
    queue_maxlen = _env_int("JUDGE_QUEUE_MAXLEN", 10000)
    streams_raw = os.getenv("JUDGE_QUEUE_STREAMS", "queue:light,queue:torch")
    streams = [s.strip() for s in streams_raw.split(",") if s.strip()]

    deleted = _cleanup_jobs(str(settings.results_db), retention_days)
    trimmed = _trim_streams(settings.redis_url, streams, queue_maxlen)

    print(
        f"cleanup: deleted_jobs={deleted} "
        f"retention_days={retention_days} "
        f"trimmed_streams={trimmed} "
        f"queue_maxlen={queue_maxlen}"
    )


if __name__ == "__main__":
    main()
