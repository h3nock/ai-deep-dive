"""Runner harness regression tests."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest import TestCase

from judge.runner import HARNESS_CODE


class RunnerHarnessTests(TestCase):
    def _run_harness_case(
        self,
        *,
        main_code: str,
        input_code: str,
        expected_literal: str = "3",
    ) -> dict[str, object]:
        with tempfile.TemporaryDirectory() as tmp_dir:
            temp_root = Path(tmp_dir)
            harness_path = temp_root / "harness.py"
            config_path = temp_root / "test_config.json"
            main_path = temp_root / "main.py"

            harness_path.write_text(HARNESS_CODE)
            config_path.write_text(
                json.dumps(
                    {
                        "runner": "add(a, b)",
                        "comparison": {"type": "exact"},
                        "execution_profile": "light",
                        "cases": [
                            {
                                "id": "case1",
                                "input_code": input_code,
                                "expected_literal": expected_literal,
                            }
                        ],
                    }
                )
            )
            main_path.write_text(main_code)

            result = subprocess.run(
                [sys.executable, str(harness_path)],
                cwd=temp_root,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0)
            payload = json.loads(result.stdout)
            self.assertEqual(len(payload), 1)
            case = payload[0]
            assert isinstance(case, dict)
            return case

    def test_harness_reports_syntax_error_for_invalid_user_code(self) -> None:
        case = self._run_harness_case(
            main_code="def add(a, b)\n    return a + b\n",
            input_code="a = 1\nb = 2\n",
        )

        self.assertEqual(case.get("status"), "Syntax Error")
        self.assertIn("SyntaxError", case.get("stderr", ""))

    def test_harness_reports_syntax_error_for_invalid_testcase_input(self) -> None:
        case = self._run_harness_case(
            main_code="def add(a, b):\n    return a + b\n",
            input_code="a = 1\nb =\n",
        )

        self.assertEqual(case.get("status"), "Syntax Error")
        self.assertEqual(case.get("expected"), "3")
        self.assertIn("SyntaxError", case.get("stderr", ""))

    def test_harness_preserves_expected_when_testcase_exec_fails_before_solution_runs(self) -> None:
        case = self._run_harness_case(
            main_code="def add(a, b):\n    return a + b\n",
            input_code="a = 1\nb = missing_name\n",
        )

        self.assertEqual(case.get("status"), "Runtime Error")
        self.assertEqual(case.get("expected"), "3")
        self.assertIn("NameError", case.get("stderr", ""))
        self.assertIn("missing_name", case.get("stderr", ""))
