"""Export public tests to the web app for Pyodide execution."""

import json
import shutil
from pathlib import Path


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    problems_root = repo_root / "judge" / "problems"
    web_root = repo_root / "web" / "public" / "judge-tests"

    if not problems_root.exists():
        raise SystemExit("problems/ directory not found")

    if web_root.exists():
        shutil.rmtree(web_root)
    web_root.mkdir(parents=True, exist_ok=True)

    for manifest_path in problems_root.rglob("manifest.json"):
        problem_dir = manifest_path.parent
        public_tests = problem_dir / "public_tests.json"
        if not public_tests.exists():
            continue

        rel = problem_dir.relative_to(problems_root)
        out_dir = web_root / rel
        out_dir.mkdir(parents=True, exist_ok=True)

        manifest = json.loads(manifest_path.read_text())
        tests = json.loads(public_tests.read_text())
        version = str(manifest.get("version", "v1"))
        bundle_name = f"public_bundle.{version}.json"
        bundle = {
            "version": version,
            "runner": manifest.get("runner", ""),
            "comparison": manifest.get("comparison", {"type": "exact"}),
            "tests": tests,
        }

        (out_dir / bundle_name).write_text(json.dumps(bundle))
        public_manifest = {
            "problem_id": manifest.get("id", str(rel)),
            "version": version,
            "bundle": bundle_name,
            "runner": manifest.get("runner", ""),
            "comparison": manifest.get("comparison", {"type": "exact"}),
        }
        (out_dir / "public_manifest.json").write_text(json.dumps(public_manifest))

    print(f"Exported public tests to {web_root}")


if __name__ == "__main__":
    main()
