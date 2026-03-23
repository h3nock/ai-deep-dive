"""Hidden test generation contract checks."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from unittest import TestCase

from judge.problems import Comparison, CompiledTestCase


def _load_generate_hidden_tests_module():
    module_path = Path(__file__).resolve().parents[3] / "scripts" / "generate_hidden_tests.py"
    spec = importlib.util.spec_from_file_location("generate_hidden_tests", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load generate_hidden_tests.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault(spec.name, module)
    spec.loader.exec_module(module)
    return module


class HiddenTestsEquivalenceTests(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.generator_module = _load_generate_hidden_tests_module()

    def test_allclose_problem_accepts_expected_literal_float_drift(self) -> None:
        existing_hidden = {
            "schema_version": 1,
            "cases": [
                {
                    "id": "h1",
                    "input_code": "x = 1\n",
                    "expected_literal": "[0.28048956, 1.34552562]",
                }
            ],
        }
        generated_hidden = {
            "schema_version": 1,
            "cases": [
                {
                    "id": "h1",
                    "input_code": "x = 1\n",
                    "expected_literal": "[0.28048953, 1.34552574]",
                }
            ],
        }

        equivalent = self.generator_module._hidden_tests_equivalent(
            existing_hidden,
            generated_hidden,
            comparison=Comparison(type="allclose", rtol=1e-5, atol=1e-6),
        )

        self.assertTrue(equivalent)

    def test_allclose_problem_uses_generator_tolerance_floor_near_zero(self) -> None:
        existing_hidden = {
            "schema_version": 1,
            "cases": [
                {
                    "id": "h1",
                    "input_code": "x = 1\n",
                    "expected_literal": "[-0.04543564]",
                }
            ],
        }
        generated_hidden = {
            "schema_version": 1,
            "cases": [
                {
                    "id": "h1",
                    "input_code": "x = 1\n",
                    "expected_literal": "[-0.04543421]",
                }
            ],
        }

        equivalent = self.generator_module._hidden_tests_equivalent(
            existing_hidden,
            generated_hidden,
            comparison=Comparison(type="allclose", rtol=1e-5, atol=1e-6),
        )

        self.assertTrue(equivalent)

    def test_exact_problem_rejects_expected_literal_float_drift(self) -> None:
        existing_hidden = {
            "schema_version": 1,
            "cases": [
                {
                    "id": "h1",
                    "input_code": "x = 1\n",
                    "expected_literal": "[0.28048956, 1.34552562]",
                }
            ],
        }
        generated_hidden = {
            "schema_version": 1,
            "cases": [
                {
                    "id": "h1",
                    "input_code": "x = 1\n",
                    "expected_literal": "[0.28048953, 1.34552574]",
                }
            ],
        }

        equivalent = self.generator_module._hidden_tests_equivalent(
            existing_hidden,
            generated_hidden,
            comparison=Comparison(type="exact"),
        )

        self.assertFalse(equivalent)

    def test_hidden_tests_equivalence_keeps_input_code_exact(self) -> None:
        existing_hidden = {
            "schema_version": 1,
            "cases": [
                {
                    "id": "h1",
                    "input_code": "x = 1\n",
                    "expected_literal": "[0.28048956, 1.34552562]",
                }
            ],
        }
        generated_hidden = {
            "schema_version": 1,
            "cases": [
                {
                    "id": "h1",
                    "input_code": "x = 2\n",
                    "expected_literal": "[0.28048956, 1.34552562]",
                }
            ],
        }

        equivalent = self.generator_module._hidden_tests_equivalent(
            existing_hidden,
            generated_hidden,
            comparison=Comparison(type="allclose", rtol=1e-5, atol=1e-6),
        )

        self.assertFalse(equivalent)

    def test_allclose_public_case_dedup_accepts_expected_literal_float_drift(self) -> None:
        generated_case = self.generator_module.Case(
            bucket="boundary",
            input_code="x = 1\n",
            expected=[0.28048953, 1.34552574],
        )
        public_case = CompiledTestCase(
            id="p1",
            input_code="x = 1\n",
            expected_literal="[0.28048956, 1.34552562]",
        )

        matches = self.generator_module._generated_case_matches_compiled_public(
            generated_case,
            public_case,
            comparison=Comparison(type="allclose", rtol=1e-5, atol=1e-6),
        )

        self.assertTrue(matches)

    def test_public_case_dedup_keeps_input_code_exact(self) -> None:
        generated_case = self.generator_module.Case(
            bucket="boundary",
            input_code="x = 2\n",
            expected=[0.28048956, 1.34552562],
        )
        public_case = CompiledTestCase(
            id="p1",
            input_code="x = 1\n",
            expected_literal="[0.28048956, 1.34552562]",
        )

        matches = self.generator_module._generated_case_matches_compiled_public(
            generated_case,
            public_case,
            comparison=Comparison(type="allclose", rtol=1e-5, atol=1e-6),
        )

        self.assertFalse(matches)
