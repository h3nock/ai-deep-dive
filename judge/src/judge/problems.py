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


@dataclass(frozen=True)
class ProblemRouteInfo:
    id: str
    version: str
    requires_torch: bool
    time_limit_s: int
    memory_mb: int


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


def _comparison_from_raw(raw: dict[str, Any] | None) -> Comparison:
    comparison_raw = raw if isinstance(raw, dict) else {}
    return Comparison(
        type=comparison_raw.get("type", "exact"),
        rtol=float(comparison_raw.get("rtol", 1e-5)),
        atol=float(comparison_raw.get("atol", 1e-8)),
    )


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


def _file_signature(path: Path) -> tuple[int, int]:
    stat = path.stat()
    return (stat.st_mtime_ns, stat.st_size)


class ProblemRepository:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self._manifest_cache: dict[str, tuple[tuple[int, int], dict[str, Any]]] = {}
        self._tests_cache: dict[tuple[str, bool], tuple[tuple[int, int], tuple[TestCase, ...]]] = {}

    def get_route_info(self, problem_id: str) -> ProblemRouteInfo:
        manifest = self._load_manifest(problem_id)
        return ProblemRouteInfo(
            id=str(manifest.get("id", problem_id)),
            version=str(manifest.get("version", "v1")),
            requires_torch=bool(manifest.get("requires_torch", False)),
            time_limit_s=int(manifest.get("time_limit_s", 10)),
            memory_mb=int(manifest.get("memory_mb", 1024)),
        )

    def get_for_run(self, problem_id: str) -> Problem:
        return self._build_problem(problem_id, include_hidden=False)

    def get_for_submit(self, problem_id: str) -> Problem:
        return self._build_problem(problem_id, include_hidden=True)

    def _problem_dir(self, problem_id: str) -> Path:
        return _safe_problem_path(self.root, problem_id)

    def _load_manifest(self, problem_id: str) -> dict[str, Any]:
        manifest_path = self._problem_dir(problem_id) / "manifest.json"
        if not manifest_path.exists():
            raise FileNotFoundError(f"manifest.json not found for {problem_id}")

        sig = _file_signature(manifest_path)
        cached = self._manifest_cache.get(problem_id)
        if cached and cached[0] == sig:
            return cached[1]

        manifest = json.loads(manifest_path.read_text())
        self._manifest_cache[problem_id] = (sig, manifest)
        return manifest

    def _load_tests(self, problem_id: str, is_hidden_tests: bool) -> list[TestCase]:
        cache_key = (problem_id, is_hidden_tests)
        test_file = "hidden_tests.json" if is_hidden_tests else "public_tests.json"
        tests_path = self._problem_dir(problem_id) / test_file

        if not tests_path.exists():
            self._tests_cache.pop(cache_key, None)
            return []

        sig = _file_signature(tests_path)
        cached = self._tests_cache.get(cache_key)
        if cached and cached[0] == sig:
            return list(cached[1])

        raw = json.loads(tests_path.read_text())
        cases = raw.get("cases", raw) if isinstance(raw, dict) else raw
        parsed: list[TestCase] = []
        for item in cases:
            parsed.append(_case_from_raw(item, hidden_override=is_hidden_tests))

        frozen = tuple(parsed)
        self._tests_cache[cache_key] = (sig, frozen)
        return list(frozen)

    def _build_problem(self, problem_id: str, include_hidden: bool) -> Problem:
        manifest = self._load_manifest(problem_id)
        comparison = _comparison_from_raw(manifest.get("comparison"))
        public_tests = self._load_tests(problem_id, is_hidden_tests=False)
        hidden_tests = self._load_tests(problem_id, is_hidden_tests=True) if include_hidden else []

        return Problem(
            id=str(manifest.get("id", problem_id)),
            version=str(manifest.get("version", "v1")),
            runner=manifest.get("runner", ""),
            requires_torch=bool(manifest.get("requires_torch", False)),
            time_limit_s=int(manifest.get("time_limit_s", 10)),
            memory_mb=int(manifest.get("memory_mb", 1024)),
            comparison=comparison,
            public_tests=public_tests,
            hidden_tests=hidden_tests,
        )


_LEGACY_REPOS: dict[Path, ProblemRepository] = {}


def load_problem(problem_id: str, root: Path) -> Problem:
    """Backward-compatible helper for existing imports."""
    root_path = Path(root)
    repo = _LEGACY_REPOS.get(root_path)
    if repo is None:
        repo = ProblemRepository(root_path)
        _LEGACY_REPOS[root_path] = repo
    return repo.get_for_submit(problem_id)
