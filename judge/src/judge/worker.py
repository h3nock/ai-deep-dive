"""Worker loop for executing judge jobs."""

import argparse
import time

from judge.config import load_settings
from judge.metrics import (
    job_finished,
    job_started,
    observe_job_duration,
    observe_job_queue_wait,
    register_process_exit,
)
from judge.problems import ProblemRepository
from judge.queue import RedisQueue
from judge.results import ResultsStore
from judge.runner import IsolateConfig, run_problem


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

    last_reclaim = 0.0

    def process_entry(msg_id: str, fields: dict[str, str]) -> None:
        job_id = fields.get("job_id", "")
        problem_id = fields.get("problem_id", "")
        kind = fields.get("kind", "submit")
        code = fields.get("code", "")
        profile = fields.get("profile", "") or "unknown"
        created_at_raw = fields.get("created_at", "").strip()
        created_at = int(created_at_raw) if created_at_raw.isdigit() else None

        if not job_id or not problem_id:
            queue.ack(args.stream, args.group, msg_id)
            return

        started_at = time.perf_counter()
        job_started(profile, kind)
        observe_job_queue_wait(profile, created_at)
        status = "error"
        error_kind = "internal"

        try:
            results.mark_running(job_id)
            if kind not in {"run", "submit"}:
                results.mark_error(job_id, f"Invalid job kind: {kind}", error_kind="internal")
                return

            if kind == "run":
                problem = problems.get_for_run(problem_id)
                include_hidden = False
                detail_mode = "all"
            else:
                problem = problems.get_for_submit(problem_id)
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
            else:
                status = "done"
                error_kind = "none"
                results.mark_done(job_id, result)
        except Exception as exc:
            results.mark_error(job_id, f"Worker error: {exc}", error_kind="internal")
        finally:
            duration = time.perf_counter() - started_at
            observe_job_duration(profile, duration)
            job_finished(profile, status, error_kind)
            queue.ack(args.stream, args.group, msg_id)

    while True:
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
