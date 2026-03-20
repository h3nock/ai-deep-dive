"""Migration helpers for converting legacy judge problems to canonical files."""

from __future__ import annotations

import ast
import json
from pathlib import Path
from typing import Any

from judge.problems import (
    ProblemSpec,
    inline_assignment_aliases,
    load_hidden_cases_file,
    load_problem_spec_file,
    load_public_cases_file,
    runner_input_names,
)

_LEGACY_MANIFEST_NAME = "manifest.json"
_LEGACY_PUBLIC_NAME = "public_tests.json"
_LEGACY_HIDDEN_NAME = "hidden_tests.json"


def _load_json_dict(path: Path) -> dict[str, Any]:
    raw = json.loads(path.read_text())
    if not isinstance(raw, dict):
        raise ValueError(f"{path.name} must contain a JSON object")
    return raw


def _iter_legacy_cases(path: Path) -> list[dict[str, Any]]:
    raw = _load_json_dict(path)
    cases = raw.get("cases")
    if not isinstance(cases, list):
        raise ValueError(f"{path.name}.cases must be a list")
    loaded_cases: list[dict[str, Any]] = []
    for index, case in enumerate(cases):
        if not isinstance(case, dict):
            raise ValueError(f"{path.name}.cases[{index}] must be an object")
        loaded_cases.append(case)
    return loaded_cases


def _normalize_expected_literal(*, value: Any, expected_is_code: bool, context: str) -> str:
    if expected_is_code:
        if isinstance(value, str):
            try:
                ast.literal_eval(value)
            except (ValueError, SyntaxError) as exc:
                raise ValueError(f"{context} expected literal is invalid: {exc}") from exc
            return value
        rendered = repr(value)
        ast.literal_eval(rendered)
        return rendered

    rendered = repr(value)
    ast.literal_eval(rendered)
    return rendered


def _execution_profile_from_manifest(manifest: dict[str, Any], *, context: str) -> str:
    requires_torch = manifest.get("requires_torch")
    if not isinstance(requires_torch, bool):
        raise ValueError(f"{context}.requires_torch must be a boolean")
    return "torch" if requires_torch else "light"


def _comparison_from_manifest(manifest: dict[str, Any], *, context: str) -> dict[str, Any]:
    comparison = manifest.get("comparison")
    if not isinstance(comparison, dict):
        raise ValueError(f"{context}.comparison must be an object")
    return comparison


def _migrate_problem_spec(problem_id: str, manifest_path: Path) -> dict[str, Any]:
    manifest = _load_json_dict(manifest_path)
    context = manifest_path.name
    runner = manifest.get("runner")
    if not isinstance(runner, str) or not runner.strip():
        raise ValueError(f"{context}.runner must be a non-empty string")

    arguments = [{"name": name} for name in runner_input_names(runner)]
    time_limit_s = manifest.get("time_limit_s")
    memory_mb = manifest.get("memory_mb")
    if not isinstance(time_limit_s, int) or isinstance(time_limit_s, bool) or time_limit_s <= 0:
        raise ValueError(f"{context}.time_limit_s must be a positive integer")
    if not isinstance(memory_mb, int) or isinstance(memory_mb, bool) or memory_mb <= 0:
        raise ValueError(f"{context}.memory_mb must be a positive integer")

    return {
        "schema_version": 1,
        "arguments": arguments,
        "runner": runner,
        "execution_profile": _execution_profile_from_manifest(manifest, context=context),
        "comparison": _comparison_from_manifest(manifest, context=context),
        "time_limit_s": time_limit_s,
        "memory_mb": memory_mb,
    }


def _migrate_public_cases(public_path: Path, spec: ProblemSpec) -> dict[str, Any]:
    argument_names = [argument.name for argument in spec.arguments]
    allowed_roots = {"torch"} if spec.execution_profile == "torch" else set()
    migrated_cases: list[dict[str, Any]] = []
    for index, case in enumerate(_iter_legacy_cases(public_path)):
        case_context = f"{public_path.name}.cases[{index}]"
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id.strip():
            raise ValueError(f"{case_context}.id must be a non-empty string")
        input_code = case.get("input_code")
        if not isinstance(input_code, str) or not input_code.strip():
            raise ValueError(f"{case_context}.input_code must be a non-empty string")
        migrated_cases.append(
            {
                "id": case_id.strip(),
                "inputs": inline_assignment_aliases(
                    input_code=input_code,
                    argument_names=argument_names,
                    allowed_root_names=allowed_roots,
                ),
                "expected_literal": _normalize_expected_literal(
                    value=case.get("expected"),
                    expected_is_code=bool(case.get("expected_is_code", False)),
                    context=f"{case_context}.expected",
                ),
            }
        )

    return {
        "schema_version": 1,
        "cases": migrated_cases,
    }


def _migrate_hidden_cases(hidden_path: Path) -> dict[str, Any]:
    migrated_cases: list[dict[str, Any]] = []
    for index, case in enumerate(_iter_legacy_cases(hidden_path)):
        case_context = f"{hidden_path.name}.cases[{index}]"
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id.strip():
            raise ValueError(f"{case_context}.id must be a non-empty string")
        input_code = case.get("input_code")
        if not isinstance(input_code, str) or not input_code.strip():
            raise ValueError(f"{case_context}.input_code must be a non-empty string")
        if not input_code.endswith("\n"):
            input_code += "\n"

        migrated_cases.append(
            {
                "id": case_id.strip(),
                "input_code": input_code,
                "expected_literal": _normalize_expected_literal(
                    value=case.get("expected"),
                    expected_is_code=bool(case.get("expected_is_code", False)),
                    context=f"{case_context}.expected",
                ),
            }
        )

    return {
        "schema_version": 1,
        "cases": migrated_cases,
    }


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n")


def migrate_problem_dir(problem_dir: Path, *, problems_root: Path) -> None:
    manifest_path = problem_dir / _LEGACY_MANIFEST_NAME
    public_path = problem_dir / _LEGACY_PUBLIC_NAME
    hidden_path = problem_dir / _LEGACY_HIDDEN_NAME
    for required in (manifest_path, public_path, hidden_path):
        if not required.exists():
            raise FileNotFoundError(f"missing legacy problem file: {required}")

    problem_id = problem_dir.relative_to(problems_root).as_posix()
    problem_payload = _migrate_problem_spec(problem_id, manifest_path)

    problem_json_path = problem_dir / "problem.json"
    _write_json(problem_json_path, problem_payload)
    spec = load_problem_spec_file(problem_id, problem_json_path)

    public_payload = _migrate_public_cases(public_path, spec)
    public_json_path = problem_dir / "public_cases.json"
    _write_json(public_json_path, public_payload)

    hidden_payload = _migrate_hidden_cases(hidden_path)
    hidden_json_path = problem_dir / "hidden_tests.json"
    _write_json(hidden_json_path, hidden_payload)

    load_public_cases_file(public_json_path, spec)
    load_hidden_cases_file(hidden_json_path, spec)


def migrate_problem_corpus(problems_root: Path) -> list[Path]:
    migrated: list[Path] = []
    for manifest_path in sorted(problems_root.rglob(_LEGACY_MANIFEST_NAME)):
        problem_dir = manifest_path.parent
        migrate_problem_dir(problem_dir, problems_root=problems_root)
        migrated.append(problem_dir)
    return migrated
