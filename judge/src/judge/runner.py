"""Local runner for executing tests against user code."""

import hashlib
import json
import math
import os
import py_compile
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from judge.problems import Problem

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
    config = globals().get("__judge_test_config__")
    if config is None:
        try:
            with open("test_config.json", "r") as f:
                config = json.load(f)
        except FileNotFoundError:
            print(json.dumps([{"id": "error", "status": "Runtime Error", "stderr": "test_config.json not found"}]))
            return

    user_code = globals().get("__judge_user_code__")
    if user_code is None:
        try:
            with open("main.py", "r") as f:
                user_code = f.read()
        except FileNotFoundError:
            print(json.dumps([{"id": "error", "status": "Runtime Error", "stderr": "main.py not found"}]))
            return

    runner_expression = config.get("runner", "")
    comparison_default = config.get("comparison", {"type": "exact"})

    _torch_module = None
    if config.get("requires_torch", False):
        import torch as _torch_module

    try:
        compiled_runner = compile(runner_expression, "runner.py", "eval")
    except Exception as exc:
        print(json.dumps([{
            "id": "error",
            "status": "Runtime Error",
            "stderr": f"Invalid runner expression: {exc}",
        }]))
        return

    try:
        compiled_solution = compile(user_code, "solution.py", "exec")
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
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                # Re-exec user code per case to avoid mutable global state leaking between cases.
                # Set explicit module metadata expected by typical Python submissions.
                case_globals = {
                    "__builtins__": __builtins__,
                    "__name__": "solution",
                    "__file__": "solution.py",
                    "__package__": None,
                }
                if _torch_module is not None:
                    case_globals["torch"] = _torch_module
                exec(compiled_solution, case_globals)
                compiled_input = compile(input_code, "testcase.py", "exec")
                exec(compiled_input, case_globals)
                actual_value = eval(compiled_runner, case_globals)

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
            stdout_val = stdout_capture.getvalue()
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
_HARNESS_DIGEST = hashlib.sha256(HARNESS_CODE.encode("utf-8")).hexdigest()[:12]
_RUNTIME_DIR = Path(tempfile.gettempdir()) / "judge-runtime"
_HARNESS_HOST_PATH = _RUNTIME_DIR / f"harness-{_HARNESS_DIGEST}.py"
_HARNESS_BYTECODE_PATH = _RUNTIME_DIR / f"harness-{_HARNESS_DIGEST}.pyc"
_THREAD_ENV_DEFAULTS = {
    "OMP_NUM_THREADS": "1",
    "MKL_NUM_THREADS": "1",
    "OPENBLAS_NUM_THREADS": "1",
    "NUMEXPR_NUM_THREADS": "1",
    "VECLIB_MAXIMUM_THREADS": "1",
    "PYTORCH_NUM_THREADS": "1",
}
_OPTIONAL_SANDBOX_ENV_VARS = (
    "PYTORCH_JIT",
    "CUDA_VISIBLE_DEVICES",
)


@dataclass(frozen=True)
class IsolateConfig:
    executable: str
    box_id: int
    use_cgroups: bool = True
    process_limit: int = 64
    wall_time_extra_s: int = 2
    timeout_grace_s: int = 5
    fsize_kb: int = 1024
    python_bin: str = sys.executable


def _serialize_expected(value: Any) -> tuple[Any, bool]:
    # Keep JSON values as-is only when a JSON roundtrip preserves Python types.
    # Otherwise send a Python literal and parse it in the harness.
    if _json_roundtrip_preserves_types(value):
        return value, False
    return repr(value), True


def _json_roundtrip_preserves_types(value: Any) -> bool:
    try:
        decoded = json.loads(json.dumps(value))
    except (TypeError, ValueError):
        return False
    return _structural_equal(value, decoded)


def _structural_equal(left: Any, right: Any) -> bool:
    if isinstance(left, float) and isinstance(right, float):
        if math.isnan(left) and math.isnan(right):
            return True
        return left == right

    if type(left) is not type(right):
        return False

    if isinstance(left, list):
        if len(left) != len(right):
            return False
        return all(_structural_equal(a, b) for a, b in zip(left, right))

    if isinstance(left, dict):
        if len(left) != len(right):
            return False
        for key, left_value in left.items():
            if key not in right:
                return False
            if not _structural_equal(left_value, right[key]):
                return False
        return True

    return left == right


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
        "requires_torch": problem.requires_torch,
        "cases": cases,
    }


def _truncate(value: str, max_chars: int) -> str:
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 3] + "..."


def _sanitize_item(item: dict[str, Any], max_output_chars: int) -> dict[str, Any]:
    return {
        "id": item.get("id", ""),
        "status": item.get("status", ""),
        "hidden": bool(item.get("hidden", False)),
        "input": item.get("input", ""),
        "stdout": _truncate(item.get("stdout", ""), max_output_chars),
        "output": _truncate(item.get("output", ""), max_output_chars),
        "expected": _truncate(item.get("expected", ""), max_output_chars),
        "stderr": _truncate(item.get("stderr", ""), max_output_chars),
    }


def _summarize_results(
    results: list[dict[str, Any]],
) -> tuple[dict[str, int], dict[str, Any] | None]:
    total = 0
    passed = 0
    hidden_total = 0
    hidden_passed = 0
    first_failed: dict[str, Any] | None = None

    for item in results:
        total += 1
        status = item.get("status", "")
        hidden = bool(item.get("hidden", False))

        if hidden:
            hidden_total += 1

        if status == "Accepted":
            passed += 1
            if hidden:
                hidden_passed += 1
        elif first_failed is None:
            first_failed = item

    failed = total - passed
    public_total = total - hidden_total
    public_passed = passed - hidden_passed

    summary = {
        "total": total,
        "passed": passed,
        "failed": failed,
        "public_total": public_total,
        "public_passed": public_passed,
        "hidden_total": hidden_total,
        "hidden_passed": hidden_passed,
    }

    return summary, first_failed


def _build_error_summary(problem: Problem, include_hidden: bool, total_cases: int) -> dict[str, int]:
    return {
        "total": total_cases,
        "passed": 0,
        "failed": total_cases,
        "public_total": total_cases if not include_hidden else len(problem.public_tests),
        "public_passed": 0,
        "hidden_total": 0 if not include_hidden else len(problem.hidden_tests),
        "hidden_passed": 0,
    }


def _isolate_base_cmd(isolate: IsolateConfig) -> list[str]:
    cmd = [isolate.executable]
    if isolate.use_cgroups:
        cmd.append("--cg")
    cmd.append(f"--box-id={isolate.box_id}")
    return cmd


def _resolve_python_for_isolate(isolate: IsolateConfig) -> tuple[str, list[str]]:
    python_bin = Path(isolate.python_bin)
    if not python_bin.is_absolute():
        return isolate.python_bin, []

    venv_root = python_bin.parent.parent
    pyvenv_cfg = venv_root / "pyvenv.cfg"
    if python_bin.parent.name == "bin" and pyvenv_cfg.exists():
        return f"/venv/bin/{python_bin.name}", [f"--dir=/venv={venv_root}"]

    return str(python_bin), []


def _cleanup_isolate_box(isolate: IsolateConfig) -> None:
    cleanup_cmd = _isolate_base_cmd(isolate) + ["--cleanup"]
    subprocess.run(cleanup_cmd, capture_output=True, text=True, check=False)


def _init_isolate_box(isolate: IsolateConfig) -> Path:
    init_cmd = _isolate_base_cmd(isolate) + ["--init"]
    for _ in range(2):
        init = subprocess.run(init_cmd, capture_output=True, text=True, check=False)
        if init.returncode == 0:
            raw = init.stdout.strip().splitlines()
            if raw:
                value = raw[-1].strip()
                if value.isdigit():
                    return Path(f"/var/local/lib/isolate/{isolate.box_id}/box")
                path = Path(value)
                return path if path.name == "box" else path / "box"
            return Path(f"/var/local/lib/isolate/{isolate.box_id}/box")
        _cleanup_isolate_box(isolate)
    raise RuntimeError(f"isolate init failed for box {isolate.box_id}: {init.stderr.strip()}")


def _parse_isolate_meta(meta_path: Path) -> dict[str, str]:
    if not meta_path.exists():
        return {}

    parsed: dict[str, str] = {}
    for line in meta_path.read_text().splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        parsed[key.strip()] = value.strip()
    return parsed


def _ensure_harness_file() -> Path:
    if _HARNESS_HOST_PATH.exists():
        return _HARNESS_HOST_PATH

    _RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = _HARNESS_HOST_PATH.with_suffix(".tmp")
    temp_path.write_text(HARNESS_CODE)
    temp_path.replace(_HARNESS_HOST_PATH)
    return _HARNESS_HOST_PATH


def _harness_entrypoint() -> str:
    harness_source = _ensure_harness_file()
    if not _HARNESS_BYTECODE_PATH.exists():
        try:
            py_compile.compile(
                str(harness_source),
                cfile=str(_HARNESS_BYTECODE_PATH),
                doraise=True,
            )
        except (py_compile.PyCompileError, OSError):
            return f"/runtime/{harness_source.name}"
    return f"/runtime/{_HARNESS_BYTECODE_PATH.name}"


def _isolate_meta_path(box_id: int) -> Path:
    return _RUNTIME_DIR / f"isolate-meta-{box_id}.txt"


def _isolate_env_flags() -> list[str]:
    flags: list[str] = []
    for name, default in _THREAD_ENV_DEFAULTS.items():
        value = os.getenv(name, default)
        flags.append(f"--env={name}={value}")
    for name in _OPTIONAL_SANDBOX_ENV_VARS:
        if name in os.environ:
            flags.append(f"--env={name}={os.environ[name]}")
    return flags


def _run_in_isolate(
    problem: Problem,
    user_code: str,
    config: dict[str, Any],
    isolate: IsolateConfig,
) -> tuple[int, str, str, dict[str, str]]:
    box_path = _init_isolate_box(isolate)
    meta_path = _isolate_meta_path(isolate.box_id)
    harness_entrypoint = _harness_entrypoint()
    try:
        _RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
        if meta_path.exists():
            meta_path.unlink()
        (box_path / "main.py").write_text(user_code)
        (box_path / "test_config.json").write_text(json.dumps(config))

        wall_time = max(problem.time_limit_s + isolate.wall_time_extra_s, problem.time_limit_s + 1)
        python_bin, dir_mounts = _resolve_python_for_isolate(isolate)
        run_cmd = _isolate_base_cmd(isolate) + [
            f"--time={problem.time_limit_s}",
            f"--wall-time={wall_time}",
            f"--mem={max(problem.memory_mb, 1) * 1024}",
            f"--fsize={max(isolate.fsize_kb, 1)}",
            f"--processes={max(isolate.process_limit, 1)}",
            f"--meta={meta_path}",
            "--stdout=stdout.txt",
            "--stderr=stderr.txt",
            f"--dir=/runtime={_RUNTIME_DIR}",
        ]
        if isolate.use_cgroups:
            run_cmd.append(f"--cg-mem={max(problem.memory_mb, 1) * 1024}")
        run_cmd.extend(dir_mounts)
        run_cmd.extend(_isolate_env_flags())
        run_cmd.extend(
            [
                "--run",
                "--",
                python_bin,
                "-I",
                harness_entrypoint,
            ]
        )
        result = subprocess.run(
            run_cmd,
            cwd=box_path,
            capture_output=True,
            text=True,
            timeout=wall_time + isolate.timeout_grace_s,
            check=False,
        )

        stdout_path = box_path / "stdout.txt"
        stderr_path = box_path / "stderr.txt"
        stdout = stdout_path.read_text() if stdout_path.exists() else result.stdout
        stderr = stderr_path.read_text() if stderr_path.exists() else result.stderr
        isolate_meta = _parse_isolate_meta(meta_path)
        return result.returncode, stdout, stderr, isolate_meta
    finally:
        _cleanup_isolate_box(isolate)


def _isolate_failed_with_tle(meta: dict[str, str]) -> bool:
    return meta.get("status") == "TO"


def _isolate_failed_with_mle(meta: dict[str, str]) -> bool:
    return meta.get("cg-oom-killed") not in {None, "", "0"}


def _isolate_failed_with_internal_error(meta: dict[str, str]) -> bool:
    # Isolate uses XX for sandbox/runtime infrastructure failures.
    status = meta.get("status")
    return status == "XX" or status is None


def run_problem(
    problem: Problem,
    user_code: str,
    max_output_chars: int,
    include_hidden: bool = True,
    detail_mode: str = "all",
    isolate: IsolateConfig | None = None,
) -> dict[str, Any]:
    if isolate is None:
        raise ValueError("isolate configuration is required")

    config = _build_test_config(problem, include_hidden)
    total_cases = len(config["cases"])

    try:
        returncode, stdout, stderr, isolate_meta = _run_in_isolate(problem, user_code, config, isolate)
    except subprocess.TimeoutExpired:
        return {
            "status": "Time Limit Exceeded",
            "summary": _build_error_summary(problem, include_hidden, total_cases),
            "tests": [],
            "error": f"Time Limit Exceeded ({problem.time_limit_s}s)",
            "error_kind": "user",
        }
    except Exception as exc:
        return {
            "status": "Runtime Error",
            "summary": _build_error_summary(problem, include_hidden, total_cases),
            "tests": [],
            "error": f"Runner failed: {exc}",
            "error_kind": "internal",
        }

    if returncode != 0:
        if _isolate_failed_with_tle(isolate_meta):
            return {
                "status": "Time Limit Exceeded",
                "summary": _build_error_summary(problem, include_hidden, total_cases),
                "tests": [],
                "error": f"Time Limit Exceeded ({problem.time_limit_s}s)",
                "error_kind": "user",
            }
        if _isolate_failed_with_mle(isolate_meta):
            return {
                "status": "Memory Limit Exceeded",
                "summary": _build_error_summary(problem, include_hidden, total_cases),
                "tests": [],
                "error": f"Memory Limit Exceeded ({problem.memory_mb}MB)",
                "error_kind": "user",
            }
        return {
            "status": "Runtime Error",
            "summary": _build_error_summary(problem, include_hidden, total_cases),
            "tests": [],
            "error": stderr.strip() or "Runner failed",
            "error_kind": "internal" if _isolate_failed_with_internal_error(isolate_meta) else "user",
        }

    try:
        tests_raw = json.loads(stdout)
    except json.JSONDecodeError:
        return {
            "status": "Runtime Error",
            "summary": _build_error_summary(problem, include_hidden, total_cases),
            "tests": [],
            "error": f"Invalid runner output. Stdout: {stdout}\nStderr: {stderr}",
            "error_kind": "internal",
        }

    summary, first_failed = _summarize_results(tests_raw)
    status = "Accepted"
    if summary["failed"] > 0 and first_failed is not None:
        status = first_failed.get("status", "Wrong Answer")

    if detail_mode == "first_failure":
        tests = (
            [_sanitize_item(first_failed, max_output_chars)]
            if first_failed is not None
            else []
        )
    else:
        tests = [_sanitize_item(item, max_output_chars) for item in tests_raw]

    return {
        "status": status,
        "summary": summary,
        "tests": tests,
        "error": None,
    }
