"""Legacy problem migration tests."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from judge.problem_migration import migrate_problem_corpus, migrate_problem_dir
from judge.problems import load_problem_spec_file as real_load_problem_spec_file


class ProblemMigrationTests(TestCase):
    def test_migrate_problem_dir_writes_canonical_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            problem_dir = Path(tmp_dir) / "problems/sample/01-basics/01-add"
            problem_dir.mkdir(parents=True)
            (problem_dir / "manifest.json").write_text(
                """{
  "id": "sample/01-basics/01-add",
  "version": "v1",
  "runner": "add(a, b)",
  "requires_torch": false,
  "time_limit_s": 5,
  "memory_mb": 512,
  "comparison": {"type": "exact"}
}"""
            )
            (problem_dir / "public_tests.json").write_text(
                """{
  "version": 1,
  "cases": [
    {"id": "case1", "input_code": "a = 1\\nb = 2\\n", "expected": 3}
  ]
}"""
            )
            (problem_dir / "hidden_tests.json").write_text(
                """{
  "version": 1,
  "cases": [
    {"id": "h1", "input_code": "a = 5\\nb = 6\\n", "expected": 11}
  ]
}"""
            )

            migrate_problem_dir(problem_dir, problems_root=Path(tmp_dir) / "problems")

            problem_payload = json.loads((problem_dir / "problem.json").read_text())
            public_payload = json.loads((problem_dir / "public_cases.json").read_text())
            hidden_payload = json.loads((problem_dir / "hidden_tests.json").read_text())

        self.assertEqual(problem_payload["execution_profile"], "light")
        self.assertEqual(problem_payload["arguments"], [{"name": "a"}, {"name": "b"}])
        self.assertEqual(
            public_payload["cases"],
            [
                {
                    "id": "case1",
                    "inputs": {"a": "1", "b": "2"},
                    "expected_literal": "3",
                }
            ],
        )
        self.assertEqual(
            hidden_payload["cases"],
            [
                {
                    "id": "h1",
                    "input_code": "a = 5\nb = 6\n",
                    "expected_literal": "11",
                }
            ],
        )

    def test_migrate_problem_dir_inlines_public_helper_aliases(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            problem_dir = Path(tmp_dir) / "problems/build-gpt/09-the-transformer-block/01-transformer-block"
            problem_dir.mkdir(parents=True)
            (problem_dir / "manifest.json").write_text(
                """{
  "id": "build-gpt/09-the-transformer-block/01-transformer-block",
  "version": "v1",
  "runner": "transformer_block(x, gamma1, beta1, W_Q, W_K, W_V, W_O, num_heads, gamma2, beta2, W1, b1, W2, b2)",
  "requires_torch": true,
  "time_limit_s": 5,
  "memory_mb": 1024,
  "comparison": {"type": "allclose", "rtol": 1e-5, "atol": 1e-6}
}"""
            )
            (problem_dir / "public_tests.json").write_text(
                """{
  "version": 1,
  "cases": [
    {
      "id": "case1",
      "input_code": "x = torch.tensor([[1.0]], dtype=torch.float32)\\nI = torch.eye(1, dtype=torch.float32)\\ngamma1 = torch.ones(1, dtype=torch.float32)\\nbeta1 = torch.zeros(1, dtype=torch.float32)\\nW_Q = I\\nW_K = I\\nW_V = I\\nW_O = I\\nnum_heads = 1\\ngamma2 = torch.ones(1, dtype=torch.float32)\\nbeta2 = torch.zeros(1, dtype=torch.float32)\\nW1 = torch.zeros((1, 1), dtype=torch.float32)\\nb1 = torch.zeros(1, dtype=torch.float32)\\nW2 = torch.zeros((1, 1), dtype=torch.float32)\\nb2 = torch.zeros(1, dtype=torch.float32)\\n",
      "expected": [[1.0]]
    }
  ]
}"""
            )
            (problem_dir / "hidden_tests.json").write_text(
                """{
  "version": 1,
  "cases": [
    {"id": "h1", "input_code": "x = torch.tensor([[0.0]], dtype=torch.float32)\\ngamma1 = torch.ones(1, dtype=torch.float32)\\nbeta1 = torch.zeros(1, dtype=torch.float32)\\nW_Q = torch.eye(1, dtype=torch.float32)\\nW_K = torch.eye(1, dtype=torch.float32)\\nW_V = torch.eye(1, dtype=torch.float32)\\nW_O = torch.eye(1, dtype=torch.float32)\\nnum_heads = 1\\ngamma2 = torch.ones(1, dtype=torch.float32)\\nbeta2 = torch.zeros(1, dtype=torch.float32)\\nW1 = torch.zeros((1, 1), dtype=torch.float32)\\nb1 = torch.zeros(1, dtype=torch.float32)\\nW2 = torch.zeros((1, 1), dtype=torch.float32)\\nb2 = torch.zeros(1, dtype=torch.float32)\\n", "expected": [[0.0]]}
  ]
}"""
            )

            migrate_problem_dir(problem_dir, problems_root=Path(tmp_dir) / "problems")

            public_payload = json.loads((problem_dir / "public_cases.json").read_text())

        self.assertEqual(
            public_payload["cases"][0]["inputs"]["W_Q"],
            "torch.eye(1, dtype=torch.float32)",
        )
        self.assertEqual(
            public_payload["cases"][0]["inputs"]["W_K"],
            "torch.eye(1, dtype=torch.float32)",
        )

    def test_migrate_problem_corpus_returns_each_migrated_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir) / "problems"
            problem_dir = root / "sample/01-basics/01-add"
            problem_dir.mkdir(parents=True)
            (problem_dir / "manifest.json").write_text(
                """{
  "id": "sample/01-basics/01-add",
  "version": "v1",
  "runner": "add(a, b)",
  "requires_torch": false,
  "time_limit_s": 5,
  "memory_mb": 512,
  "comparison": {"type": "exact"}
}"""
            )
            (problem_dir / "public_tests.json").write_text(
                """{
  "version": 1,
  "cases": [
    {"id": "case1", "input_code": "a = 1\\nb = 2\\n", "expected": 3}
  ]
}"""
            )
            (problem_dir / "hidden_tests.json").write_text(
                """{
  "version": 1,
  "cases": [
    {"id": "h1", "input_code": "a = 5\\nb = 6\\n", "expected": 11}
  ]
}"""
            )

            migrated = migrate_problem_corpus(root)

        self.assertEqual(migrated, [problem_dir])

    def test_migrate_problem_dir_derives_problem_id_from_passed_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            workspace = Path(tmp_dir)
            problems_root = workspace / "repo/judge/problems"
            problem_dir = problems_root / "sample/fundamentals/01-basics/01-add"
            problem_dir.mkdir(parents=True)
            (problem_dir / "manifest.json").write_text(
                """{
  "id": "sample/fundamentals/01-basics/01-add",
  "version": "v1",
  "runner": "add(a, b)",
  "requires_torch": false,
  "time_limit_s": 5,
  "memory_mb": 512,
  "comparison": {"type": "exact"}
}"""
            )
            (problem_dir / "public_tests.json").write_text(
                """{
  "version": 1,
  "cases": [
    {"id": "case1", "input_code": "a = 1\\nb = 2\\n", "expected": 3}
  ]
}"""
            )
            (problem_dir / "hidden_tests.json").write_text(
                """{
  "version": 1,
  "cases": [
    {"id": "h1", "input_code": "a = 5\\nb = 6\\n", "expected": 11}
  ]
}"""
            )

            captured_ids: list[str] = []

            def _capture_problem_spec(problem_id: str, path: Path):
                captured_ids.append(problem_id)
                return real_load_problem_spec_file(problem_id, path)

            with patch("judge.problem_migration.load_problem_spec_file", side_effect=_capture_problem_spec):
                migrate_problem_dir(problem_dir, problems_root=problems_root)

        self.assertEqual(captured_ids[-1], "sample/fundamentals/01-basics/01-add")
