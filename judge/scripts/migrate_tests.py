"""Migrate legacy web/content tests.json to judge/problems format."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def _read_json(path: Path):
    return json.loads(path.read_text())


def _write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def _normalize_expected(value):
    if isinstance(value, str):
        try:
            return json.loads(value), False
        except json.JSONDecodeError:
            return value, True
    return value, False


def _inputs_to_code(inputs: dict[str, object]) -> str:
    lines: list[str] = []
    for name, value in inputs.items():
        if not isinstance(name, str) or not name.isidentifier():
            raise ValueError(f"invalid input variable name: {name!r}")
        rendered = value if isinstance(value, str) else repr(value)
        lines.append(f"{name} = {rendered}")
    code = "\n".join(lines)
    if code:
        code += "\n"
    return code


def migrate_challenge(challenge_dir: Path, out_root: Path, course_slug: str, chapter_slug: str) -> bool:
    tests_path = challenge_dir / "tests.json"
    if not tests_path.exists():
        return False

    slug = challenge_dir.name
    out_dir = out_root / course_slug / chapter_slug / slug

    cases = _read_json(tests_path)
    public_cases = []
    hidden_cases = []

    for case in cases:
        expected, expected_is_code = _normalize_expected(case.get("expected"))
        input_code = case.get("input_code")
        if not isinstance(input_code, str) or not input_code.strip():
            raw_inputs = case.get("inputs", {})
            if not isinstance(raw_inputs, dict):
                raise ValueError("inputs must be an object when input_code is missing")
            input_code = _inputs_to_code(raw_inputs)

        if not input_code.endswith("\n"):
            input_code += "\n"

        item = {
            "id": case.get("id", ""),
            "input_code": input_code,
            "expected": expected,
        }
        if expected_is_code:
            item["expected_is_code"] = True
        if case.get("hidden"):
            hidden_cases.append(item)
        else:
            public_cases.append(item)

    public_payload = {"version": 1, "cases": public_cases}
    hidden_payload = {"version": 1, "cases": hidden_cases}

    _write_json(out_dir / "public_tests.json", public_payload)
    _write_json(out_dir / "hidden_tests.json", hidden_payload)

    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate tests.json to judge format")
    parser.add_argument("--content-root", default="web/content", help="Path to web content root")
    parser.add_argument("--out-root", default="judge/problems", help="Output judge problems root")
    parser.add_argument("--course", default=None, help="Optional course slug filter")
    args = parser.parse_args()

    content_root = Path(args.content_root)
    out_root = Path(args.out_root)

    if not content_root.exists():
        raise SystemExit(f"Content root not found: {content_root}")

    migrated = 0
    for course_dir in content_root.iterdir():
        if not course_dir.is_dir():
            continue
        course_slug = course_dir.name
        if args.course and course_slug != args.course:
            continue

        for chapter_dir in course_dir.iterdir():
            if not chapter_dir.is_dir():
                continue
            chapter_slug = chapter_dir.name
            challenges_dir = chapter_dir / "challenges"
            if not challenges_dir.exists():
                continue

            for challenge_dir in challenges_dir.iterdir():
                if not challenge_dir.is_dir():
                    continue
                if migrate_challenge(challenge_dir, out_root, course_slug, chapter_slug):
                    migrated += 1

    print(f"Migrated {migrated} challenge(s) to {out_root}")


if __name__ == "__main__":
    main()
