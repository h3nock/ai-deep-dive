"""Problem manifests and tests loader."""

import ast
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


@dataclass(frozen=True)
class Comparison:
    type: str = "exact"
    rtol: float = 1e-5
    atol: float = 1e-8


@dataclass(frozen=True)
class TestCase:
    id: str
    input_code: str
    expected: Any
    hidden: bool = False
    comparison: Optional[Comparison] = None


@dataclass(frozen=True)
class Problem:
    id: str
    version: str
    runner: str
    requires_torch: bool
    time_limit_s: int
    memory_mb: int
    comparison: Comparison
    public_tests: list[TestCase]
    hidden_tests: list[TestCase]


def _safe_problem_path(root: Path, problem_id: str) -> Path:
    if problem_id.startswith("/") or ".." in problem_id.split("/"):
        raise ValueError("Invalid problem id")
    return root / problem_id


def _parse_expected(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _case_from_raw(raw: dict[str, Any], hidden_override: bool | None = None) -> TestCase:
    input_code = raw.get("input_code")
    if input_code is None and "inputs" in raw:
        input_code = ""
        for name, value in raw["inputs"].items():
            input_code += f"{name} = {value}\n"
    if input_code is None:
        input_code = ""

    comparison = None
    if "comparison" in raw:
        cmp_raw = raw["comparison"] or {}
        comparison = Comparison(
            type=cmp_raw.get("type", "exact"),
            rtol=float(cmp_raw.get("rtol", 1e-5)),
            atol=float(cmp_raw.get("atol", 1e-8)),
        )

    expected_raw = raw.get("expected")
    expected_is_code = bool(raw.get("expected_is_code", False))
    if expected_is_code and isinstance(expected_raw, str):
        try:
            expected_value = ast.literal_eval(expected_raw)
        except (ValueError, SyntaxError):
            expected_value = expected_raw
    else:
        expected_value = _parse_expected(expected_raw)

    hidden = bool(raw.get("hidden", False))
    if hidden_override is not None:
        hidden = hidden_override

    return TestCase(
        id=str(raw.get("id", "")),
        input_code=input_code,
        expected=expected_value,
        hidden=hidden,
        comparison=comparison,
    )


def _load_tests(path: Path, is_hidden_tests: bool) -> list[TestCase]:
    if not path.exists():
        return []
    raw = json.loads(path.read_text())
    cases = raw.get("cases", raw) if isinstance(raw, dict) else raw
    parsed: list[TestCase] = []
    for item in cases:
        parsed.append(_case_from_raw(item, hidden_override=is_hidden_tests))
    return parsed


def load_problem(problem_id: str, root: Path) -> Problem:
    problem_dir = _safe_problem_path(root, problem_id)
    manifest_path = problem_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"manifest.json not found for {problem_id}")

    manifest = json.loads(manifest_path.read_text())
    comparison_raw = manifest.get("comparison", {})
    comparison = Comparison(
        type=comparison_raw.get("type", "exact"),
        rtol=float(comparison_raw.get("rtol", 1e-5)),
        atol=float(comparison_raw.get("atol", 1e-8)),
    )

    public_tests = _load_tests(problem_dir / "public_tests.json", is_hidden_tests=False)
    hidden_tests = _load_tests(problem_dir / "hidden_tests.json", is_hidden_tests=True)

    return Problem(
        id=manifest.get("id", problem_id),
        version=str(manifest.get("version", "v1")),
        runner=manifest.get("runner", ""),
        requires_torch=bool(manifest.get("requires_torch", False)),
        time_limit_s=int(manifest.get("time_limit_s", 10)),
        memory_mb=int(manifest.get("memory_mb", 1024)),
        comparison=comparison,
        public_tests=public_tests,
        hidden_tests=hidden_tests,
    )
