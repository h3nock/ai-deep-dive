// Pyodide browser-based Python execution
// Used for simple challenges (chapters 1-3) that don't require external dependencies

type PyodideInterface = {
  runPython: (code: string) => any;
  runPythonAsync: (code: string) => Promise<any>;
  loadPackage: (name: string | string[]) => Promise<void>;
  globals: any;
  setStdout: (options: { batched: (text: string) => void }) => void;
  setStderr: (options: { batched: (text: string) => void }) => void;
};

let pyodideInstance: PyodideInterface | null = null;
let loadPromise: Promise<PyodideInterface> | null = null;

// Execution limit to prevent infinite loops (number of Python operations)
const EXECUTION_LIMIT = 1_000_000;

// Load Pyodide from CDN
export async function loadPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      // Dynamically load Pyodide script if not already loaded
      if (typeof window !== "undefined" && !(window as any).loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://cdn.jsdelivr.net/pyodide/v0.27.6/full/pyodide.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Pyodide"));
          document.head.appendChild(script);
        });
      }

      // Initialize Pyodide
      const pyodide = await (window as any).loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.6/full/",
      });

      pyodideInstance = pyodide;
      return pyodide;
    } catch (error) {
      // Reset loadPromise on failure so retry works
      loadPromise = null;
      throw error;
    }
  })();

  return loadPromise;
}

// Check if Pyodide is loaded
export function isPyodideLoaded(): boolean {
  return pyodideInstance !== null;
}

// Test result interface matching the existing test harness
export interface TestResult {
  id: string;
  status: "Accepted" | "Wrong Answer" | "Runtime Error";
  input: string;
  stdout: string;
  output: string;
  expected: string;
  stderr?: string;
  hidden?: boolean;
}

export interface TestCase {
  id: string;
  input: string; // Python code to set up input variables
  expected: string;
  hidden?: boolean;
}

export interface TestConfig {
  cases: TestCase[];
  runner: string; // Expression to evaluate
}

// Run tests using Pyodide (browser-based Python execution)
export async function runTestsWithPyodide(
  userCode: string,
  config: TestConfig,
  onStdout?: (text: string) => void,
  onStderr?: (text: string) => void
): Promise<TestResult[]> {
  const pyodide = await loadPyodide();

  const results: TestResult[] = [];

  // Capture stdout/stderr
  let currentStdout = "";
  let currentStderr = "";

  // Note: Pyodide's batched handler strips newlines from complete lines
  // We add them back to preserve print() formatting
  pyodide.setStdout({
    batched: (text: string) => {
      const textWithNewline = text + "\n";
      currentStdout += textWithNewline;
      onStdout?.(textWithNewline);
    },
  });

  pyodide.setStderr({
    batched: (text: string) => {
      const textWithNewline = text + "\n";
      currentStderr += textWithNewline;
      onStderr?.(textWithNewline);
    },
  });

  // First, try to execute user code to define functions/classes
  // We wrap this in a fresh namespace that persists across test cases
  // Error handling is done in Python for clean, user-friendly messages
  const setupCode = `
import traceback as __tb__
import sys as __sys__

class __ExecutionLimitExceeded__(Exception):
    """Raised when code exceeds the execution limit."""
    pass

# Operation counter for timeout detection
__op_count__ = 0
__op_limit__ = ${EXECUTION_LIMIT}

def __trace_calls__(frame, event, arg):
    """Trace function that counts operations and raises on limit."""
    global __op_count__
    __op_count__ += 1
    if __op_count__ > __op_limit__:
        raise __ExecutionLimitExceeded__("Execution limit exceeded (possible infinite loop)")
    return __trace_calls__

def __reset_op_count__():
    global __op_count__
    __op_count__ = 0

def __format_user_error__(user_filename='solution.py'):
    """Format exception showing only frames from the user's code file."""
    exc_type, exc_value, exc_tb = __sys__.exc_info()

    # Handle execution limit exceeded with a clean message
    if exc_type is __ExecutionLimitExceeded__:
        return 'ExecutionLimitExceeded: Code took too long to run (possible infinite loop)'

    # SyntaxError has file/line info in the exception itself, not in traceback
    if isinstance(exc_value, SyntaxError) and exc_value.filename == user_filename:
        lines = [f'Line {exc_value.lineno}:']
        if exc_value.text:
            lines.append(f'    {exc_value.text.rstrip()}')
        lines.append(f'{exc_type.__name__}: {exc_value.msg}')
        return '\\n'.join(lines)

    # Runtime errors: filter traceback to only show user's code
    frames = __tb__.extract_tb(exc_tb)
    user_frames = [f for f in frames if f.filename == user_filename]

    lines = []
    for frame in user_frames:
        if frame.name == '<module>':
            lines.append(f'Line {frame.lineno}:')
        else:
            lines.append(f'Line {frame.lineno}, in {frame.name}:')
        if frame.line:
            lines.append(f'    {frame.line}')
    lines.append(f'{exc_type.__name__}: {exc_value}')
    return '\\n'.join(lines)

__user_globals__ = {}
__user_error__ = None
try:
    __user_code__ = compile(${JSON.stringify(userCode)}, 'solution.py', 'exec')
    __reset_op_count__()
    __sys__.settrace(__trace_calls__)
    try:
        exec(__user_code__, __user_globals__)
    finally:
        __sys__.settrace(None)
except Exception:
    __sys__.settrace(None)
    __user_error__ = __format_user_error__()
`;

  await pyodide.runPythonAsync(setupCode);

  // Check if user code had an error
  const userError = await pyodide.runPythonAsync("__user_error__");
  if (userError) {
    return [
      {
        id: "error",
        status: "Runtime Error",
        input: "",
        stdout: currentStdout,
        output: "",
        expected: "",
        stderr: userError,
      },
    ];
  }

  // Run each test case
  for (const testCase of config.cases) {
    currentStdout = "";
    currentStderr = "";

    let status: TestResult["status"] = "Accepted";
    let output = "";
    let stderr = "";

    // Create a fresh case-specific namespace that inherits user functions
    // This prevents variable pollution between test cases
    // Error handling is done in Python for clean, user-friendly messages
    const testCode = `
import json as __json__
import copy as __copy__
__case_globals__ = __copy__.deepcopy(__user_globals__)
__test_error__ = None
__result_json__ = None

# Custom serializer for Python objects
def __serialize__(obj):
    if isinstance(obj, dict):
        # Handle tuple keys by converting to string representation
        return {(str(k) if isinstance(k, tuple) else k): __serialize__(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [__serialize__(item) for item in obj]
    elif isinstance(obj, set):
        return sorted([__serialize__(item) for item in obj])
    else:
        return obj

try:
    # Compile test setup with different filename so it's filtered out of tracebacks
    __test_setup__ = compile(${JSON.stringify(testCase.input)}, '<test>', 'exec')
    __reset_op_count__()
    __sys__.settrace(__trace_calls__)
    try:
        exec(__test_setup__, __case_globals__)
        __result__ = eval(${JSON.stringify(config.runner)}, __case_globals__)
    finally:
        __sys__.settrace(None)
    __result_json__ = __json__.dumps(__serialize__(__result__))
except Exception:
    __sys__.settrace(None)
    __test_error__ = __format_user_error__()
`;

    await pyodide.runPythonAsync(testCode);

    // Check for test error
    const testError = await pyodide.runPythonAsync("__test_error__");
    if (testError) {
      status = "Runtime Error";
      stderr = testError;
    } else {
      // Get the JSON result directly from Python
      const resultJson = await pyodide.runPythonAsync("__result_json__");
      output = resultJson;

      // Parse and compare
      const actualValue = JSON.parse(output);
      let expectedValue: any;
      try {
        expectedValue = JSON.parse(testCase.expected);
      } catch {
        expectedValue = testCase.expected;
      }

      // Normalize expected for comparison (handle Python dict string representation)
      const normalizedExpected = normalizeExpected(
        expectedValue,
        testCase.expected
      );

      if (JSON.stringify(actualValue) !== JSON.stringify(normalizedExpected)) {
        status = "Wrong Answer";
      }
    }

    results.push({
      id: testCase.id,
      status,
      input: testCase.input,
      stdout: currentStdout,
      output,
      expected: testCase.expected,
      stderr: stderr || currentStderr,
      hidden: testCase.hidden,
    });
  }

  return results;
}

// Normalize expected values - handles Python dict string representation
function normalizeExpected(value: any, rawExpected: string): any {
  // If the raw expected looks like a Python dict with tuple keys, parse it specially
  if (
    typeof rawExpected === "string" &&
    rawExpected.includes("(") &&
    rawExpected.includes("):")
  ) {
    try {
      // Convert Python tuple key syntax to string keys for comparison
      // e.g., {(1, 2): 3} -> {"(1, 2)": 3}
      const normalized = rawExpected
        .replace(
          /\((\d+(?:,\s*\d+)*)\):/g,
          (match, inner) => `"(${inner.replace(/\s+/g, " ")})":`
        )
        .replace(/'/g, '"');
      return JSON.parse(normalized);
    } catch {
      return value;
    }
  }
  return value;
}

// List of packages available in Pyodide that we support
export const PYODIDE_SUPPORTED_PACKAGES = new Set([
  // Standard library (always available)
  "json",
  "math",
  "re",
  "collections",
  "itertools",
  "functools",
  "string",
  "random",
  "datetime",
  "typing",
  "abc",
  "dataclasses",
  // Pyodide built-in packages
  "numpy",
  "micropip",
]);

// Check if a challenge can run in the browser based on dependencies
export function canRunInBrowser(dependencies?: string[]): boolean {
  if (!dependencies || dependencies.length === 0) {
    return true; // No deps = can run in browser
  }

  // Check if all dependencies are supported
  return dependencies.every(
    (dep) =>
      PYODIDE_SUPPORTED_PACKAGES.has(dep) ||
      dep.startsWith("collections.") ||
      dep.startsWith("typing.")
  );
}
