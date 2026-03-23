"""Runtime problem corpus build helpers."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from judge.problem_contracts import ProblemCorpusKind, validate_problem_contracts

_AUTHORED_FILES = ("problem.json", "public_cases.json", "starter.py")


@dataclass(frozen=True)
class RuntimeCorpusBuildResult:
    output_root: Path
    problem_count: int


def _iter_problem_dirs(problems_root: Path) -> list[Path]:
    return sorted(path.parent for path in problems_root.rglob("problem.json"))


def _validate_paths(*, source_root: Path, output_root: Path) -> None:
    source_root = source_root.resolve()
    output_root = output_root.resolve()
    if output_root == source_root:
        raise ValueError("runtime corpus output root must differ from source root")
    if output_root.is_relative_to(source_root):
        raise ValueError("runtime corpus output root must not live inside source root")


def build_runtime_problem_corpus(
    *,
    source_root: Path,
    output_root: Path,
    generator_script: Path,
) -> RuntimeCorpusBuildResult:
    source_root = source_root.resolve()
    output_root = output_root.resolve()
    generator_script = generator_script.resolve()

    _validate_paths(source_root=source_root, output_root=output_root)

    source_issues = validate_problem_contracts(source_root, kind=ProblemCorpusKind.SOURCE)
    if source_issues:
        rendered = "\n".join(issue.render() for issue in source_issues)
        raise ValueError(f"invalid source problem corpus:\n{rendered}")

    if output_root.exists():
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    problem_dirs = _iter_problem_dirs(source_root)
    for source_problem_dir in problem_dirs:
        relative_problem_dir = source_problem_dir.relative_to(source_root)
        output_problem_dir = output_root / relative_problem_dir
        output_problem_dir.mkdir(parents=True, exist_ok=True)
        for filename in _AUTHORED_FILES:
            shutil.copy2(source_problem_dir / filename, output_problem_dir / filename)

    judge_root = generator_script.parents[1]
    env = dict(os.environ)
    env["PYTHONPATH"] = str(judge_root / "src")
    generation = subprocess.run(
        [sys.executable, str(generator_script), "--problems-root", str(output_root)],
        cwd=judge_root,
        env=env,
        capture_output=True,
        text=True,
    )
    if generation.returncode != 0:
        message = generation.stderr.strip() or generation.stdout.strip() or "hidden test generation failed"
        raise RuntimeError(message)

    runtime_issues = validate_problem_contracts(output_root, kind=ProblemCorpusKind.RUNTIME)
    if runtime_issues:
        rendered = "\n".join(issue.render() for issue in runtime_issues)
        raise RuntimeError(f"invalid runtime problem corpus:\n{rendered}")

    return RuntimeCorpusBuildResult(output_root=output_root, problem_count=len(problem_dirs))
