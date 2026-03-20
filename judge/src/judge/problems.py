"""Canonical judge problem loading, validation, and compilation."""

from __future__ import annotations

import ast
import copy
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal


ExecutionProfile = Literal["light", "torch"]
ComparisonType = Literal["exact", "allclose"]
DetailMode = Literal["all", "first_failure"]

_PROBLEM_KEYS = {
    "schema_version",
    "arguments",
    "runner",
    "execution_profile",
    "comparison",
    "time_limit_s",
    "memory_mb",
}
_ARGUMENT_KEYS = {"name", "type"}
_PUBLIC_CASES_KEYS = {"schema_version", "cases"}
_HIDDEN_TESTS_KEYS = {"schema_version", "cases"}
_TEST_CASE_KEYS = {"id", "inputs", "expected_literal", "explanation"}
_COMPILED_TEST_CASE_KEYS = {"id", "input_code", "expected_literal"}
_COMPARISON_KEYS = {"type", "rtol", "atol"}
_ALLOWED_AST_NODES = (
    ast.Expression,
    ast.Constant,
    ast.List,
    ast.Tuple,
    ast.Dict,
    ast.Set,
    ast.UnaryOp,
    ast.BinOp,
    ast.Call,
    ast.keyword,
    ast.Attribute,
    ast.Subscript,
    ast.Slice,
    ast.Load,
    ast.Name,
)
_ALLOWED_UNARY_OPS = (ast.UAdd, ast.USub)
_ALLOWED_BINARY_OPS = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow)


@dataclass(frozen=True)
class Comparison:
    type: ComparisonType
    rtol: float | None = None
    atol: float | None = None

    def as_payload(self) -> dict[str, Any]:
        if self.type == "exact":
            return {"type": "exact"}
        return {
            "type": "allclose",
            "rtol": self.rtol,
            "atol": self.atol,
        }


@dataclass(frozen=True)
class ArgumentSpec:
    name: str
    type: str | None = None


@dataclass(frozen=True)
class ProblemSpec:
    problem_id: str
    arguments: tuple[ArgumentSpec, ...]
    runner: str
    execution_profile: ExecutionProfile
    comparison: Comparison
    time_limit_s: int
    memory_mb: int


@dataclass(frozen=True)
class TestCase:
    id: str
    inputs: dict[str, str]
    expected_literal: str
    explanation: str | None = None


@dataclass(frozen=True)
class CompiledTestCase:
    id: str
    input_code: str
    expected_literal: str


@dataclass(frozen=True)
class ExecutionPlan:
    problem_id: str
    runner: str
    execution_profile: ExecutionProfile
    comparison: Comparison
    time_limit_s: int
    memory_mb: int
    cases: tuple[CompiledTestCase, ...]
    detail_mode: DetailMode


@dataclass(frozen=True)
class _ProblemBundle:
    spec: ProblemSpec
    compiled_public_cases: tuple[CompiledTestCase, ...]
    hidden_cases: tuple[CompiledTestCase, ...]


def _safe_problem_path(root: Path, problem_id: str) -> Path:
    if problem_id.startswith("/") or ".." in problem_id.split("/"):
        raise ValueError("Invalid problem id")
    return root / problem_id


def _file_signature(path: Path) -> tuple[int, int]:
    stat = path.stat()
    return (stat.st_mtime_ns, stat.st_size)


def _bundle_signature(problem_dir: Path) -> tuple[tuple[int, int], tuple[int, int], tuple[int, int]]:
    return (
        _file_signature(problem_dir / "problem.json"),
        _file_signature(problem_dir / "public_cases.json"),
        _file_signature(problem_dir / "hidden_tests.json"),
    )


def _load_json_dict(path: Path) -> dict[str, Any]:
    raw = json.loads(path.read_text())
    if not isinstance(raw, dict):
        raise ValueError(f"{path.name} must contain a JSON object")
    return raw


def _reject_unknown_fields(raw: dict[str, Any], *, allowed: set[str], context: str) -> None:
    unknown = sorted(set(raw) - allowed)
    if unknown:
        joined = ", ".join(unknown)
        raise ValueError(f"{context} contains unknown fields: {joined}")


def _ensure_non_empty_str(value: Any, *, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{context} must be a non-empty string")
    return value


def _parse_expected_literal(value: Any, *, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{context} must be a non-empty string")
    try:
        ast.literal_eval(value)
    except (ValueError, SyntaxError) as exc:
        raise ValueError(f"{context} is not a valid Python literal: {exc}") from exc
    return value


def runner_input_names(runner: str) -> list[str]:
    expr = ast.parse(runner, mode="eval").body
    if isinstance(expr, ast.Call):
        ordered: list[str] = []
        for arg in expr.args:
            ordered.extend(_ordered_name_refs(arg))
        for kw in expr.keywords:
            ordered.extend(_ordered_name_refs(kw.value))
        return _unique_preserving_order(ordered)
    return _unique_preserving_order(_ordered_name_refs(expr))


def _ordered_name_refs(node: ast.AST) -> list[str]:
    names: list[str] = []
    for child in ast.walk(node):
        if isinstance(child, ast.Name):
            names.append(child.id)
    return names


def _unique_preserving_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered


def _extract_target_names(target: ast.expr) -> set[str]:
    if isinstance(target, ast.Name):
        return {target.id}
    if isinstance(target, (ast.Tuple, ast.List)):
        names: set[str] = set()
        for item in target.elts:
            names |= _extract_target_names(item)
        return names
    return set()


def _case_input_names(input_code: str) -> set[str]:
    tree = ast.parse(input_code, mode="exec")
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                names |= _extract_target_names(target)
        elif isinstance(node, ast.AnnAssign):
            names |= _extract_target_names(node.target)
    return names


def _validate_comparison(raw: Any, *, context: str) -> Comparison:
    if not isinstance(raw, dict):
        raise ValueError(f"{context} must be an object")
    _reject_unknown_fields(raw, allowed=_COMPARISON_KEYS, context=context)

    cmp_type = raw.get("type")
    if cmp_type not in {"exact", "allclose"}:
        raise ValueError(f"{context}.type must be 'exact' or 'allclose'")

    if cmp_type == "exact":
        if "rtol" in raw or "atol" in raw:
            raise ValueError(f"{context} must not include rtol/atol for exact comparison")
        return Comparison(type="exact")

    if "rtol" not in raw or "atol" not in raw:
        raise ValueError(f"{context} must include rtol and atol for allclose comparison")

    rtol = float(raw["rtol"])
    atol = float(raw["atol"])
    if not math.isfinite(rtol) or rtol < 0:
        raise ValueError(f"{context}.rtol must be a finite non-negative number")
    if not math.isfinite(atol) or atol < 0:
        raise ValueError(f"{context}.atol must be a finite non-negative number")
    return Comparison(type="allclose", rtol=rtol, atol=atol)


def _load_argument_specs(raw_arguments: Any, *, runner: str, context: str) -> tuple[ArgumentSpec, ...]:
    if not isinstance(raw_arguments, list) or not raw_arguments:
        raise ValueError(f"{context} must define a non-empty arguments list")

    argument_specs: list[ArgumentSpec] = []
    names: list[str] = []
    for index, raw_argument in enumerate(raw_arguments):
        if not isinstance(raw_argument, dict):
            raise ValueError(f"{context}.arguments[{index}] must be an object")
        _reject_unknown_fields(
            raw_argument,
            allowed=_ARGUMENT_KEYS,
            context=f"{context}.arguments[{index}]",
        )
        name = _ensure_non_empty_str(
            raw_argument.get("name"),
            context=f"{context}.arguments[{index}].name",
        ).strip()
        if not name.isidentifier():
            raise ValueError(f"{context}.arguments[{index}].name must be a valid identifier")
        type_raw = raw_argument.get("type")
        arg_type = None
        if type_raw is not None:
            arg_type = _ensure_non_empty_str(
                type_raw,
                context=f"{context}.arguments[{index}].type",
            ).strip()
        names.append(name)
        argument_specs.append(ArgumentSpec(name=name, type=arg_type))

    if len(set(names)) != len(names):
        raise ValueError(f"{context}.arguments must have unique names")

    runner_names = runner_input_names(runner)
    if set(runner_names) != set(names):
        raise ValueError(
            f"{context}.arguments must match runner input names: expected {runner_names}, got {names}"
        )

    return tuple(argument_specs)


def load_problem_spec_file(problem_id: str, path: Path) -> ProblemSpec:
    raw = _load_json_dict(path)
    context = path.name
    _reject_unknown_fields(raw, allowed=_PROBLEM_KEYS, context=context)

    schema_version = raw.get("schema_version")
    if schema_version != 1:
        raise ValueError(f"{context}.schema_version must equal 1")

    runner = _ensure_non_empty_str(raw.get("runner"), context=f"{context}.runner").strip()
    try:
        ast.parse(runner, mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"{context}.runner is not a valid expression: {exc.msg}") from exc

    execution_profile = raw.get("execution_profile")
    if execution_profile not in {"light", "torch"}:
        raise ValueError(f"{context}.execution_profile must be 'light' or 'torch'")

    comparison = _validate_comparison(raw.get("comparison"), context=f"{context}.comparison")

    time_limit_s = raw.get("time_limit_s")
    memory_mb = raw.get("memory_mb")
    if not isinstance(time_limit_s, int) or isinstance(time_limit_s, bool) or time_limit_s <= 0:
        raise ValueError(f"{context}.time_limit_s must be a positive integer")
    if not isinstance(memory_mb, int) or isinstance(memory_mb, bool) or memory_mb <= 0:
        raise ValueError(f"{context}.memory_mb must be a positive integer")

    arguments = _load_argument_specs(raw.get("arguments"), runner=runner, context=context)

    return ProblemSpec(
        problem_id=problem_id,
        arguments=arguments,
        runner=runner,
        execution_profile=execution_profile,
        comparison=comparison,
        time_limit_s=time_limit_s,
        memory_mb=memory_mb,
    )


class _ExpressionWhitelistValidator:
    def __init__(self, *, allowed_roots: set[str]) -> None:
        self.allowed_roots = allowed_roots

    def validate(self, expression: str, *, context: str) -> None:
        try:
            tree = ast.parse(expression, mode="eval")
        except SyntaxError as exc:
            raise ValueError(f"{context} is not a valid expression: {exc.msg}") from exc
        self.visit(tree, context=context)

    def visit(self, node: ast.AST, *, context: str) -> None:
        if not isinstance(node, _ALLOWED_AST_NODES):
            raise ValueError(f"{context} contains disallowed syntax: {type(node).__name__}")

        method = getattr(self, f"visit_{type(node).__name__}", None)
        if method is not None:
            method(node, context=context)
            return

        for child in ast.iter_child_nodes(node):
            self.visit(child, context=context)

    def visit_UnaryOp(self, node: ast.UnaryOp, *, context: str) -> None:
        if not isinstance(node.op, _ALLOWED_UNARY_OPS):
            raise ValueError(f"{context} contains disallowed unary operator")
        self.visit(node.operand, context=context)

    def visit_BinOp(self, node: ast.BinOp, *, context: str) -> None:
        if not isinstance(node.op, _ALLOWED_BINARY_OPS):
            raise ValueError(f"{context} contains disallowed binary operator")
        self.visit(node.left, context=context)
        self.visit(node.right, context=context)

    def visit_Name(self, node: ast.Name, *, context: str) -> None:
        if node.id not in self.allowed_roots:
            raise ValueError(f"{context} references unknown name '{node.id}'")

    def visit_Call(self, node: ast.Call, *, context: str) -> None:
        if any(keyword.arg is None for keyword in node.keywords):
            raise ValueError(f"{context} may not use *args or **kwargs expansion")
        if not isinstance(node.func, (ast.Name, ast.Attribute)):
            raise ValueError(f"{context} contains an invalid call target")
        self._validate_callable_root(node.func, context=context)
        self.visit(node.func, context=context)
        for arg in node.args:
            self.visit(arg, context=context)
        for keyword in node.keywords:
            self.visit(keyword, context=context)

    def visit_Attribute(self, node: ast.Attribute, *, context: str) -> None:
        self._validate_attribute_chain(node, context=context)
        self.visit(node.value, context=context)

    def visit_Subscript(self, node: ast.Subscript, *, context: str) -> None:
        self.visit(node.value, context=context)
        self.visit(node.slice, context=context)

    def visit_Slice(self, node: ast.Slice, *, context: str) -> None:
        if node.lower is not None:
            self.visit(node.lower, context=context)
        if node.upper is not None:
            self.visit(node.upper, context=context)
        if node.step is not None:
            self.visit(node.step, context=context)

    def _validate_callable_root(self, node: ast.AST, *, context: str) -> None:
        if isinstance(node, ast.Name):
            if node.id not in self.allowed_roots:
                raise ValueError(f"{context} call target must start from an allowed root name")
            return
        if isinstance(node, ast.Attribute):
            self._validate_attribute_chain(node, context=context)
            return
        raise ValueError(f"{context} contains an invalid call target")

    def _validate_attribute_chain(self, node: ast.Attribute, *, context: str) -> None:
        root: ast.AST = node
        while isinstance(root, ast.Attribute):
            root = root.value
        if not isinstance(root, ast.Name):
            raise ValueError(f"{context} attribute access must be rooted in an allowed name")
        if root.id not in self.allowed_roots:
            raise ValueError(f"{context} references unknown name '{root.id}'")


class TestCaseCompiler:
    def validate(self, spec: ProblemSpec, case: TestCase) -> None:
        case_id = case.id.strip()
        if not case_id:
            raise ValueError("TestCase.id must be a non-empty string")
        if set(case.inputs) != {argument.name for argument in spec.arguments}:
            expected = [argument.name for argument in spec.arguments]
            actual = sorted(case.inputs)
            raise ValueError(f"TestCase.inputs must exactly match problem arguments: expected {expected}, got {actual}")

        allowed_roots = {"torch"} if spec.execution_profile == "torch" else set()
        validator = _ExpressionWhitelistValidator(allowed_roots=allowed_roots)
        for argument in spec.arguments:
            raw_expression = case.inputs.get(argument.name)
            if not isinstance(raw_expression, str) or not raw_expression.strip():
                raise ValueError(f"TestCase input '{argument.name}' must be a non-empty string")
            validator.validate(
                raw_expression,
                context=f"TestCase[{case_id}].inputs[{argument.name}]",
            )

        _parse_expected_literal(
            case.expected_literal,
            context=f"TestCase[{case_id}].expected_literal",
        )

        if case.explanation is not None and not isinstance(case.explanation, str):
            raise ValueError(f"TestCase[{case_id}].explanation must be a string when provided")

    def validate_cases(self, spec: ProblemSpec, cases: list[TestCase]) -> None:
        seen: set[str] = set()
        for case in cases:
            case_id = case.id.strip()
            if case_id in seen:
                raise ValueError(f"Duplicate TestCase id: {case_id}")
            seen.add(case_id)
            self.validate(spec, case)

    def compile_case(self, spec: ProblemSpec, case: TestCase) -> CompiledTestCase:
        self.validate(spec, case)
        lines: list[str] = []
        for argument in spec.arguments:
            expression = case.inputs[argument.name].strip()
            lines.append(f"{argument.name} = {expression}")
        input_code = "\n".join(lines)
        if input_code:
            input_code += "\n"
        return CompiledTestCase(
            id=case.id.strip(),
            input_code=input_code,
            expected_literal=case.expected_literal,
        )

    def compile_cases(self, spec: ProblemSpec, cases: list[TestCase]) -> list[CompiledTestCase]:
        self.validate_cases(spec, cases)
        compiled: list[CompiledTestCase] = []
        for case in cases:
            lines: list[str] = []
            for argument in spec.arguments:
                expression = case.inputs[argument.name].strip()
                lines.append(f"{argument.name} = {expression}")
            input_code = "\n".join(lines)
            if input_code:
                input_code += "\n"
            compiled.append(
                CompiledTestCase(
                    id=case.id.strip(),
                    input_code=input_code,
                    expected_literal=case.expected_literal,
                )
            )
        return compiled


def _load_test_case(raw: dict[str, Any], *, context: str) -> TestCase:
    _reject_unknown_fields(raw, allowed=_TEST_CASE_KEYS, context=context)
    case_id = _ensure_non_empty_str(raw.get("id"), context=f"{context}.id").strip()

    inputs_raw = raw.get("inputs")
    if not isinstance(inputs_raw, dict):
        raise ValueError(f"{context}.inputs must be an object")
    inputs: dict[str, str] = {}
    for key, value in inputs_raw.items():
        if not isinstance(key, str):
            raise ValueError(f"{context}.inputs keys must be strings")
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{context}.inputs[{key}] must be a non-empty string")
        inputs[key] = value

    explanation_raw = raw.get("explanation")
    explanation = None
    if explanation_raw is not None:
        if not isinstance(explanation_raw, str):
            raise ValueError(f"{context}.explanation must be a string")
        explanation = explanation_raw

    return TestCase(
        id=case_id,
        inputs=inputs,
        expected_literal=_parse_expected_literal(
            raw.get("expected_literal"),
            context=f"{context}.expected_literal",
        ),
        explanation=explanation,
    )


def load_public_cases_file(path: Path, spec: ProblemSpec, compiler: TestCaseCompiler | None = None) -> tuple[TestCase, ...]:
    raw = _load_json_dict(path)
    context = path.name
    _reject_unknown_fields(raw, allowed=_PUBLIC_CASES_KEYS, context=context)
    if raw.get("schema_version") != 1:
        raise ValueError(f"{context}.schema_version must equal 1")
    cases_raw = raw.get("cases")
    if not isinstance(cases_raw, list):
        raise ValueError(f"{context}.cases must be a list")

    loaded_cases = tuple(
        _load_test_case(case_raw, context=f"{context}.cases[{index}]")
        for index, case_raw in enumerate(cases_raw)
        if isinstance(case_raw, dict)
    )
    if len(loaded_cases) != len(cases_raw):
        raise ValueError(f"{context}.cases must contain objects only")

    validator = compiler or TestCaseCompiler()
    validator.validate_cases(spec, list(loaded_cases))
    return loaded_cases


def _load_compiled_test_case(raw: dict[str, Any], *, required_names: set[str], context: str) -> CompiledTestCase:
    _reject_unknown_fields(raw, allowed=_COMPILED_TEST_CASE_KEYS, context=context)
    case_id = _ensure_non_empty_str(raw.get("id"), context=f"{context}.id").strip()
    input_code = _ensure_non_empty_str(raw.get("input_code"), context=f"{context}.input_code")
    if not input_code.endswith("\n"):
        input_code += "\n"
    try:
        ast.parse(input_code, mode="exec")
    except SyntaxError as exc:
        raise ValueError(f"{context}.input_code is not valid Python code: {exc.msg}") from exc

    assigned = _case_input_names(input_code)
    missing = sorted(name for name in required_names if name not in assigned)
    if missing:
        joined = ", ".join(missing)
        raise ValueError(f"{context}.input_code does not assign required names: {joined}")

    return CompiledTestCase(
        id=case_id,
        input_code=input_code,
        expected_literal=_parse_expected_literal(
            raw.get("expected_literal"),
            context=f"{context}.expected_literal",
        ),
    )


def load_compiled_test_cases(
    cases_raw: Any,
    spec: ProblemSpec,
    *,
    context: str,
) -> tuple[CompiledTestCase, ...]:
    if not isinstance(cases_raw, list):
        raise ValueError(f"{context}.cases must be a list")

    required_names = {argument.name for argument in spec.arguments}
    loaded_cases: list[CompiledTestCase] = []
    seen_ids: set[str] = set()
    for index, case_raw in enumerate(cases_raw):
        if not isinstance(case_raw, dict):
            raise ValueError(f"{context}.cases must contain objects only")
        loaded_case = _load_compiled_test_case(
            case_raw,
            required_names=required_names,
            context=f"{context}.cases[{index}]",
        )
        if loaded_case.id in seen_ids:
            raise ValueError(f"{context}.cases contains duplicate id: {loaded_case.id}")
        seen_ids.add(loaded_case.id)
        loaded_cases.append(loaded_case)
    return tuple(loaded_cases)


def load_hidden_cases_file(path: Path, spec: ProblemSpec) -> tuple[CompiledTestCase, ...]:
    raw = _load_json_dict(path)
    context = path.name
    _reject_unknown_fields(raw, allowed=_HIDDEN_TESTS_KEYS, context=context)
    if raw.get("schema_version") != 1:
        raise ValueError(f"{context}.schema_version must equal 1")
    cases_raw = raw.get("cases")
    return load_compiled_test_cases(cases_raw, spec, context=context)


class ProblemRepository:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self._bundle_cache: dict[str, tuple[tuple[tuple[int, int], tuple[int, int], tuple[int, int]], _ProblemBundle]] = {}
        self.compiler = TestCaseCompiler()

    def get_execution_profile(self, problem_id: str) -> ExecutionProfile:
        return self.get_problem_spec(problem_id).execution_profile

    def get_problem_spec(self, problem_id: str) -> ProblemSpec:
        return self._load_bundle(problem_id).spec

    def get_compiled_public_cases(self, problem_id: str) -> list[CompiledTestCase]:
        return list(self._load_bundle(problem_id).compiled_public_cases)

    def get_hidden_cases(self, problem_id: str) -> list[CompiledTestCase]:
        return list(self._load_bundle(problem_id).hidden_cases)

    def _problem_dir(self, problem_id: str) -> Path:
        return _safe_problem_path(self.root, problem_id)

    def _load_bundle(self, problem_id: str) -> _ProblemBundle:
        problem_dir = self._problem_dir(problem_id)
        problem_path = problem_dir / "problem.json"
        public_path = problem_dir / "public_cases.json"
        hidden_path = problem_dir / "hidden_tests.json"
        for required_path in (problem_path, public_path, hidden_path):
            if not required_path.exists():
                raise FileNotFoundError(f"missing canonical problem file: {required_path.name}")

        signature = _bundle_signature(problem_dir)
        cached = self._bundle_cache.get(problem_id)
        if cached and cached[0] == signature:
            return cached[1]

        spec = load_problem_spec_file(problem_id, problem_path)
        public_cases = load_public_cases_file(public_path, spec, self.compiler)
        compiled_public = tuple(self.compiler.compile_cases(spec, list(public_cases)))
        hidden_cases = load_hidden_cases_file(hidden_path, spec)

        bundle = _ProblemBundle(
            spec=spec,
            compiled_public_cases=compiled_public,
            hidden_cases=hidden_cases,
        )
        self._bundle_cache[problem_id] = (signature, bundle)
        return bundle


class ExecutionPlanFactory:
    def __init__(self, problems: ProblemRepository, compiler: TestCaseCompiler | None = None) -> None:
        self.problems = problems
        self.compiler = compiler or problems.compiler

    def build_run_plan(self, problem_id: str, cases: list[CompiledTestCase]) -> ExecutionPlan:
        spec = self.problems.get_problem_spec(problem_id)
        return ExecutionPlan(
            problem_id=spec.problem_id,
            runner=spec.runner,
            execution_profile=spec.execution_profile,
            comparison=spec.comparison,
            time_limit_s=spec.time_limit_s,
            memory_mb=spec.memory_mb,
            cases=tuple(cases),
            detail_mode="all",
        )

    def build_submit_plan(self, problem_id: str) -> ExecutionPlan:
        spec = self.problems.get_problem_spec(problem_id)
        cases = tuple(
            [
                *self.problems.get_compiled_public_cases(problem_id),
                *self.problems.get_hidden_cases(problem_id),
            ]
        )
        return ExecutionPlan(
            problem_id=spec.problem_id,
            runner=spec.runner,
            execution_profile=spec.execution_profile,
            comparison=spec.comparison,
            time_limit_s=spec.time_limit_s,
            memory_mb=spec.memory_mb,
            cases=cases,
            detail_mode="first_failure",
        )


def inline_assignment_aliases(
    *,
    input_code: str,
    argument_names: list[str],
    allowed_root_names: set[str],
) -> dict[str, str]:
    """Convert top-level assignment code into arg-name -> expression strings.

    This is used by the migration script to normalize legacy public `input_code`
    into structured `TestCase.inputs`.
    """

    tree = ast.parse(input_code, mode="exec")
    assignments: dict[str, ast.expr] = {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            if len(node.targets) != 1:
                raise ValueError("public input_code may only use simple assignments")
            target = node.targets[0]
            if not isinstance(target, ast.Name):
                raise ValueError("public input_code assignments must target simple names")
            assignments[target.id] = node.value
            continue
        if isinstance(node, ast.AnnAssign):
            if not isinstance(node.target, ast.Name) or node.value is None:
                raise ValueError("public input_code annotated assignments must target simple names")
            assignments[node.target.id] = node.value
            continue
        raise ValueError("public input_code may only contain top-level assignments")

    argument_set = set(argument_names)
    cache: dict[str, ast.expr] = {}

    def resolve_expr(expr: ast.expr, *, stack: tuple[str, ...]) -> ast.expr:
        if isinstance(expr, ast.Name):
            name = expr.id
            if name in allowed_root_names:
                return expr
            if name in argument_set:
                raise ValueError(f"argument expression may not depend on argument '{name}'")
            if name not in assignments:
                raise ValueError(f"unknown helper name in public input_code: {name}")
            if name in stack:
                cycle = " -> ".join([*stack, name])
                raise ValueError(f"cyclic helper aliases in public input_code: {cycle}")
            return resolve_name(name, stack=stack)

        cloned = copy.deepcopy(expr)
        for field_name, field_value in ast.iter_fields(cloned):
            if isinstance(field_value, ast.expr):
                setattr(cloned, field_name, resolve_expr(field_value, stack=stack))
                continue
            if isinstance(field_value, list):
                replaced: list[Any] = []
                changed = False
                for item in field_value:
                    if isinstance(item, ast.expr):
                        replaced.append(resolve_expr(item, stack=stack))
                        changed = True
                    else:
                        replaced.append(item)
                if changed:
                    setattr(cloned, field_name, replaced)
        return cloned

    def resolve_name(name: str, *, stack: tuple[str, ...]) -> ast.expr:
        cached = cache.get(name)
        if cached is not None:
            return copy.deepcopy(cached)
        resolved = resolve_expr(assignments[name], stack=(*stack, name))
        cache[name] = resolved
        return copy.deepcopy(resolved)

    resolved_inputs: dict[str, str] = {}
    for argument_name in argument_names:
        if argument_name not in assignments:
            raise ValueError(f"public input_code does not assign argument '{argument_name}'")
        resolved_inputs[argument_name] = ast.unparse(resolve_name(argument_name, stack=()))
    return resolved_inputs
