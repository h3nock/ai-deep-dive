"""Export judge test artifacts for endpoint and/or web bundle roots."""

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


def _export_root(*, problems_root: Path, out_root: Path, include_hidden: bool) -> int:
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

        if include_hidden:
            hidden_tests = problem_dir / "hidden_tests.json"
            if hidden_tests.exists():
                shutil.copy2(hidden_tests, out_dir / "hidden_tests.json")

        exported += 1
    return exported


def main() -> None:
    parser = argparse.ArgumentParser(description="Export judge test bundles")
    parser.add_argument(
        "--out-root",
        default=None,
        help="Output root for judge endpoint artifacts (default: judge/tests)",
    )
    parser.add_argument(
        "--web-out-root",
        default=None,
        help="Optional output root for web public bundles (hidden tests are not exported)",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    problems_root = repo_root / "judge" / "problems"

    if not problems_root.exists():
        raise SystemExit("judge/problems directory not found")

    if args.out_root is None and args.web_out_root is None:
        judge_out_root = repo_root / "judge" / "tests"
        web_out_root: Path | None = None
    else:
        judge_out_root = Path(args.out_root) if args.out_root else None
        web_out_root = Path(args.web_out_root) if args.web_out_root else None

    if judge_out_root is not None:
        count = _export_root(
            problems_root=problems_root,
            out_root=judge_out_root,
            include_hidden=True,
        )
        print(f"Exported {count} problem(s) to {judge_out_root}")

    if web_out_root is not None:
        count = _export_root(
            problems_root=problems_root,
            out_root=web_out_root,
            include_hidden=False,
        )
        print(f"Exported {count} public bundle(s) to {web_out_root}")


if __name__ == "__main__":
    main()
