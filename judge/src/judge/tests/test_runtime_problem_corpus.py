"""Runtime problem corpus build tests."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest import TestCase

from judge.problem_contracts import ProblemCorpusKind, validate_problem_contracts
from judge.runtime_problem_corpus import build_runtime_problem_corpus


class RuntimeProblemCorpusTests(TestCase):
    def test_build_runtime_problem_corpus_from_repo_source(self) -> None:
        judge_root = Path(__file__).resolve().parents[3]
        source_root = judge_root / "problems"
        generator_script = judge_root / "scripts" / "generate_hidden_tests.py"

        with tempfile.TemporaryDirectory() as tmp_dir:
            output_root = Path(tmp_dir) / "runtime-problems"
            result = build_runtime_problem_corpus(
                source_root=source_root,
                output_root=output_root,
                generator_script=generator_script,
            )

            issues = validate_problem_contracts(output_root, kind=ProblemCorpusKind.RUNTIME)

        self.assertEqual(result.output_root.resolve(), output_root.resolve())
        self.assertGreater(result.problem_count, 0)
        self.assertEqual(issues, [])
