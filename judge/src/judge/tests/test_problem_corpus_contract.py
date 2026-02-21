"""Problem corpus contract checks."""

from __future__ import annotations

import json
from pathlib import Path
from unittest import TestCase


class ProblemCorpusContractTests(TestCase):
    def test_inputs_schema_uses_identifier_names_and_string_literals(self) -> None:
        problems_root = Path(__file__).resolve().parents[3] / "problems"
        files = sorted(problems_root.rglob("*_tests.json"))

        for tests_file in files:
            raw = json.loads(tests_file.read_text())
            cases = raw.get("cases", raw) if isinstance(raw, dict) else raw

            for index, case in enumerate(cases):
                if not isinstance(case, dict):
                    continue
                inputs = case.get("inputs")
                if inputs is None:
                    continue
                self.assertIsInstance(
                    inputs,
                    dict,
                    msg=f"{tests_file}: case[{index}] inputs must be an object",
                )
                assert isinstance(inputs, dict)

                for name, value in inputs.items():
                    self.assertIsInstance(
                        name,
                        str,
                        msg=f"{tests_file}: case[{index}] input name must be string",
                    )
                    if isinstance(name, str):
                        self.assertTrue(
                            name.isidentifier(),
                            msg=f"{tests_file}: case[{index}] input name must be identifier: {name!r}",
                        )
                    self.assertIsInstance(
                        value,
                        str,
                        msg=f"{tests_file}: case[{index}] input value for {name!r} must be string Python literal",
                    )
