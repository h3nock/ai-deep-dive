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

    runner_code = config.get("runner", "")

    for case in config.get("cases", []):
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        input_code = case.get("input", "")
        expected = case.get("expected", "").strip()
        
        # Combine: User Code -> Input Variables -> Runner Call
        # We wrap in a try-except block within the exec to catch runtime errors per case
        full_script = f"{user_code}\\n{input_code}\\n{runner_code}"
        
        status = "Accepted"
        output = ""
        stdout_val = ""
        stderr_val = ""
        
        try:
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                # We use a fresh dictionary for each run to avoid state pollution
                exec_globals = {}
                exec(full_script, exec_globals)
            
            stdout_val = stdout_capture.getvalue()
            stderr_val = stderr_capture.getvalue()
            
            # Heuristic: The last non-empty line of stdout is the "result"
            # This relies on the runner_code printing the result
            lines = [line for line in stdout_val.strip().split('\\n') if line.strip()]
            output = lines[-1] if lines else ""
            
            if expected and output != expected:
                status = "Wrong Answer"
                
        except Exception:
            status = "Runtime Error"
            stderr_val = stderr_capture.getvalue() + "\\n" + traceback.format_exc()
        
        results.append({
            "id": case["id"],
            "status": status,
            "input": input_code,
            "stdout": stdout_val,
            "output": output,
            "expected": expected,
            "stderr": stderr_val
        })
        
    print(json.dumps(results))

if __name__ == "__main__":
    run_cases()
`;
