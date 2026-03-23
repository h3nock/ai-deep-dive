"""Problem corpus contract validation."""

from __future__ import annotations

import ast
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from judge.problems import load_hidden_cases_file, load_problem_spec_file, load_public_cases_file


@dataclass(frozen=True)
class ContractIssue:
    file: Path
    message: str
    case_id: str | None = None

    def render(self) -> str:
        if self.case_id:
            return f"{self.file}: case={self.case_id}: {self.message}"
        return f"{self.file}: {self.message}"


class ProblemCorpusKind(Enum):
    SOURCE = "source"
    RUNTIME = "runtime"


def _iter_problem_dirs(problems_root: Path) -> list[Path]:
    discovered: set[Path] = set()
    for marker in problems_root.rglob("problem.json"):
        discovered.add(marker.parent)
    return sorted(discovered)


def validate_problem_contracts(problems_root: Path, *, kind: ProblemCorpusKind) -> list[ContractIssue]:
    issues: list[ContractIssue] = []
    for problem_dir in _iter_problem_dirs(problems_root):
        relative_problem_id = problem_dir.relative_to(problems_root).as_posix()
        problem_path = problem_dir / "problem.json"
        public_path = problem_dir / "public_cases.json"
        hidden_path = problem_dir / "hidden_tests.json"
        starter_path = problem_dir / "starter.py"

        required_paths = [problem_path, public_path, starter_path]
        if kind is ProblemCorpusKind.RUNTIME:
            required_paths.append(hidden_path)
        missing = [path for path in required_paths if not path.exists()]
        for path in missing:
            issues.append(ContractIssue(path, f"missing {path.name}"))
        if missing:
            continue

        if kind is ProblemCorpusKind.SOURCE and hidden_path.exists():
            issues.append(
                ContractIssue(
                    hidden_path,
                    "source corpus must not include hidden_tests.json; generate hidden tests into the runtime corpus",
                )
            )
            continue

        try:
            starter_source = starter_path.read_text()
        except OSError as exc:
            issues.append(ContractIssue(starter_path, f"failed to read starter.py: {exc}"))
            continue
        if not starter_source.strip():
            issues.append(ContractIssue(starter_path, "starter.py must be non-empty"))
            continue
        try:
            ast.parse(starter_source, filename=str(starter_path))
        except SyntaxError as exc:
            issues.append(ContractIssue(starter_path, f"starter.py is not valid Python: {exc.msg}"))
            continue

        try:
            spec = load_problem_spec_file(relative_problem_id, problem_path)
        except Exception as exc:
            issues.append(ContractIssue(problem_path, str(exc)))
            continue

        try:
            load_public_cases_file(public_path, spec)
        except Exception as exc:
            issues.append(ContractIssue(public_path, str(exc)))

        if kind is ProblemCorpusKind.RUNTIME:
            try:
                load_hidden_cases_file(hidden_path, spec)
            except Exception as exc:
                issues.append(ContractIssue(hidden_path, str(exc)))

    return issues
