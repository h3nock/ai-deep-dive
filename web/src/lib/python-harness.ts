export const PYTHON_HARNESS = `
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
        # If user code fails to compile/run at top level, all tests fail
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
            # 1. Setup Input Variables
            # We use a copy of globals to avoid pollution between cases, 
            # but we keep the user's defined functions
            case_globals = exec_globals.copy()
            exec(input_code, case_globals)
            
            # 2. Run the Runner Expression and Capture Return Value
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                # eval() returns the value of the expression
                actual_value = eval(runner_expression, case_globals)
            
            stdout_val = stdout_capture.getvalue()
            stderr_val = stderr_capture.getvalue()
            
            # 3. Compare with Expected
            # We try to parse expected as JSON. If it fails, we treat it as a string.
            try:
                expected_value = json.loads(expected_json)
            except json.JSONDecodeError:
                expected_value = expected_json # Fallback to string comparison if not valid JSON

            # Convert actual value to JSON-compatible structure for comparison
            # This handles tuples -> lists, etc.
            # We use json.loads(json.dumps()) to normalize
            try:
                actual_value_normalized = json.loads(json.dumps(actual_value))
            except TypeError:
                 # If not serializable, compare as string representation
                 actual_value_normalized = str(actual_value)
                 # Also try to normalize expected if it was parsed as JSON but actual is string?
                 # For now, simplistic comparison
            
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
`;
