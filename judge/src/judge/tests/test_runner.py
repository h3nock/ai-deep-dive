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
    def test_harness_reports_runtime_error_when_testcase_exec_fails_before_expected_parse(self) -> None:
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
                                "input_code": "a = 1\nb = missing_name\n",
                                "expected_literal": "3",
                            }
                        ],
                    }
                )
            )
            main_path.write_text("def add(a, b):\n    return a + b\n")

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
        self.assertEqual(case.get("status"), "Runtime Error")
        self.assertEqual(case.get("expected"), "None")
        self.assertIn("NameError", case.get("stderr", ""))
        self.assertIn("missing_name", case.get("stderr", ""))
