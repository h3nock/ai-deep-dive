"""Deploy env example contract checks."""

from __future__ import annotations

import re
from pathlib import Path
from unittest import TestCase


class DeployEnvExampleContractTests(TestCase):
    def test_runtime_and_deploy_keys_exist_in_env_example(self) -> None:
        judge_root = Path(__file__).resolve().parents[3]
        src_root = judge_root / "src" / "judge"
        env_example_path = judge_root / "deploy" / "judge.env.example"

        env_example_text = env_example_path.read_text()

        runtime_keys: set[str] = set()
        patterns = (
            r'os\.getenv\("([A-Z0-9_]+)"',
            r'os\.environ\.get\("([A-Z0-9_]+)"',
            r'_env_int\("([A-Z0-9_]+)"',
        )
        for path in src_root.rglob("*.py"):
            if "tests" in path.parts:
                continue
            text = path.read_text()
            for pattern in patterns:
                runtime_keys.update(
                    key
                    for key in re.findall(pattern, text)
                    if key.startswith("JUDGE_")
                )

        deploy_keys = {
            "JUDGE_API_WORKERS",
            "JUDGE_LIGHT_WORKERS",
            "JUDGE_TORCH_WORKERS",
            "JUDGE_TESTS_ROOT",
        }

        expected_keys = runtime_keys | deploy_keys
        example_keys = set(re.findall(r"^([A-Z0-9_]+)=", env_example_text, flags=re.MULTILINE))
        missing = sorted(expected_keys - example_keys)

        self.assertFalse(
            missing,
            msg=f"judge.env.example is missing keys: {missing}",
        )
