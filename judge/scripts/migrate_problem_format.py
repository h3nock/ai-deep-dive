"""Migrate legacy judge problems to canonical problem/public/hidden files."""

from __future__ import annotations

import argparse
from pathlib import Path

from judge.problem_migration import migrate_problem_corpus


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate legacy judge problem files")
    parser.add_argument(
        "--problems-root",
        default="problems",
        help="Path to judge problems root (default: problems)",
    )
    args = parser.parse_args()

    problems_root = Path(args.problems_root).resolve()
    if not problems_root.exists():
        raise SystemExit(f"problems root not found: {problems_root}")

    migrated = migrate_problem_corpus(problems_root)
    print(f"Migrated {len(migrated)} problem(s)")


if __name__ == "__main__":
    main()
