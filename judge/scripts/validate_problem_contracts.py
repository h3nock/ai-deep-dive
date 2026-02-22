"""Validate judge problem corpus contracts."""

from __future__ import annotations

import argparse
from pathlib import Path

from judge.problem_contracts import validate_problem_contracts


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate judge problem contracts")
    parser.add_argument(
        "--problems-root",
        default="problems",
        help="Path to judge problems root (default: problems)",
    )
    args = parser.parse_args()

    problems_root = Path(args.problems_root).resolve()
    if not problems_root.exists():
        raise SystemExit(f"problems root not found: {problems_root}")

    issues = validate_problem_contracts(problems_root)
    if issues:
        for issue in issues:
            print(f"ERROR: {issue.render()}")
        raise SystemExit(f"{len(issues)} contract issue(s) found")

    print("OK: problem contracts are valid")


if __name__ == "__main__":
    main()
