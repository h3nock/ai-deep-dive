"""Redis Streams queue helpers."""

from typing import Any

import redis
from redis.exceptions import ResponseError


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
        created_at = payload.get("created_at")
        fields = {
            "job_id": payload.get("job_id", ""),
            "problem_id": payload.get("problem_id", ""),
            "problem_key": payload.get("problem_key", payload.get("problem_id", "")),
            "profile": payload.get("profile", ""),
            "kind": payload.get("kind", "submit"),
            "code": payload.get("code", ""),
            "created_at": str(created_at) if created_at is not None else "",
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
