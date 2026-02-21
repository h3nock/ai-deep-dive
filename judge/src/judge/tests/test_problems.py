"""Problem loader behavior tests."""

from __future__ import annotations

from unittest import TestCase

from judge.problems import _case_from_raw


class ProblemCaseParsingTests(TestCase):
    def test_input_code_is_preserved(self) -> None:
        case = _case_from_raw(
            {
                "id": "case-1",
                "input_code": "text = 'Hello'\ncount = 3\nenabled = True\n",
                "expected": 123,
            }
        )

        self.assertEqual(
            case.input_code,
            "text = 'Hello'\ncount = 3\nenabled = True\n",
        )

    def test_missing_input_code_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "non-empty input_code"):
            _case_from_raw(
                {
                    "id": "case-1",
                    "expected": 1,
                }
            )

    def test_non_string_input_code_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "non-empty input_code"):
            _case_from_raw(
                {
                    "id": "case-1",
                    "input_code": 3,
                    "expected": 1,
                }
            )

    def test_input_code_is_normalized_to_include_trailing_newline(self) -> None:
        case = _case_from_raw(
            {
                "id": "case-1",
                "input_code": "x = 1",
                "expected": 1,
            }
        )
        self.assertEqual(case.input_code, "x = 1\n")
