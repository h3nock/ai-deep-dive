"""Generate manifest.json files from web/content frontmatter."""

from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path


def _read_frontmatter(path: Path) -> list[str]:
    text = path.read_text()
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return []
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return lines[1:i]
    return []


def _parse_block_value(lines: list[str], start_idx: int) -> tuple[str, int]:
    """Parse a YAML block (|) value starting at start_idx line."""
    indent = None
    out = []
    i = start_idx + 1
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            out.append("")
            i += 1
            continue
        leading = len(line) - len(line.lstrip(" "))
        if indent is None:
            indent = leading
        if leading < (indent or 0):
            break
        out.append(line[indent:])
        i += 1
    return "\n".join(out).rstrip(), i


def _parse_frontmatter(lines: list[str]) -> dict[str, object]:
    data: dict[str, object] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if ":" not in line:
            i += 1
            continue
        key, rest = line.split(":", 1)
        key = key.strip()
        rest = rest.strip()
        if rest == "|":
            value, new_i = _parse_block_value(lines, i)
            data[key] = value
            i = new_i
            continue
        if rest == "":
            # Possibly a list
            items = []
            j = i + 1
            while j < len(lines):
                sub = lines[j]
                if not sub.strip():
                    j += 1
                    continue
                if not sub.lstrip().startswith("-"):
                    break
                item = sub.split("-", 1)[1].strip()
                items.append(item)
                j += 1
            if items:
                data[key] = items
                i = j
                continue
        data[key] = rest.strip("\"'")
        i += 1
    return data


def _normalize_runner(value: str) -> str:
    runner = value.strip()
    if runner.startswith("print(") and runner.endswith(")"):
        runner = runner[6:-1].strip()
    return runner


def _requires_torch(deps: list[str]) -> bool:
    for dep in deps:
        if "torch" in dep.lower():
            return True
    return False


def _has_float(value: object) -> bool:
    if isinstance(value, float):
        return True
    if isinstance(value, (list, tuple, set)):
        return any(_has_float(item) for item in value)
    if isinstance(value, dict):
        return any(_has_float(k) or _has_float(v) for k, v in value.items())
    return False


def _parse_expected_for_detection(raw: object, is_code: bool) -> object:
    if is_code and isinstance(raw, str):
        try:
            return ast.literal_eval(raw)
        except (ValueError, SyntaxError):
            return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw
    return raw


def _detect_comparison(problem_dir: Path) -> dict[str, object]:
    tests_paths = [problem_dir / "public_tests.json", problem_dir / "hidden_tests.json"]
    for tests_path in tests_paths:
        if not tests_path.exists():
            continue
        raw = json.loads(tests_path.read_text())
        cases = raw.get("cases", raw) if isinstance(raw, dict) else raw
        for case in cases:
            expected = _parse_expected_for_detection(
                case.get("expected"),
                bool(case.get("expected_is_code", False)),
            )
            if _has_float(expected):
                return {"type": "allclose", "rtol": 1e-5, "atol": 1e-6}
    return {"type": "exact"}


COMPARISON_BY_PROBLEM: dict[str, dict[str, object]] = {
    "build-gpt/01-from-text-to-bytes/01-encoder": {"type": "exact"},
    "build-gpt/01-from-text-to-bytes/02-byte-inspector": {"type": "exact"},
    "build-gpt/02-tokenization/01-pair-counter": {"type": "exact"},
    "build-gpt/02-tokenization/02-token-merger": {"type": "exact"},
    "build-gpt/02-tokenization/03-bpe-trainer": {"type": "exact"},
    "build-gpt/02-tokenization/04-decoder": {"type": "exact"},
    "build-gpt/02-tokenization/05-encoder": {"type": "exact"},
    "build-gpt/03-embeddings/01-most-similar": {"type": "exact"},
    "build-gpt/03-embeddings/02-vector-analogy": {"type": "exact"},
    "build-gpt/04-positional-encoding/01-frequency-schedule": {
        "type": "allclose",
        "rtol": 1e-5,
        "atol": 1e-6,
    },
    "build-gpt/04-positional-encoding/02-positional-encoding-vector": {
        "type": "allclose",
        "rtol": 1e-5,
        "atol": 5e-5,
    },
    "build-gpt/04-positional-encoding/03-pe-matrix": {
        "type": "allclose",
        "rtol": 1e-5,
        "atol": 1e-6,
    },
    "build-gpt/05-attention-mechanism/01-attention-weights": {
        "type": "allclose",
        "rtol": 1e-5,
        "atol": 1e-6,
    },
    "build-gpt/05-attention-mechanism/02-causal-attention": {
        "type": "allclose",
        "rtol": 1e-5,
        "atol": 1e-6,
    },
    "build-gpt/06-multi-head-attention/01-multi-head-causal-attention": {
        "type": "allclose",
        "rtol": 1e-5,
        "atol": 1e-6,
    },
}


def _comparison_for_problem(problem_id: str, problem_dir: Path) -> dict[str, object]:
    explicit = COMPARISON_BY_PROBLEM.get(problem_id)
    if explicit is not None:
        return dict(explicit)
    return _detect_comparison(problem_dir)


def generate_manifest(
    problem_id: str, frontmatter: dict[str, object], comparison: dict[str, object]
) -> dict[str, object]:
    runner_raw = str(frontmatter.get("executionSnippet", "")).strip()
    if not runner_raw:
        runner_raw = ""
    runner = _normalize_runner(runner_raw)
    deps = frontmatter.get("dependencies", [])
    if not isinstance(deps, list):
        deps = []

    return {
        "id": problem_id,
        "version": "v1",
        "runner": runner,
        "requires_torch": _requires_torch([str(d) for d in deps]),
        "time_limit_s": 5,
        "memory_mb": 1024,
        "comparison": comparison,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate judge manifests")
    parser.add_argument("--content-root", default="web/content")
    parser.add_argument("--problems-root", default="judge/problems")
    parser.add_argument("--course", default=None)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    content_root = Path(args.content_root)
    problems_root = Path(args.problems_root)

    generated = 0
    for course_dir in content_root.iterdir():
        if not course_dir.is_dir():
            continue
        course_slug = course_dir.name
        if args.course and course_slug != args.course:
            continue

        for desc in course_dir.rglob("description.md"):
            rel = desc.relative_to(course_dir)
            parts = rel.parts
            if len(parts) < 4:
                continue
            chapter_slug = parts[0]
            challenge_slug = parts[2]
            problem_id = f"{course_slug}/{chapter_slug}/{challenge_slug}"

            problem_dir = problems_root / problem_id
            if not problem_dir.exists():
                continue

            manifest_path = problem_dir / "manifest.json"
            if manifest_path.exists() and not args.force:
                continue

            fm_lines = _read_frontmatter(desc)
            if not fm_lines:
                continue
            frontmatter = _parse_frontmatter(fm_lines)
            comparison = _comparison_for_problem(problem_id, problem_dir)
            manifest = generate_manifest(problem_id, frontmatter, comparison)

            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
            generated += 1

    print(f"Generated {generated} manifest(s)")


if __name__ == "__main__":
    main()
