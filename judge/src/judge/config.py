"""Service configuration."""

import json
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    redis_url: str
    results_db: Path
    problems_root: Path
    max_output_chars: int
    job_claim_idle_ms: int
    job_claim_count: int
    sandbox_cmd: list[str]
    allowed_origins: list[str]


def _base_dir() -> Path:
    return Path(__file__).resolve().parents[2]


def load_settings() -> Settings:
    base_dir = _base_dir()

    redis_url = os.getenv("JUDGE_REDIS_URL", "redis://localhost:6379/0")
    results_db = Path(os.getenv("JUDGE_RESULTS_DB", str(base_dir / "data" / "judge.db")))
    problems_root = Path(os.getenv("JUDGE_PROBLEMS_ROOT", str(base_dir / "problems")))
    max_output_chars = int(os.getenv("JUDGE_MAX_OUTPUT_CHARS", "2000"))
    job_claim_idle_ms = int(os.getenv("JUDGE_JOB_CLAIM_IDLE_MS", "30000"))
    job_claim_count = int(os.getenv("JUDGE_JOB_CLAIM_COUNT", "10"))
    sandbox_cmd = []
    sandbox_json = os.getenv("JUDGE_SANDBOX_CMD_JSON", "").strip()
    if sandbox_json:
        try:
            sandbox_cmd = json.loads(sandbox_json)
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid JUDGE_SANDBOX_CMD_JSON") from exc
    origins_raw = os.getenv("JUDGE_ALLOWED_ORIGINS", "")
    allowed_origins = [origin.strip() for origin in origins_raw.split(",") if origin.strip()]

    return Settings(
        redis_url=redis_url,
        results_db=results_db,
        problems_root=problems_root,
        max_output_chars=max_output_chars,
        job_claim_idle_ms=job_claim_idle_ms,
        job_claim_count=job_claim_count,
        sandbox_cmd=sandbox_cmd,
        allowed_origins=allowed_origins,
    )
