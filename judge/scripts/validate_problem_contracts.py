"""Validate judge problem corpus contracts."""

from __future__ import annotations

import argparse
from pathlib import Path

from judge.problem_contracts import ProblemCorpusKind, validate_problem_contracts


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate judge problem contracts")
    parser.add_argument(
        "--problems-root",
        default="problems",
        help="Path to judge problems root (default: problems)",
    )
    parser.add_argument(
        "--kind",
        choices=[kind.value for kind in ProblemCorpusKind],
        default=ProblemCorpusKind.SOURCE.value,
        help="Which corpus contract to validate (default: source)",
    )
    args = parser.parse_args()

    problems_root = Path(args.problems_root).resolve()
    if not problems_root.exists():
        raise SystemExit(f"problems root not found: {problems_root}")

    issues = validate_problem_contracts(problems_root, kind=ProblemCorpusKind(args.kind))
    if issues:
        for issue in issues:
            print(f"ERROR: {issue.render()}")
        raise SystemExit(f"{len(issues)} contract issue(s) found")

    print(f"OK: {args.kind} problem contracts are valid")


if __name__ == "__main__":
    main()
