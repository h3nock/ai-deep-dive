"""Problem-domain unit tests."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest import TestCase

from judge.problems import (
    ArgumentSpec,
    Comparison,
    ExecutionPlanFactory,
    ProblemRepository,
    ProblemSpec,
    TestCaseCompiler,
    inline_assignment_aliases,
    load_hidden_cases_file,
    load_problem_spec_file,
    load_public_cases_file,
)
from judge.problems import (
    TestCase as JudgeTestCase,
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

    def test_compile_case_rejects_lambda_expression(self) -> None:
        with self.assertRaisesRegex(ValueError, "Lambda"):
            self.compiler.compile_case(
                self.spec,
                JudgeTestCase(
                    id="case1",
                    inputs={"a": "lambda: 1", "b": "2"},
                    expected_literal="3",
                ),
            )

    def test_compile_case_rejects_list_comprehension(self) -> None:
        with self.assertRaisesRegex(ValueError, "ListComp"):
            self.compiler.compile_case(
                self.spec,
                JudgeTestCase(
                    id="case1",
                    inputs={"a": "[value for value in [1]]", "b": "2"},
                    expected_literal="3",
                ),
            )

    def test_compile_case_rejects_named_expression(self) -> None:
        with self.assertRaisesRegex(ValueError, "NamedExpr"):
            self.compiler.compile_case(
                self.spec,
                JudgeTestCase(
                    id="case1",
                    inputs={"a": "(value := 1)", "b": "2"},
                    expected_literal="3",
                ),
            )

    def test_compile_case_rejects_starred_call_args(self) -> None:
        spec = ProblemSpec(
            problem_id="build-gpt/07-feed-forward-networks/01-gelu",
            arguments=(ArgumentSpec("x"),),
            runner="gelu(x)",
            execution_profile="torch",
            comparison=Comparison(type="allclose", rtol=1e-5, atol=1e-6),
            time_limit_s=5,
            memory_mb=1024,
        )

        with self.assertRaisesRegex(ValueError, "Starred"):
            self.compiler.compile_case(
                spec,
                JudgeTestCase(
                    id="case1",
                    inputs={"x": "torch.tensor(*[[1.0]])"},
                    expected_literal="[0.84134475]",
                ),
            )

    def test_compile_case_rejects_disallowed_binary_operator(self) -> None:
        with self.assertRaisesRegex(ValueError, "disallowed binary operator"):
            self.compiler.compile_case(
                self.spec,
                JudgeTestCase(
                    id="case1",
                    inputs={"a": "4 // 2", "b": "2"},
                    expected_literal="4",
                ),
            )

    def test_compile_case_rejects_unknown_attribute_root(self) -> None:
        spec = ProblemSpec(
            problem_id="build-gpt/07-feed-forward-networks/01-gelu",
            arguments=(ArgumentSpec("x"),),
            runner="gelu(x)",
            execution_profile="torch",
            comparison=Comparison(type="allclose", rtol=1e-5, atol=1e-6),
            time_limit_s=5,
            memory_mb=1024,
        )

        with self.assertRaisesRegex(ValueError, "unknown name 'math'"):
            self.compiler.compile_case(
                spec,
                JudgeTestCase(
                    id="case1",
                    inputs={"x": "math.pi"},
                    expected_literal="[3.14159265]",
                ),
            )

    def test_compile_case_rejects_empty_expected_literal(self) -> None:
        with self.assertRaisesRegex(ValueError, "expected_literal must be a non-empty string"):
            self.compiler.compile_case(
                self.spec,
                JudgeTestCase(
                    id="case1",
                    inputs={"a": "1", "b": "2"},
                    expected_literal="",
                ),
            )

    def test_compile_case_rejects_invalid_expected_literal(self) -> None:
        with self.assertRaisesRegex(ValueError, "not a valid Python literal"):
            self.compiler.compile_case(
                self.spec,
                JudgeTestCase(
                    id="case1",
                    inputs={"a": "1", "b": "2"},
                    expected_literal="[1",
                ),
            )

    def test_compile_cases_rejects_duplicate_ids(self) -> None:
        with self.assertRaisesRegex(ValueError, "Duplicate TestCase id: case1"):
            self.compiler.compile_cases(
                self.spec,
                [
                    JudgeTestCase(id="case1", inputs={"a": "1", "b": "2"}, expected_literal="3"),
                    JudgeTestCase(id="case1", inputs={"a": "2", "b": "3"}, expected_literal="5"),
                ],
            )


class ProblemSpecLoadingTests(TestCase):
    def test_problem_json_rejects_unknown_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "problem.json"
            path.write_text(
                """{
  "schema_version": 1,
  "arguments": [{"name": "a"}, {"name": "b"}],
  "runner": "add(a, b)",
  "execution_profile": "light",
  "comparison": {"type": "exact"},
  "time_limit_s": 5,
  "memory_mb": 512,
  "extra": true
}"""
            )

            with self.assertRaisesRegex(ValueError, "unknown fields: extra"):
                load_problem_spec_file("sample/01-basics/01-add", path)

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
    def test_hidden_cases_allow_tuple_key_expected_literals(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "hidden_tests.json"
            path.write_text(
                """{
  "schema_version": 1,
  "cases": [
    {"id": "h1", "input_code": "a = 1\\nb = 2\\n", "expected_literal": "{(1, 2): 3}"}
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

            cases = load_hidden_cases_file(path, spec)

        self.assertEqual(cases[0].expected_literal, "{(1, 2): 3}")

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

    def test_hidden_cases_reject_duplicate_ids(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "hidden_tests.json"
            path.write_text(
                """{
  "schema_version": 1,
  "cases": [
    {"id": "h1", "input_code": "a = 1\\nb = 2\\n", "expected_literal": "3"},
    {"id": "h1", "input_code": "a = 5\\nb = 6\\n", "expected_literal": "11"}
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

            with self.assertRaisesRegex(ValueError, "duplicate id: h1"):
                load_hidden_cases_file(path, spec)


class PublicCasesLoadingTests(TestCase):
    def test_public_cases_reject_unknown_case_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "public_cases.json"
            path.write_text(
                """{
  "schema_version": 1,
  "cases": [
    {
      "id": "case1",
      "inputs": {"a": "1", "b": "2"},
      "expected_literal": "3",
      "extra": true
    }
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

            with self.assertRaisesRegex(ValueError, "unknown fields: extra"):
                load_public_cases_file(path, spec)


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


class ProblemRepositoryCachingTests(TestCase):
    def test_repository_reuses_cached_compiled_public_cases_when_files_unchanged(self) -> None:
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

            class CountingCompiler(TestCaseCompiler):
                def __init__(self) -> None:
                    super().__init__()
                    self.compile_calls = 0

                def compile_cases(self, spec: ProblemSpec, cases: list[JudgeTestCase]):
                    self.compile_calls += 1
                    return super().compile_cases(spec, cases)

            repo = ProblemRepository(root)
            compiler = CountingCompiler()
            repo.compiler = compiler

            first = repo.get_compiled_public_cases("sample/01-basics/01-add")
            second = repo.get_compiled_public_cases("sample/01-basics/01-add")

        self.assertEqual([case.id for case in first], ["p1"])
        self.assertEqual([case.id for case in second], ["p1"])
        self.assertEqual(compiler.compile_calls, 1)
