"""Redis Streams queue helpers."""

from typing import Any

import redis
from redis.exceptions import ResponseError

_ALLOWED_KINDS = {"run", "submit"}


def _require_non_empty_str(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Queue payload field '{key}' must be a non-empty string")
    return value.strip()


class RedisQueue:
    def __init__(self, redis_url: str) -> None:
        self.client = redis.Redis.from_url(redis_url, decode_responses=True)

    def ensure_group(self, stream: str, group: str) -> None:
        try:
            self.client.xgroup_create(stream, group, id="0", mkstream=True)
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    def enqueue(self, stream: str, payload: dict[str, Any]) -> str:
        job_id = _require_non_empty_str(payload, "job_id")
        problem_id = _require_non_empty_str(payload, "problem_id")
        problem_key_raw = payload.get("problem_key", problem_id)
        if not isinstance(problem_key_raw, str) or not problem_key_raw.strip():
            raise ValueError("Queue payload field 'problem_key' must be a non-empty string")
        problem_key = problem_key_raw.strip()
        profile = _require_non_empty_str(payload, "profile")
        kind = payload.get("kind", "submit")
        if not isinstance(kind, str) or kind not in _ALLOWED_KINDS:
            raise ValueError(
                "Queue payload field 'kind' must be one of: run, submit"
            )
        code = payload.get("code", "")
        if not isinstance(code, str):
            raise ValueError("Queue payload field 'code' must be a string")

        created_at = payload.get("created_at")
        if created_at is None:
            created_at_field = ""
        elif isinstance(created_at, int) and not isinstance(created_at, bool):
            created_at_field = str(created_at)
        elif isinstance(created_at, str) and created_at.strip().isdigit():
            created_at_field = created_at.strip()
        else:
            raise ValueError(
                "Queue payload field 'created_at' must be an integer unix timestamp"
            )

        fields = {
            "job_id": job_id,
            "problem_id": problem_id,
            "problem_key": problem_key,
            "profile": profile,
            "kind": kind,
            "code": code,
            "created_at": created_at_field,
        }
        return self.client.xadd(stream, fields)

    def read(self, stream: str, group: str, consumer: str, block_ms: int = 5000) -> tuple[str, dict[str, str]] | None:
        entries = self.client.xreadgroup(
            group,
            consumer,
            streams={stream: ">"},
            count=1,
            block=block_ms,
        )
        if not entries:
            return None
        _, messages = entries[0]
        msg_id, fields = messages[0]
        return msg_id, fields

    def ack(self, stream: str, group: str, msg_id: str) -> None:
        self.client.xack(stream, group, msg_id)

    def ack_and_delete(self, stream: str, group: str, msg_id: str) -> tuple[int, int]:
        acked = int(self.client.xack(stream, group, msg_id))
        deleted = int(self.client.xdel(stream, msg_id))
        return acked, deleted

    def backlog(self, stream: str, group: str) -> int:
        try:
            groups = self.client.xinfo_groups(stream)
        except ResponseError:
            return 0

        for info in groups:
            if info.get("name") != group:
                continue
            pending = int(info.get("pending", 0))
            lag_raw = info.get("lag")
            lag = int(lag_raw) if isinstance(lag_raw, int) else 0
            if lag < 0:
                lag = 0
            return pending + lag
        return 0

    def autoclaim(
        self,
        stream: str,
        group: str,
        consumer: str,
        min_idle_ms: int,
        count: int = 10,
    ) -> list[tuple[str, dict[str, str]]]:
        try:
            result = self.client.xautoclaim(
                stream,
                group,
                consumer,
                min_idle_ms,
                start_id="0-0",
                count=count,
            )
        except ResponseError:
            return []

        if isinstance(result, (list, tuple)):
            if len(result) >= 2:
                messages = result[1]
            else:
                return []
        else:
            return []
        return messages
