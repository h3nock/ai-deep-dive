"""Problem corpus contract validation."""

from __future__ import annotations

import ast
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ContractIssue:
    file: Path
    message: str
    case_id: str | None = None

    def render(self) -> str:
        if self.case_id:
            return f"{self.file}: case={self.case_id}: {self.message}"
        return f"{self.file}: {self.message}"


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def _iter_problem_dirs(problems_root: Path) -> list[Path]:
    return sorted(path.parent for path in problems_root.rglob("manifest.json"))


def _runner_input_names(runner: str) -> set[str]:
    expr = ast.parse(runner, mode="eval").body
    if isinstance(expr, ast.Call):
        names: set[str] = set()
        for arg in expr.args:
            names |= {node.id for node in ast.walk(arg) if isinstance(node, ast.Name)}
        for kw in expr.keywords:
            names |= {node.id for node in ast.walk(kw.value) if isinstance(node, ast.Name)}
        return names
    return {node.id for node in ast.walk(expr) if isinstance(node, ast.Name)}


def _extract_target_names(target: ast.expr) -> set[str]:
    if isinstance(target, ast.Name):
        return {target.id}
    if isinstance(target, (ast.Tuple, ast.List)):
        names: set[str] = set()
        for item in target.elts:
            names |= _extract_target_names(item)
        return names
    return set()


def _case_input_names(input_code: str) -> set[str]:
    tree = ast.parse(input_code, mode="exec")
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                names |= _extract_target_names(target)
        elif isinstance(node, ast.AnnAssign):
            names |= _extract_target_names(node.target)
    return names



def _iter_cases(tests_raw: Any) -> list[dict[str, Any]]:
    if isinstance(tests_raw, dict):
        maybe_cases = tests_raw.get("cases", [])
    else:
        maybe_cases = tests_raw
    if not isinstance(maybe_cases, list):
        return []
    return [case for case in maybe_cases if isinstance(case, dict)]


def validate_problem_contracts(problems_root: Path) -> list[ContractIssue]:
    issues: list[ContractIssue] = []
    for problem_dir in _iter_problem_dirs(problems_root):
        manifest_path = problem_dir / "manifest.json"
        public_path = problem_dir / "public_tests.json"
        hidden_path = problem_dir / "hidden_tests.json"

        if not public_path.exists():
            issues.append(ContractIssue(public_path, "missing public_tests.json"))
            continue
        if not hidden_path.exists():
            issues.append(ContractIssue(hidden_path, "missing hidden_tests.json"))
            continue

        manifest = _load_json(manifest_path)
        runner = manifest.get("runner", "")

        if not isinstance(runner, str) or not runner.strip():
            issues.append(ContractIssue(manifest_path, "runner must be a non-empty string"))
            continue

        try:
            runner_inputs = _runner_input_names(runner)
        except SyntaxError as exc:
            issues.append(ContractIssue(manifest_path, f"invalid runner expression: {exc.msg}"))
            continue

        for tests_path in (public_path, hidden_path):
            tests_raw = _load_json(tests_path)
            for index, case in enumerate(_iter_cases(tests_raw)):
                case_id_raw = case.get("id")
                case_id = (
                    str(case_id_raw)
                    if isinstance(case_id_raw, str) and case_id_raw
                    else f"index-{index}"
                )

                if "inputs" in case:
                    issues.append(
                        ContractIssue(
                            tests_path,
                            "inputs format is not allowed; use input_code",
                            case_id=case_id,
                        )
                    )
                    continue

                input_code = case.get("input_code")
                if not isinstance(input_code, str) or not input_code.strip():
                    issues.append(
                        ContractIssue(
                            tests_path,
                            "input_code must be a non-empty string",
                            case_id=case_id,
                        )
                    )
                    continue

                try:
                    case_inputs = _case_input_names(input_code)
                except SyntaxError as exc:
                    issues.append(
                        ContractIssue(
                            tests_path,
                            f"invalid input_code syntax: {exc.msg}",
                            case_id=case_id,
                        )
                    )
                    continue

                missing_runner_inputs = sorted(name for name in runner_inputs if name not in case_inputs)
                if missing_runner_inputs:
                    issues.append(
                        ContractIssue(
                            tests_path,
                            f"runner inputs missing from input_code: {', '.join(missing_runner_inputs)}",
                            case_id=case_id,
                        )
                    )

    return issues

