"""Worker loop for executing judge jobs."""

import argparse
import logging
import time
from typing import Any

from judge.config import load_settings
from judge.metrics import (
    job_finished,
    job_started,
    observe_job_duration,
    observe_job_queue_wait,
    register_process_exit,
    worker_heartbeat,
)
from judge.problems import ProblemRepository
from judge.queue import RedisQueue
from judge.results import ResultsStore
from judge.runner import IsolateConfig, run_problem

logger = logging.getLogger(__name__)


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


def main() -> None:
    args = _parse_args()
    settings = load_settings()
    register_process_exit()

    queue = RedisQueue(settings.redis_url)
    queue.ensure_group(args.stream, args.group)

    results = ResultsStore(settings.results_db)
    problems = ProblemRepository(settings.problems_root)
    isolate = IsolateConfig(
        executable=settings.isolate_bin,
        box_id=_derive_isolate_box_id(args.stream, args.consumer),
        use_cgroups=settings.isolate_use_cgroups,
        process_limit=settings.isolate_process_limit,
        wall_time_extra_s=settings.isolate_wall_time_extra_s,
        timeout_grace_s=settings.isolate_timeout_grace_s,
        fsize_kb=settings.isolate_fsize_kb,
        python_bin=settings.python_bin,
    )
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
                    results.mark_error(
                        job_id,
                        f"Invalid queue payload: {parse_error}",
                        error_kind="internal",
                    )
                except Exception:
                    logger.exception(
                        "Failed to persist invalid queue payload error: stream=%s msg_id=%s job_id=%s",
                        args.stream,
                        msg_id,
                        job_id,
                    )
            try:
                queue.ack(args.stream, args.group, msg_id)
            except Exception:
                logger.exception(
                    "Failed to ack invalid queue message: stream=%s group=%s msg_id=%s",
                    args.stream,
                    args.group,
                    msg_id,
                )
            return

        job_id = parsed["job_id"]
        problem_key = parsed["problem_key"]
        kind = parsed["kind"]
        code = parsed["code"]
        created_at = parsed["created_at"]
        profile = worker_profile

        started_at = time.perf_counter()
        job_started(profile, kind)
        observe_job_queue_wait(profile, created_at)
        status = "error"
        error_kind = "internal"
        should_ack = False

        try:
            results.mark_running(job_id)

            if kind == "run":
                problem = problems.get_for_run(problem_key)
                include_hidden = False
                detail_mode = "all"
            else:
                problem = problems.get_for_submit(problem_key)
                include_hidden = True
                detail_mode = "first_failure"
            result = run_problem(
                problem,
                code,
                settings.max_output_chars,
                include_hidden=include_hidden,
                detail_mode=detail_mode,
                isolate=isolate,
            )
            if result.get("error"):
                error_kind = result.get("error_kind", "internal")
                results.mark_error(
                    job_id,
                    str(result["error"]),
                    result,
                    error_kind=error_kind,
                )
                should_ack = True
            else:
                status = "done"
                error_kind = "none"
                results.mark_done(job_id, result)
                should_ack = True
        except Exception as exc:
            logger.exception(
                "Worker failed while processing job: stream=%s msg_id=%s job_id=%s",
                args.stream,
                msg_id,
                job_id,
            )
            try:
                results.mark_error(job_id, f"Worker error: {exc}", error_kind="internal")
                should_ack = True
            except Exception:
                logger.exception(
                    "Failed to persist worker error result: stream=%s msg_id=%s job_id=%s",
                    args.stream,
                    msg_id,
                    job_id,
                )
                should_ack = False
        finally:
            duration = time.perf_counter() - started_at
            observe_job_duration(profile, duration)
            job_finished(profile, status, error_kind)
            worker_heartbeat(worker_profile, args.consumer)
            if should_ack:
                try:
                    queue.ack(args.stream, args.group, msg_id)
                except Exception:
                    logger.exception(
                        "Failed to ack processed message: stream=%s group=%s msg_id=%s job_id=%s",
                        args.stream,
                        args.group,
                        msg_id,
                        job_id,
                    )

    while True:
        worker_heartbeat(worker_profile, args.consumer)
        now = time.time()
        if now - last_reclaim > args.reclaim_interval:
            reclaimed = queue.autoclaim(
                args.stream,
                args.group,
                args.consumer,
                min_idle_ms=settings.job_claim_idle_ms,
                count=settings.job_claim_count,
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
