"""Worker loop for executing judge jobs."""

import argparse
import json
import time

from judge.config import load_settings
from judge.problems import load_problem
from judge.queue import RedisQueue
from judge.results import ResultsStore
from judge.runner import run_problem


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Judge worker")
    parser.add_argument("--stream", required=True, help="Redis stream name")
    parser.add_argument("--group", required=True, help="Redis consumer group")
    parser.add_argument("--consumer", required=True, help="Consumer name")
    parser.add_argument("--reclaim-interval", type=int, default=30, help="Seconds")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    settings = load_settings()

    queue = RedisQueue(settings.redis_url)
    queue.ensure_group(args.stream, args.group)

    results = ResultsStore(settings.results_db)

    last_reclaim = 0.0

    def process_entry(msg_id: str, fields: dict[str, str]) -> None:
        payload_raw = fields.get("payload")
        if not payload_raw:
            queue.ack(args.stream, args.group, msg_id)
            return

        try:
            payload = json.loads(payload_raw)
        except json.JSONDecodeError:
            queue.ack(args.stream, args.group, msg_id)
            return

        job_id = payload.get("job_id", "")
        problem_id = payload.get("problem_id", "")
        kind = payload.get("kind", "submit")
        code = payload.get("code", "")

        if not job_id or not problem_id:
            queue.ack(args.stream, args.group, msg_id)
            return

        try:
            results.mark_running(job_id)
            problem = load_problem(problem_id, settings.problems_root)
            include_hidden = kind != "run"
            result = run_problem(
                problem,
                code,
                settings.max_output_chars,
                include_hidden=include_hidden,
                sandbox_cmd=settings.sandbox_cmd or None,
            )
            results.mark_done(job_id, result)
        except Exception as exc:
            results.mark_error(job_id, f"Worker error: {exc}")
        finally:
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
