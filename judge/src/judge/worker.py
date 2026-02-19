"""Worker loop for executing judge jobs."""

from __future__ import annotations

import argparse
import logging
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from judge.config import Settings, load_settings
from judge.metrics import (
    job_finished,
    job_started,
    observe_job_duration,
    observe_job_queue_wait,
    register_process_exit,
    worker_heartbeat,
)
from judge.runner import IsolateConfig
from judge.services import WorkerExecutionService, WorkerJob

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from judge.problems import ProblemRepository
    from judge.queue import RedisQueue
    from judge.results import ResultsStore


@dataclass(frozen=True)
class WorkerDependencies:
    settings: Settings
    queue: RedisQueue
    results: ResultsStore
    problems: ProblemRepository
    execution: WorkerExecutionService


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Judge worker")
    parser.add_argument("--stream", required=True, help="Redis stream name")
    parser.add_argument("--group", required=True, help="Redis consumer group")
    parser.add_argument("--consumer", required=True, help="Consumer name")
    parser.add_argument("--reclaim-interval", type=int, default=30, help="Seconds")
    return parser.parse_args()


def _derive_isolate_box_id(stream: str, consumer: str) -> int:
    suffix = consumer.rsplit("-", 1)[-1]
    if not suffix.isdigit():
        raise ValueError(f"Invalid worker consumer name for isolate box id: {consumer}")

    index = int(suffix)
    if index < 1 or index > 49:
        raise ValueError(f"Worker index out of supported range (1-49): {consumer}")

    if stream == "queue:light":
        return index
    if stream == "queue:torch":
        return 50 + index
    raise ValueError(f"Unsupported stream for isolate box mapping: {stream}")


def _profile_for_stream(stream: str) -> str:
    if stream == "queue:light":
        return "light"
    if stream == "queue:torch":
        return "torch"
    return "unknown"


def _parse_queue_message(fields: dict[str, str]) -> tuple[dict[str, Any], str | None]:
    job_id = fields.get("job_id", "").strip()
    if not job_id:
        return {}, "missing job_id"

    problem_key = fields.get("problem_key", "").strip() or fields.get("problem_id", "").strip()
    if not problem_key:
        return {}, "missing problem_key/problem_id"

    kind = fields.get("kind", "submit").strip()
    if kind not in {"run", "submit"}:
        return {}, f"invalid kind: {kind or '<empty>'}"

    code = fields.get("code", "")
    if not isinstance(code, str):
        return {}, "invalid code field"

    created_at_raw = fields.get("created_at", "").strip()
    if created_at_raw and not created_at_raw.isdigit():
        return {}, f"invalid created_at: {created_at_raw}"

    return {
        "job_id": job_id,
        "problem_key": problem_key,
        "kind": kind,
        "code": code,
        "created_at": int(created_at_raw) if created_at_raw else None,
    }, None


def build_worker_dependencies(
    *,
    stream: str,
    consumer: str,
    settings: Settings | None = None,
) -> WorkerDependencies:
    from judge.problems import ProblemRepository
    from judge.queue import RedisQueue
    from judge.results import ResultsStore

    resolved_settings = settings or load_settings()
    queue = RedisQueue(resolved_settings.redis_url)
    results = ResultsStore(resolved_settings.results_db)
    problems = ProblemRepository(resolved_settings.problems_root)
    isolate = IsolateConfig(
        executable=resolved_settings.isolate_bin,
        box_id=_derive_isolate_box_id(stream, consumer),
        use_cgroups=resolved_settings.isolate_use_cgroups,
        process_limit=resolved_settings.isolate_process_limit,
        wall_time_extra_s=resolved_settings.isolate_wall_time_extra_s,
        timeout_grace_s=resolved_settings.isolate_timeout_grace_s,
        fsize_kb=resolved_settings.isolate_fsize_kb,
        python_bin=resolved_settings.python_bin,
    )
    execution = WorkerExecutionService(
        results=results,
        problems=problems,
        isolate=isolate,
        max_output_chars=resolved_settings.max_output_chars,
        log=logger,
    )
    return WorkerDependencies(
        settings=resolved_settings,
        queue=queue,
        results=results,
        problems=problems,
        execution=execution,
    )


def main() -> None:
    args = _parse_args()
    register_process_exit()

    dependencies = build_worker_dependencies(stream=args.stream, consumer=args.consumer)
    queue = dependencies.queue
    results = dependencies.results
    execution = dependencies.execution

    queue.ensure_group(args.stream, args.group)

    worker_profile = _profile_for_stream(args.stream)
    worker_heartbeat(worker_profile, args.consumer)

    last_reclaim = 0.0

    def process_entry(msg_id: str, fields: dict[str, str]) -> None:
        worker_heartbeat(worker_profile, args.consumer)
        parsed, parse_error = _parse_queue_message(fields)
        if parse_error:
            logger.error(
                "Invalid queue message: stream=%s group=%s msg_id=%s error=%s",
                args.stream,
                args.group,
                msg_id,
                parse_error,
            )
            job_id = fields.get("job_id", "").strip()
            if job_id:
                try:
                    persisted = results.mark_error(
                        job_id,
                        f"Invalid queue payload: {parse_error}",
                        error_kind="internal",
                    )
                    if not persisted:
                        logger.error(
                            "Failed to persist invalid queue payload error: row not updatable stream=%s msg_id=%s job_id=%s",
                            args.stream,
                            msg_id,
                            job_id,
                        )
                except Exception:
                    logger.exception(
                        "Failed to persist invalid queue payload error: stream=%s msg_id=%s job_id=%s",
                        args.stream,
                        msg_id,
                        job_id,
                    )
            try:
                queue.ack_and_delete(args.stream, args.group, msg_id)
            except Exception:
                logger.exception(
                    "Failed to ack/delete invalid queue message: stream=%s group=%s msg_id=%s",
                    args.stream,
                    args.group,
                    msg_id,
                )
            return

        job = WorkerJob(
            job_id=parsed["job_id"],
            problem_key=parsed["problem_key"],
            kind=parsed["kind"],
            code=parsed["code"],
        )
        created_at = parsed["created_at"]

        execution_started_at: float | None = None

        def _on_started() -> None:
            nonlocal execution_started_at
            execution_started_at = time.perf_counter()
            job_started(worker_profile, job.kind)
            observe_job_queue_wait(worker_profile, created_at)

        outcome = execution.execute(job, on_started=_on_started)

        if outcome.executed:
            if execution_started_at is None:
                execution_started_at = time.perf_counter()
            duration = time.perf_counter() - execution_started_at
            observe_job_duration(worker_profile, duration)
            job_finished(worker_profile, outcome.status, outcome.error_kind)

        worker_heartbeat(worker_profile, args.consumer)

        if outcome.should_ack:
            try:
                queue.ack_and_delete(args.stream, args.group, msg_id)
            except Exception:
                logger.exception(
                    "Failed to ack/delete processed message: stream=%s group=%s msg_id=%s job_id=%s",
                    args.stream,
                    args.group,
                    msg_id,
                    job.job_id,
                )

    while True:
        worker_heartbeat(worker_profile, args.consumer)
        now = time.time()
        if now - last_reclaim > args.reclaim_interval:
            reclaimed = queue.autoclaim(
                args.stream,
                args.group,
                args.consumer,
                min_idle_ms=dependencies.settings.job_claim_idle_ms,
                count=dependencies.settings.job_claim_count,
            )
            for msg_id, fields in reclaimed:
                process_entry(msg_id, fields)
            last_reclaim = now

        entry = queue.read(args.stream, args.group, args.consumer)
        if entry is None:
            continue

        msg_id, fields = entry
        process_entry(msg_id, fields)


if __name__ == "__main__":
    main()
