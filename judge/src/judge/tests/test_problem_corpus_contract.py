"""Problem corpus contract checks."""

from __future__ import annotations

from pathlib import Path
from unittest import TestCase

from judge.problem_contracts import validate_problem_contracts


class ProblemCorpusContractTests(TestCase):
    def test_problem_corpus_contracts_are_valid(self) -> None:
        problems_root = Path(__file__).resolve().parents[3] / "problems"
        issues = validate_problem_contracts(problems_root)
        if issues:
            rendered = "\n".join(issue.render() for issue in issues[:20])
            if len(issues) > 20:
                rendered += f"\n... and {len(issues) - 20} more"
            self.fail(f"Problem corpus contract validation failed:\n{rendered}")

