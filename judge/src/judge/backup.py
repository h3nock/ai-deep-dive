"""Daily backup for the SQLite results database."""

from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path

from judge.config import load_settings


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc


def _backup_path(backup_dir: Path) -> Path:
    stamp = time.strftime("%Y%m%d")
    path = backup_dir / f"judge-{stamp}.sqlite"
    if path.exists():
        stamp = time.strftime("%Y%m%d-%H%M%S")
        path = backup_dir / f"judge-{stamp}.sqlite"
    return path


def _copy_db(src: Path, dest: Path) -> None:
    src_path = Path(src)
    if not src_path.exists() or not src_path.is_file():
        raise FileNotFoundError(f"SQLite source database does not exist: {src_path}")

    dest.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(f"file:{src_path}?mode=ro", uri=True) as source:
        with sqlite3.connect(dest) as target:
            source.backup(target)


def _prune_backups(backup_dir: Path, retention_days: int) -> int:
    if retention_days <= 0:
        return 0
    cutoff = time.time() - retention_days * 86400
    deleted = 0
    for item in backup_dir.glob("judge-*.sqlite"):
        try:
            if item.stat().st_mtime < cutoff:
                item.unlink()
                deleted += 1
        except FileNotFoundError:
            continue
    return deleted


def main() -> None:
    settings = load_settings()
    backup_dir = Path(
        os.getenv("JUDGE_BACKUP_DIR", str(settings.results_db.parent / "backups"))
    )
    retention_days = _env_int("JUDGE_BACKUP_RETENTION_DAYS", 7)

    backup_path = _backup_path(backup_dir)
    _copy_db(settings.results_db, backup_path)
    deleted = _prune_backups(backup_dir, retention_days)

    print(
        f"backup: path={backup_path} retention_days={retention_days} "
        f"deleted_old={deleted}"
    )


if __name__ == "__main__":
    main()
