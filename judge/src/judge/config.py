"""Service configuration."""

import os
import sys
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
    isolate_bin: str
    isolate_use_cgroups: bool
    isolate_process_limit: int
    isolate_wall_time_extra_s: int
    isolate_timeout_grace_s: int
    isolate_fsize_kb: int
    python_bin: str
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
    isolate_bin = os.getenv("JUDGE_ISOLATE_BIN", "/usr/bin/isolate").strip()
    if not isolate_bin:
        raise ValueError("JUDGE_ISOLATE_BIN must not be empty")

    use_cgroups_raw = os.getenv("JUDGE_ISOLATE_USE_CGROUPS", "1").strip().lower()
    isolate_use_cgroups = use_cgroups_raw not in {"0", "false", "no", "off"}
    isolate_process_limit = int(os.getenv("JUDGE_ISOLATE_PROCESSES", "64"))
    isolate_wall_time_extra_s = int(os.getenv("JUDGE_ISOLATE_WALL_TIME_EXTRA_S", "2"))
    isolate_timeout_grace_s = int(os.getenv("JUDGE_ISOLATE_TIMEOUT_GRACE_S", "5"))
    isolate_fsize_kb = int(os.getenv("JUDGE_ISOLATE_FSIZE_KB", "1024"))
    python_bin = os.getenv("JUDGE_PYTHON_BIN", sys.executable).strip()
    if isolate_process_limit < 1:
        raise ValueError("JUDGE_ISOLATE_PROCESSES must be >= 1")
    if isolate_wall_time_extra_s < 0:
        raise ValueError("JUDGE_ISOLATE_WALL_TIME_EXTRA_S must be >= 0")
    if isolate_timeout_grace_s < 0:
        raise ValueError("JUDGE_ISOLATE_TIMEOUT_GRACE_S must be >= 0")
    if isolate_fsize_kb < 1:
        raise ValueError("JUDGE_ISOLATE_FSIZE_KB must be >= 1")
    if not python_bin:
        raise ValueError("JUDGE_PYTHON_BIN must not be empty")

    origins_raw = os.getenv("JUDGE_ALLOWED_ORIGINS", "")
    allowed_origins = [origin.strip() for origin in origins_raw.split(",") if origin.strip()]

    return Settings(
        redis_url=redis_url,
        results_db=results_db,
        problems_root=problems_root,
        max_output_chars=max_output_chars,
        job_claim_idle_ms=job_claim_idle_ms,
        job_claim_count=job_claim_count,
        isolate_bin=isolate_bin,
        isolate_use_cgroups=isolate_use_cgroups,
        isolate_process_limit=isolate_process_limit,
        isolate_wall_time_extra_s=isolate_wall_time_extra_s,
        isolate_timeout_grace_s=isolate_timeout_grace_s,
        isolate_fsize_kb=isolate_fsize_kb,
        python_bin=python_bin,
        allowed_origins=allowed_origins,
    )
