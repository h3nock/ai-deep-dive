"""Prometheus metrics helpers."""

from __future__ import annotations

import atexit
import os
import time
from collections.abc import Iterable
from typing import Any

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
    multiprocess,
)

_MULTIPROC_DIR = os.getenv("PROMETHEUS_MULTIPROC_DIR", "").strip()
if _MULTIPROC_DIR:
    os.makedirs(_MULTIPROC_DIR, exist_ok=True)

_JOB_STATUSES = ("queued", "running", "done", "error")


HTTP_REQUESTS_TOTAL = Counter(
    "judge_http_requests_total",
    "HTTP requests",
    ["method", "path", "status"],
)
HTTP_REQUEST_LATENCY_SECONDS = Histogram(
    "judge_http_request_latency_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)

JOB_STARTED_TOTAL = Counter(
    "judge_job_started_total",
    "Jobs started by workers",
    ["profile", "kind"],
)
JOB_FINISHED_TOTAL = Counter(
    "judge_job_finished_total",
    "Jobs finished by workers",
    ["profile", "status", "error_kind"],
)
JOB_DURATION_SECONDS = Histogram(
    "judge_job_duration_seconds",
    "Job execution time in seconds",
    ["profile"],
    buckets=(0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 60),
)
JOB_QUEUE_WAIT_SECONDS = Histogram(
    "judge_job_queue_wait_seconds",
    "Time between enqueue and start in seconds",
    ["profile"],
    buckets=(0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 60, 120),
)
JOBS_IN_PROGRESS = Gauge(
    "judge_jobs_in_progress",
    "Jobs currently running",
    ["profile"],
    multiprocess_mode="livesum",
)
QUEUE_STREAM_LENGTH = Gauge(
    "judge_queue_stream_length",
    "Redis stream length",
    ["stream"],
    multiprocess_mode="livemax",
)
QUEUE_GROUP_LAG = Gauge(
    "judge_queue_group_lag",
    "Redis consumer group lag by stream/group",
    ["stream", "group"],
    multiprocess_mode="livemax",
)
QUEUE_GROUP_PENDING = Gauge(
    "judge_queue_group_pending",
    "Redis consumer group pending entries by stream/group",
    ["stream", "group"],
    multiprocess_mode="livemax",
)
JOBS_BY_STATUS = Gauge(
    "judge_jobs_in_status",
    "Jobs by status in SQLite",
    ["status"],
    multiprocess_mode="livemax",
)


def register_process_exit() -> None:
    if not _MULTIPROC_DIR:
        return
    pid = os.getpid()

    def _cleanup() -> None:
        try:
            multiprocess.mark_process_dead(pid)
        except Exception:
            return

    atexit.register(_cleanup)


def record_http_request(method: str, path: str, status: int, duration_s: float) -> None:
    HTTP_REQUESTS_TOTAL.labels(method=method, path=path, status=str(status)).inc()
    HTTP_REQUEST_LATENCY_SECONDS.labels(method=method, path=path).observe(duration_s)


def job_started(profile: str, kind: str) -> None:
    JOB_STARTED_TOTAL.labels(profile=profile, kind=kind).inc()
    JOBS_IN_PROGRESS.labels(profile=profile).set(1)


def job_finished(profile: str, status: str, error_kind: str | None) -> None:
    error_label = error_kind or "none"
    JOB_FINISHED_TOTAL.labels(profile=profile, status=status, error_kind=error_label).inc()
    JOBS_IN_PROGRESS.labels(profile=profile).set(0)


def observe_job_duration(profile: str, duration_s: float) -> None:
    JOB_DURATION_SECONDS.labels(profile=profile).observe(duration_s)


def observe_job_queue_wait(profile: str, created_at: float | None) -> None:
    if created_at is None:
        return
    wait_s = max(0.0, time.time() - created_at)
    JOB_QUEUE_WAIT_SECONDS.labels(profile=profile).observe(wait_s)


def update_runtime_metrics(
    queue_client: object | None,
    results_store: object | None,
    streams: Iterable[str],
    stream_groups: dict[str, str] | None = None,
) -> None:
    stream_group_map = stream_groups or {}

    if queue_client is not None:
        for stream in streams:
            try:
                length = queue_client.xlen(stream)
            except Exception:
                continue
            QUEUE_STREAM_LENGTH.labels(stream=stream).set(length)

            group_name = stream_group_map.get(stream)
            if not group_name:
                continue

            try:
                groups_raw = queue_client.xinfo_groups(stream)
            except Exception:
                continue

            group_info: dict[str, Any] | None = None
            for item in groups_raw:
                if isinstance(item, dict) and str(item.get("name", "")) == group_name:
                    group_info = item
                    break

            if group_info is None:
                QUEUE_GROUP_LAG.labels(stream=stream, group=group_name).set(0)
                QUEUE_GROUP_PENDING.labels(stream=stream, group=group_name).set(0)
                continue

            lag_raw = group_info.get("lag")
            pending_raw = group_info.get("pending")
            try:
                lag_value = int(lag_raw) if lag_raw is not None else 0
            except (TypeError, ValueError):
                lag_value = 0
            try:
                pending_value = int(pending_raw) if pending_raw is not None else 0
            except (TypeError, ValueError):
                pending_value = 0

            QUEUE_GROUP_LAG.labels(stream=stream, group=group_name).set(max(lag_value, 0))
            QUEUE_GROUP_PENDING.labels(stream=stream, group=group_name).set(max(pending_value, 0))

    if results_store is not None:
        try:
            counts = results_store.count_by_status()
        except Exception:
            counts = {}
        for status in _JOB_STATUSES:
            JOBS_BY_STATUS.labels(status=status).set(counts.get(status, 0))


def render_metrics() -> tuple[bytes, str]:
    if _MULTIPROC_DIR:
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        data = generate_latest(registry)
    else:
        data = generate_latest()
    return data, CONTENT_TYPE_LATEST
