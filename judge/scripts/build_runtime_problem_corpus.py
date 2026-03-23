"""Build a runtime-ready problem corpus with generated hidden tests."""

from __future__ import annotations

import argparse
from pathlib import Path

from judge.runtime_problem_corpus import build_runtime_problem_corpus


def main() -> None:
    parser = argparse.ArgumentParser(description="Build runtime-ready problem corpus")
    parser.add_argument(
        "--source-root",
        default="problems",
        help="Path to authored source problems root (default: problems)",
    )
    parser.add_argument(
        "--output-root",
        default="data/runtime-problems/current",
        help="Path to generated runtime problems root (default: data/runtime-problems/current)",
    )
    args = parser.parse_args()

    source_root = Path(args.source_root).resolve()
    if not source_root.exists():
        raise SystemExit(f"source problems root not found: {source_root}")

    result = build_runtime_problem_corpus(
        source_root=source_root,
        output_root=Path(args.output_root).resolve(),
        generator_script=Path(__file__).resolve().parent / "generate_hidden_tests.py",
    )
    print(f"OK: built runtime corpus with {result.problem_count} problem(s) at {result.output_root}")


if __name__ == "__main__":
    main()
