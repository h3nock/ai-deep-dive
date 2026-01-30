"""Local runner for executing tests against user code."""

import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from judge.problems import Problem, TestCase


HARNESS_CODE = '''
import json
import io
import math
import ast
import traceback
import sys
from contextlib import redirect_stdout, redirect_stderr

def normalize(value):
    if hasattr(value, "tolist"):
        try:
            return value.tolist()
        except Exception:
            return str(value)
    return value


def allclose(a, b, rtol, atol):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=rtol, abs_tol=atol)
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        if len(a) != len(b):
            return False
        return all(allclose(x, y, rtol, atol) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return False
        return all(allclose(a[k], b[k], rtol, atol) for k in a.keys())
    return a == b


def compare(actual, expected, comparison):
    cmp_type = comparison.get("type", "exact")
    rtol = float(comparison.get("rtol", 1e-5))
    atol = float(comparison.get("atol", 1e-8))
    if cmp_type == "allclose":
        return allclose(actual, expected, rtol, atol)
    return actual == expected


def _is_user_frame(frame):
    return frame.filename in ("solution.py", "testcase.py")


def format_user_error():
    exc_type, exc_value, exc_tb = sys.exc_info()
    if isinstance(exc_value, SyntaxError):
        lineno = exc_value.lineno or 0
        text = exc_value.text or ""
        lines = []
        if lineno:
            lines.append(f"Line {lineno}:")
        if text:
            lines.append(f"    {text.rstrip()}")
        msg = exc_value.msg if hasattr(exc_value, "msg") else str(exc_value)
        lines.append(f"{exc_type.__name__}: {msg}")
        return "\\n".join(lines)

    frames = traceback.extract_tb(exc_tb)
    user_frames = [frame for frame in frames if _is_user_frame(frame)]
    if not user_frames:
        last = frames[-1] if frames else None
        if last:
            line = last.line or ""
            if line:
                return f"Line {last.lineno}:\\n    {line}\\n{exc_type.__name__}: {exc_value}"
            return f"Line {last.lineno}:\\n{exc_type.__name__}: {exc_value}"
        return f"{exc_type.__name__}: {exc_value}"

    lines = []
    for frame in user_frames:
        if frame.name == "<module>":
            lines.append(f"Line {frame.lineno}:")
        else:
            lines.append(f"Line {frame.lineno}, in {frame.name}:")
        if frame.line:
            lines.append(f"    {frame.line}")
    lines.append(f"{exc_type.__name__}: {exc_value}")
    return "\\n".join(lines)


def run_cases():
    try:
        with open("test_config.json", "r") as f:
            config = json.load(f)
    except FileNotFoundError:
        print(json.dumps([{"id": "error", "status": "Runtime Error", "stderr": "test_config.json not found"}]))
        return

    try:
        with open("main.py", "r") as f:
            user_code = f.read()
    except FileNotFoundError:
        print(json.dumps([{"id": "error", "status": "Runtime Error", "stderr": "main.py not found"}]))
        return

    runner_expression = config.get("runner", "")
    comparison_default = config.get("comparison", {"type": "exact"})

    exec_globals = {}
    try:
        compiled = compile(user_code, "solution.py", "exec")
        exec(compiled, exec_globals)
    except Exception:
        error_msg = format_user_error()
        print(json.dumps([{"id": "error", "status": "Runtime Error", "stderr": error_msg}]))
        return

    results = []
    for case in config.get("cases", []):
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        input_code = case.get("input_code", "")
        expected = case.get("expected")
        expected_is_code = case.get("expected_is_code", False)
        is_hidden = case.get("hidden", False)
        comparison = case.get("comparison") or comparison_default

        status = "Accepted"
        output_str = ""
        stdout_val = ""
        stderr_val = ""

        try:
            case_globals = exec_globals.copy()
            compiled_input = compile(input_code, "testcase.py", "exec")
            exec(compiled_input, case_globals)

            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                actual_value = eval(runner_expression, case_globals)

            stdout_val = stdout_capture.getvalue()
            stderr_val = stderr_capture.getvalue()

            actual_value = normalize(actual_value)

            if expected_is_code and isinstance(expected, str):
                try:
                    expected = ast.literal_eval(expected)
                except Exception:
                    pass

            if not compare(actual_value, expected, comparison):
                status = "Wrong Answer"
            output_str = repr(actual_value)
        except Exception:
            status = "Runtime Error"
            stderr_val = stderr_capture.getvalue()
            error_msg = format_user_error()
            if stderr_val:
                stderr_val = stderr_val + "\\n" + error_msg
            else:
                stderr_val = error_msg

        results.append({
            "id": case.get("id", ""),
            "status": status,
            "input": input_code,
            "stdout": stdout_val,
            "output": output_str,
            "expected": repr(expected),
            "stderr": stderr_val,
            "hidden": is_hidden,
        })

    print(json.dumps(results))

if __name__ == "__main__":
    run_cases()
'''


def _serialize_expected(value: Any) -> tuple[Any, bool]:
    try:
        json.dumps(value)
        return value, False
    except (TypeError, ValueError):
        return repr(value), True


def _build_test_config(problem: Problem, include_hidden: bool) -> dict[str, Any]:
    cases: list[dict[str, Any]] = []
    tests = problem.public_tests + (problem.hidden_tests if include_hidden else [])
    for case in tests:
        comparison = case.comparison or problem.comparison
        expected, expected_is_code = _serialize_expected(case.expected)
        cases.append(
            {
                "id": case.id,
                "input_code": case.input_code,
                "expected": expected,
                "expected_is_code": expected_is_code,
                "hidden": case.hidden,
                "comparison": {
                    "type": comparison.type,
                    "rtol": comparison.rtol,
                    "atol": comparison.atol,
                },
            }
        )
    return {
        "runner": problem.runner,
        "comparison": {
            "type": problem.comparison.type,
            "rtol": problem.comparison.rtol,
            "atol": problem.comparison.atol,
        },
        "cases": cases,
    }


def _truncate(value: str, max_chars: int) -> str:
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 3] + "..."


def _sanitize_results(results: list[dict[str, Any]], max_output_chars: int) -> list[dict[str, Any]]:
    sanitized = []
    for item in results:
        hidden = bool(item.get("hidden", False))
        if hidden:
            sanitized.append(
                {
                    "id": item.get("id", ""),
                    "status": item.get("status", ""),
                    "hidden": True,
                }
            )
            continue
        sanitized.append(
            {
                "id": item.get("id", ""),
                "status": item.get("status", ""),
                "hidden": False,
                "input": item.get("input", ""),
                "stdout": _truncate(item.get("stdout", ""), max_output_chars),
                "output": _truncate(item.get("output", ""), max_output_chars),
                "expected": _truncate(item.get("expected", ""), max_output_chars),
                "stderr": _truncate(item.get("stderr", ""), max_output_chars),
            }
        )
    return sanitized


def run_problem(
    problem: Problem,
    user_code: str,
    max_output_chars: int,
    include_hidden: bool = True,
    sandbox_cmd: list[str] | None = None,
) -> dict[str, Any]:
    config = _build_test_config(problem, include_hidden)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        (tmpdir_path / "main.py").write_text(user_code)
        (tmpdir_path / "harness.py").write_text(HARNESS_CODE)
        (tmpdir_path / "test_config.json").write_text(json.dumps(config))

        command = [sys.executable, "-I", "harness.py"]
        if sandbox_cmd:
            command = sandbox_cmd + command

        try:
            result = subprocess.run(
                command,
                cwd=tmpdir_path,
                capture_output=True,
                text=True,
                timeout=problem.time_limit_s,
            )
        except subprocess.TimeoutExpired:
            return {
                "passed": False,
                "summary": {"total": len(config["cases"]), "passed": 0},
                "tests": [],
                "error": f"Time Limit Exceeded ({problem.time_limit_s}s)",
            }

    if result.returncode != 0:
        return {
            "passed": False,
            "summary": {"total": len(config["cases"]), "passed": 0},
            "tests": [],
            "error": result.stderr.strip() or "Runner failed",
        }

    try:
        tests_raw = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {
            "passed": False,
            "summary": {"total": len(config["cases"]), "passed": 0},
            "tests": [],
            "error": f"Invalid runner output. Stdout: {result.stdout}\nStderr: {result.stderr}",
        }

    tests = _sanitize_results(tests_raw, max_output_chars)
    passed_count = sum(1 for t in tests if t.get("status") == "Accepted")

    return {
        "passed": passed_count == len(tests),
        "summary": {"total": len(tests), "passed": passed_count},
        "tests": tests,
        "error": None,
    }
