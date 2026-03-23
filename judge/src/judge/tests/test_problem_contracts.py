"""Problem corpus contract validator tests."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest import TestCase

from judge.problem_contracts import validate_problem_contracts


def _write_problem_fixture(
    problem_dir: Path,
    *,
    starter_source: str = "def add(a, b):\n    pass\n",
) -> None:
    problem_dir.mkdir(parents=True)
    (problem_dir / "problem.json").write_text(
        """{
  "schema_version": 1,
  "arguments": [{"name": "a"}, {"name": "b"}],
  "runner": "add(a, b)",
  "execution_profile": "light",
  "comparison": {"type": "exact"},
  "time_limit_s": 5,
  "memory_mb": 512
}"""
    )
    (problem_dir / "public_cases.json").write_text(
        """{
  "schema_version": 1,
  "cases": [
    {"id": "p1", "inputs": {"a": "1", "b": "2"}, "expected_literal": "3"}
  ]
}"""
    )
    (problem_dir / "hidden_tests.json").write_text(
        """{
  "schema_version": 1,
  "cases": [
    {"id": "h1", "input_code": "a = 1\\nb = 2\\n", "expected_literal": "3"}
  ]
}"""
    )
    (problem_dir / "starter.py").write_text(starter_source)


class ProblemContractsTests(TestCase):
    def test_validate_problem_contracts_requires_starter_py(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            problems_root = Path(tmp_dir)
            problem_dir = problems_root / "sample/01-basics/01-add"
            _write_problem_fixture(problem_dir)
            (problem_dir / "starter.py").unlink()

            issues = validate_problem_contracts(problems_root)

        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].file.name, "starter.py")
        self.assertEqual(issues[0].message, "missing starter.py")

    def test_validate_problem_contracts_rejects_empty_starter_py(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            problems_root = Path(tmp_dir)
            problem_dir = problems_root / "sample/01-basics/01-add"
            _write_problem_fixture(problem_dir, starter_source="   \n")

            issues = validate_problem_contracts(problems_root)

        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].file.name, "starter.py")
        self.assertEqual(issues[0].message, "starter.py must be non-empty")

    def test_validate_problem_contracts_rejects_invalid_python_starter_py(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            problems_root = Path(tmp_dir)
            problem_dir = problems_root / "sample/01-basics/01-add"
            _write_problem_fixture(problem_dir, starter_source="def add(\n")

            issues = validate_problem_contracts(problems_root)

        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].file.name, "starter.py")
        self.assertIn("starter.py is not valid Python", issues[0].message)
