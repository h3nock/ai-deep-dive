"""Problem-domain unit tests."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest import TestCase

from judge.problems import (
    Comparison,
    ExecutionPlanFactory,
    ProblemRepository,
    ProblemSpec,
    TestCase as JudgeTestCase,
    TestCaseCompiler,
    ArgumentSpec,
    inline_assignment_aliases,
    load_hidden_cases_file,
    load_problem_spec_file,
)


class TestCaseCompilerTests(TestCase):
    def setUp(self) -> None:
        self.spec = ProblemSpec(
            problem_id="sample/01-basics/01-add",
            arguments=(ArgumentSpec("a"), ArgumentSpec("b")),
            runner="add(a, b)",
            execution_profile="light",
            comparison=Comparison(type="exact"),
            time_limit_s=5,
            memory_mb=512,
        )
        self.compiler = TestCaseCompiler()

    def test_compile_case_preserves_argument_order_and_newline(self) -> None:
        compiled = self.compiler.compile_case(
            self.spec,
            JudgeTestCase(
                id="case1",
                inputs={"b": "2", "a": "1"},
                expected_literal="3",
            ),
        )

        self.assertEqual(compiled.id, "case1")
        self.assertEqual(compiled.input_code, "a = 1\nb = 2\n")
        self.assertEqual(compiled.expected_literal, "3")

    def test_compile_case_rejects_unknown_input_name(self) -> None:
        with self.assertRaisesRegex(ValueError, "exactly match problem arguments"):
            self.compiler.compile_case(
                self.spec,
                JudgeTestCase(
                    id="case1",
                    inputs={"a": "1", "c": "2"},
                    expected_literal="3",
                ),
            )

    def test_compile_case_rejects_disallowed_name_for_light_profile(self) -> None:
        with self.assertRaisesRegex(ValueError, "unknown name 'torch'"):
            self.compiler.compile_case(
                self.spec,
                JudgeTestCase(
                    id="case1",
                    inputs={"a": "torch.tensor([1])", "b": "2"},
                    expected_literal="3",
                ),
            )

    def test_compile_case_allows_torch_root_for_torch_profile(self) -> None:
        spec = ProblemSpec(
            problem_id="build-gpt/07-feed-forward-networks/01-gelu",
            arguments=(ArgumentSpec("x"),),
            runner="gelu(x)",
            execution_profile="torch",
            comparison=Comparison(type="allclose", rtol=1e-5, atol=1e-6),
            time_limit_s=5,
            memory_mb=1024,
        )

        compiled = self.compiler.compile_case(
            spec,
            JudgeTestCase(
                id="case1",
                inputs={"x": "torch.tensor([1.0], dtype=torch.float32)"},
                expected_literal="[0.84134475]",
            ),
        )

        self.assertEqual(
            compiled.input_code,
            "x = torch.tensor([1.0], dtype=torch.float32)\n",
        )


class ProblemSpecLoadingTests(TestCase):
    def test_problem_json_requires_runner_arguments_to_match_argument_specs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "problem.json"
            path.write_text(
                """{
  "schema_version": 1,
  "arguments": [{"name": "x"}],
  "runner": "gelu(x, y)",
  "execution_profile": "torch",
  "comparison": {"type": "allclose", "rtol": 1e-5, "atol": 1e-6},
  "time_limit_s": 5,
  "memory_mb": 1024
}"""
            )

            with self.assertRaisesRegex(ValueError, "arguments must match runner input names"):
                load_problem_spec_file("build-gpt/07-feed-forward-networks/01-gelu", path)

    def test_exact_comparison_rejects_tolerances(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "problem.json"
            path.write_text(
                """{
  "schema_version": 1,
  "arguments": [{"name": "a"}, {"name": "b"}],
  "runner": "add(a, b)",
  "execution_profile": "light",
  "comparison": {"type": "exact", "rtol": 1e-5, "atol": 1e-6},
  "time_limit_s": 5,
  "memory_mb": 512
}"""
            )

            with self.assertRaisesRegex(ValueError, "must not include rtol/atol"):
                load_problem_spec_file("sample/01-basics/01-add", path)


class HiddenCasesLoadingTests(TestCase):
    def test_hidden_cases_require_runner_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "hidden_tests.json"
            path.write_text(
                """{
  "schema_version": 1,
  "cases": [
    {"id": "h1", "input_code": "a = 1\\n", "expected_literal": "3"}
  ]
}"""
            )
            spec = ProblemSpec(
                problem_id="sample/01-basics/01-add",
                arguments=(ArgumentSpec("a"), ArgumentSpec("b")),
                runner="add(a, b)",
                execution_profile="light",
                comparison=Comparison(type="exact"),
                time_limit_s=5,
                memory_mb=512,
            )

            with self.assertRaisesRegex(ValueError, "does not assign required names: b"):
                load_hidden_cases_file(path, spec)


class AliasInliningTests(TestCase):
    def test_inline_assignment_aliases_inlines_helper_names_into_argument_values(self) -> None:
        inputs = inline_assignment_aliases(
            input_code=(
                "x = torch.tensor([[1.0, 0.0]], dtype=torch.float32)\n"
                "I = torch.eye(2, dtype=torch.float32)\n"
                "W_Q = I\n"
                "W_K = I\n"
            ),
            argument_names=["x", "W_Q", "W_K"],
            allowed_root_names={"torch"},
        )

        self.assertEqual(
            inputs,
            {
                "x": "torch.tensor([[1.0, 0.0]], dtype=torch.float32)",
                "W_Q": "torch.eye(2, dtype=torch.float32)",
                "W_K": "torch.eye(2, dtype=torch.float32)",
            },
        )


class ExecutionPlanFactoryTests(TestCase):
    def test_submit_plan_flattens_public_then_hidden_cases(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            problem_dir = root / "sample/01-basics/01-add"
            problem_dir.mkdir(parents=True)
            (problem_dir / "problem.json").write_text(
                """{
  "schema_version": 1,
  "arguments": [{"name": "a"}, {"name": "b"}],
  "runner": "add(a, b)",
  "execution_profile": "light",
  "comparison": {"type": "exact"},
  "time_limit_s": 5,
  "memory_mb": 512
}"""
            )
            (problem_dir / "public_cases.json").write_text(
                """{
  "schema_version": 1,
  "cases": [
    {"id": "p1", "inputs": {"a": "1", "b": "2"}, "expected_literal": "3"}
  ]
}"""
            )
            (problem_dir / "hidden_tests.json").write_text(
                """{
  "schema_version": 1,
  "cases": [
    {"id": "h1", "input_code": "a = 5\\nb = 6\\n", "expected_literal": "11"}
  ]
}"""
            )

            repo = ProblemRepository(root)
            factory = ExecutionPlanFactory(repo)

            plan = factory.build_submit_plan("sample/01-basics/01-add")

        self.assertEqual(plan.problem_id, "sample/01-basics/01-add")
        self.assertEqual(plan.detail_mode, "first_failure")
        self.assertEqual([case.id for case in plan.cases], ["p1", "h1"])
