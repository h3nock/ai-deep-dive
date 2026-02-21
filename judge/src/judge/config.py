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
    queue_maxlen: int
    job_claim_idle_ms: int
    job_claim_count: int
    isolate_bin: str
    isolate_use_cgroups: bool
    isolate_process_limit: int
    isolate_wall_time_extra_s: int
    isolate_timeout_grace_s: int
    isolate_fsize_kb: int
    python_bin: str
    torch_execution_mode: str
    warm_fork_enable_no_new_privs: bool
    warm_fork_enable_seccomp: bool
    warm_fork_seccomp_fail_closed: bool
    warm_fork_clear_env: bool
    warm_fork_deny_filesystem: bool
    warm_fork_allow_root: bool
    warm_fork_child_nofile: int
    warm_fork_enable_cgroup: bool
    warm_fork_max_jobs: int
    allowed_origins: list[str]


def _base_dir() -> Path:
    return Path(__file__).resolve().parents[2]


def load_settings() -> Settings:
    base_dir = _base_dir()

    redis_url = os.getenv("JUDGE_REDIS_URL", "redis://localhost:6379/0")
    results_db = Path(os.getenv("JUDGE_RESULTS_DB", str(base_dir / "data" / "judge.db")))
    problems_root = Path(os.getenv("JUDGE_PROBLEMS_ROOT", str(base_dir / "problems")))
    max_output_chars = int(os.getenv("JUDGE_MAX_OUTPUT_CHARS", "2000"))
    queue_maxlen = int(os.getenv("JUDGE_QUEUE_MAXLEN", "10000"))
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
    torch_execution_mode = os.getenv("JUDGE_TORCH_EXECUTION_MODE", "isolate").strip().lower()
    warm_no_new_privs_raw = os.getenv("JUDGE_WARM_FORK_ENABLE_NO_NEW_PRIVS", "1").strip().lower()
    warm_fork_enable_no_new_privs = warm_no_new_privs_raw not in {"0", "false", "no", "off"}
    warm_enable_seccomp_raw = os.getenv("JUDGE_WARM_FORK_ENABLE_SECCOMP", "1").strip().lower()
    warm_fork_enable_seccomp = warm_enable_seccomp_raw not in {"0", "false", "no", "off"}
    warm_seccomp_fail_closed_raw = os.getenv(
        "JUDGE_WARM_FORK_SECCOMP_FAIL_CLOSED",
        "1",
    ).strip().lower()
    warm_fork_seccomp_fail_closed = warm_seccomp_fail_closed_raw not in {
        "0",
        "false",
        "no",
        "off",
    }
    warm_clear_env_raw = os.getenv("JUDGE_WARM_FORK_CLEAR_ENV", "1").strip().lower()
    warm_fork_clear_env = warm_clear_env_raw not in {"0", "false", "no", "off"}
    warm_deny_filesystem_raw = os.getenv("JUDGE_WARM_FORK_DENY_FILESYSTEM", "1").strip().lower()
    warm_fork_deny_filesystem = warm_deny_filesystem_raw not in {"0", "false", "no", "off"}
    warm_allow_root_raw = os.getenv("JUDGE_WARM_FORK_ALLOW_ROOT", "0").strip().lower()
    warm_fork_allow_root = warm_allow_root_raw not in {"0", "false", "no", "off"}
    warm_fork_child_nofile = int(os.getenv("JUDGE_WARM_FORK_CHILD_NOFILE", "64"))
    warm_enable_cgroup_raw = os.getenv("JUDGE_WARM_FORK_ENABLE_CGROUP", "1").strip().lower()
    warm_fork_enable_cgroup = warm_enable_cgroup_raw not in {"0", "false", "no", "off"}
    warm_fork_max_jobs = int(os.getenv("JUDGE_WARM_FORK_MAX_JOBS", "0"))

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
    if queue_maxlen < 0:
        raise ValueError("JUDGE_QUEUE_MAXLEN must be >= 0")
    if torch_execution_mode not in {"isolate", "warm_fork"}:
        raise ValueError("JUDGE_TORCH_EXECUTION_MODE must be one of: isolate, warm_fork")
    if warm_fork_enable_seccomp and not warm_fork_enable_no_new_privs:
        raise ValueError(
            "JUDGE_WARM_FORK_ENABLE_NO_NEW_PRIVS must be enabled when JUDGE_WARM_FORK_ENABLE_SECCOMP=1"
        )
    if warm_fork_child_nofile < 16:
        raise ValueError("JUDGE_WARM_FORK_CHILD_NOFILE must be >= 16")
    if warm_fork_max_jobs < 0:
        raise ValueError("JUDGE_WARM_FORK_MAX_JOBS must be >= 0")

    origins_raw = os.getenv("JUDGE_ALLOWED_ORIGINS", "")
    allowed_origins = [origin.strip() for origin in origins_raw.split(",") if origin.strip()]

    return Settings(
        redis_url=redis_url,
        results_db=results_db,
        problems_root=problems_root,
        max_output_chars=max_output_chars,
        queue_maxlen=queue_maxlen,
        job_claim_idle_ms=job_claim_idle_ms,
        job_claim_count=job_claim_count,
        isolate_bin=isolate_bin,
        isolate_use_cgroups=isolate_use_cgroups,
        isolate_process_limit=isolate_process_limit,
        isolate_wall_time_extra_s=isolate_wall_time_extra_s,
        isolate_timeout_grace_s=isolate_timeout_grace_s,
        isolate_fsize_kb=isolate_fsize_kb,
        python_bin=python_bin,
        torch_execution_mode=torch_execution_mode,
        warm_fork_enable_no_new_privs=warm_fork_enable_no_new_privs,
        warm_fork_enable_seccomp=warm_fork_enable_seccomp,
        warm_fork_seccomp_fail_closed=warm_fork_seccomp_fail_closed,
        warm_fork_clear_env=warm_fork_clear_env,
        warm_fork_deny_filesystem=warm_fork_deny_filesystem,
        warm_fork_allow_root=warm_fork_allow_root,
        warm_fork_child_nofile=warm_fork_child_nofile,
        warm_fork_enable_cgroup=warm_fork_enable_cgroup,
        warm_fork_max_jobs=warm_fork_max_jobs,
        allowed_origins=allowed_origins,
    )
