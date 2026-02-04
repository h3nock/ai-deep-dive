"""Export public bundles + hidden tests for the judge tests endpoint."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def read_json(path: Path) -> dict:
    return json.loads(path.read_text())


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))


def main() -> None:
    parser = argparse.ArgumentParser(description="Export judge tests endpoint")
    parser.add_argument(
        "--out-root",
        default=None,
        help="Output root for /judge-tests (default: judge/tests)",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    problems_root = repo_root / "judge" / "problems"
    out_root = Path(args.out_root) if args.out_root else (repo_root / "judge" / "tests")

    if not problems_root.exists():
        raise SystemExit("judge/problems directory not found")

    if out_root.exists():
        shutil.rmtree(out_root)
    out_root.mkdir(parents=True, exist_ok=True)

    exported = 0

    for manifest_path in problems_root.rglob("manifest.json"):
        problem_dir = manifest_path.parent
        public_tests = problem_dir / "public_tests.json"
        if not public_tests.exists():
            continue

        rel = problem_dir.relative_to(problems_root)
        out_dir = out_root / rel
        out_dir.mkdir(parents=True, exist_ok=True)

        manifest = read_json(manifest_path)
        tests = read_json(public_tests)
        version = str(manifest.get("version", "v1"))
        bundle_name = f"public_bundle.{version}.json"

        bundle = {
            "version": version,
            "runner": manifest.get("runner", ""),
            "comparison": manifest.get("comparison", {"type": "exact"}),
            "tests": tests,
        }
        write_json(out_dir / bundle_name, bundle)

        public_manifest = {
            "problem_id": manifest.get("id", str(rel)),
            "version": version,
            "bundle": bundle_name,
            "runner": manifest.get("runner", ""),
            "comparison": manifest.get("comparison", {"type": "exact"}),
        }
        write_json(out_dir / "public_manifest.json", public_manifest)

        hidden_tests = problem_dir / "hidden_tests.json"
        if hidden_tests.exists():
            shutil.copy2(hidden_tests, out_dir / "hidden_tests.json")

        exported += 1

    print(f"Exported {exported} problem(s) to {out_root}")


if __name__ == "__main__":
    main()
