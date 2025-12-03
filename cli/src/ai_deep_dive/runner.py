"""Test runner for executing challenge tests against user code."""

import json
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ai_deep_dive.manifest import Challenge


@dataclass
class TestResult:
    """Result of running a single test case."""
    id: str
    status: str  # "Accepted", "Wrong Answer", "Runtime Error"
    input_code: str
    stdout: str
    output: str
    expected: str
    stderr: str
    hidden: bool


@dataclass
class TestRunResult:
    """Result of running all tests for a challenge."""
    passed: bool
    total: int
    passed_count: int
    results: list[TestResult]
    error: Optional[str] = None


# The test harness code - executes user code against test cases
HARNESS_CODE = '''
import json
import sys
import io
import traceback
from contextlib import redirect_stdout, redirect_stderr

def run_cases():
    try:
        with open("test_config.json", "r") as f:
            config = json.load(f)
    except FileNotFoundError:
        print(json.dumps([{"id": "error", "status": "Runtime Error", "stderr": "test_config.json not found"}]))
        return

    results = []
    
    try:
        with open("main.py", "r") as f:
            user_code = f.read()
    except FileNotFoundError:
        print(json.dumps([{"id": "error", "status": "Runtime Error", "stderr": "main.py not found"}]))
        return

    runner_expression = config.get("runner", "")

    # Execute user code once to define functions/classes
    exec_globals = {}
    try:
        exec(user_code, exec_globals)
    except Exception:
        error_msg = traceback.format_exc()
        print(json.dumps([{"id": "error", "status": "Runtime Error", "stderr": error_msg}]))
        return

    for case in config.get("cases", []):
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        input_code = case.get("input", "")
        expected_json = case.get("expected", "null")
        is_hidden = case.get("hidden", False)
        
        status = "Accepted"
        output_str = ""
        stdout_val = ""
        stderr_val = ""
        
        try:
            case_globals = exec_globals.copy()
            exec(input_code, case_globals)
            
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                actual_value = eval(runner_expression, case_globals)
            
            stdout_val = stdout_capture.getvalue()
            stderr_val = stderr_capture.getvalue()
            
            try:
                expected_value = json.loads(expected_json)
            except json.JSONDecodeError:
                expected_value = expected_json

            try:
                actual_value_normalized = json.loads(json.dumps(actual_value))
            except TypeError:
                actual_value_normalized = str(actual_value)
            
            if actual_value_normalized != expected_value:
                status = "Wrong Answer"
                output_str = json.dumps(actual_value_normalized)
            else:
                output_str = json.dumps(actual_value_normalized)

        except Exception:
            status = "Runtime Error"
            stderr_val = stderr_capture.getvalue() + "\\n" + traceback.format_exc()
        
        results.append({
            "id": case["id"],
            "status": status,
            "input": input_code,
            "stdout": stdout_val,
            "output": output_str,
            "expected": expected_json,
            "stderr": stderr_val,
            "hidden": is_hidden
        })
        
    print(json.dumps(results))

if __name__ == "__main__":
    run_cases()
'''


def build_test_config(challenge: Challenge) -> dict:
    """Build the test configuration for a challenge."""
    cases = []
    
    for tc in challenge.test_cases:
        # Convert inputs dict to assignment code
        input_code = ""
        for arg_name, arg_value in tc.inputs.items():
            input_code += f"{arg_name} = {arg_value}\n"
        
        cases.append({
            "id": tc.id,
            "input": input_code,
            "expected": tc.expected,
            "hidden": tc.hidden,
        })
    
    # Clean up execution snippet (remove print wrapper if present)
    runner = challenge.execution_snippet.strip()
    if runner.startswith("print(") and runner.endswith(")"):
        runner = runner[6:-1]
    
    return {
        "cases": cases,
        "runner": runner,
    }


def run_tests(
    challenge: Challenge,
    user_code_path: Path,
    python_executable: Optional[str] = None,
) -> TestRunResult:
    """
    Run tests for a challenge against user code.
    
    Args:
        challenge: The challenge definition with test cases
        user_code_path: Path to the user's solution file
        python_executable: Python executable to use (defaults to sys.executable)
    
    Returns:
        TestRunResult with all test results
    """
    if python_executable is None:
        python_executable = sys.executable
    
    # Read user code
    try:
        user_code = user_code_path.read_text()
    except Exception as e:
        return TestRunResult(
            passed=False,
            total=len(challenge.test_cases),
            passed_count=0,
            results=[],
            error=f"Failed to read user code: {e}",
        )
    
    # Create temporary directory for test execution
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        
        # Write files
        (tmpdir_path / "main.py").write_text(user_code)
        (tmpdir_path / "harness.py").write_text(HARNESS_CODE)
        
        config = build_test_config(challenge)
        (tmpdir_path / "test_config.json").write_text(json.dumps(config))
        
        # Run the harness
        try:
            result = subprocess.run(
                [python_executable, "harness.py"],
                cwd=tmpdir_path,
                capture_output=True,
                text=True,
                timeout=30,  # 30 second timeout
            )
        except subprocess.TimeoutExpired:
            return TestRunResult(
                passed=False,
                total=len(challenge.test_cases),
                passed_count=0,
                results=[],
                error="Test execution timed out (30s limit)",
            )
        except Exception as e:
            return TestRunResult(
                passed=False,
                total=len(challenge.test_cases),
                passed_count=0,
                results=[],
                error=f"Failed to run tests: {e}",
            )
        
        # Parse results
        stdout = result.stdout.strip()
        stderr = result.stderr.strip()
        
        # Find the JSON output (last line)
        lines = stdout.split("\n")
        json_line = lines[-1] if lines else ""
        
        try:
            raw_results = json.loads(json_line)
        except json.JSONDecodeError:
            return TestRunResult(
                passed=False,
                total=len(challenge.test_cases),
                passed_count=0,
                results=[],
                error=f"Failed to parse test results.\nStdout: {stdout}\nStderr: {stderr}",
            )
        
        # Check for top-level error
        if len(raw_results) == 1 and raw_results[0].get("id") == "error":
            return TestRunResult(
                passed=False,
                total=len(challenge.test_cases),
                passed_count=0,
                results=[],
                error=raw_results[0].get("stderr", "Unknown error"),
            )
        
        # Convert to TestResult objects
        results = []
        passed_count = 0
        
        for r in raw_results:
            test_result = TestResult(
                id=r.get("id", ""),
                status=r.get("status", "Unknown"),
                input_code=r.get("input", ""),
                stdout=r.get("stdout", ""),
                output=r.get("output", ""),
                expected=r.get("expected", ""),
                stderr=r.get("stderr", ""),
                hidden=r.get("hidden", False),
            )
            results.append(test_result)
            
            if test_result.status == "Accepted":
                passed_count += 1
        
        return TestRunResult(
            passed=passed_count == len(results),
            total=len(results),
            passed_count=passed_count,
            results=results,
        )
