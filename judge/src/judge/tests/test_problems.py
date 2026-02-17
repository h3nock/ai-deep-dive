"""Problem loader behavior tests."""

from __future__ import annotations

from unittest import TestCase

from judge.problems import _case_from_raw


class ProblemCaseParsingTests(TestCase):
    def test_inputs_are_serialized_with_python_literals(self) -> None:
        case = _case_from_raw(
            {
                "id": "case-1",
                "inputs": {
                    "text": "Hello",
                    "count": 3,
                    "enabled": True,
                },
                "expected": 123,
            }
        )

        self.assertEqual(
            case.input_code,
            "text = 'Hello'\ncount = 3\nenabled = True\n",
        )

    def test_invalid_input_name_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "Invalid input variable name"):
            _case_from_raw(
                {
                    "id": "case-1",
                    "inputs": {"not-valid-name": "value"},
                    "expected": 1,
                }
            )
