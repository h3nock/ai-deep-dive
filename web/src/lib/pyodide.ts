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

// Preload Pyodide in the background (safe to call multiple times)
// Call this on user intent signals (hover, focus) to reduce perceived latency
export function preloadPyodide(): void {
  // Skip if already loaded or loading
  if (pyodideInstance || loadPromise) {
    return;
  }
  // Start loading in background - don't await
  loadPyodide().catch(() => {
    // Silently ignore preload errors - will retry on actual use
  });
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
}

export interface TestCase {
  id: string;
  input: string; // Python code to set up input variables
  expected: string;
}

export interface TestConfig {
  cases: TestCase[];
  runner: string; // Expression to evaluate
  comparison?: {
    type?: "exact" | "allclose";
    rtol?: number;
    atol?: number;
  };
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

  const comparisonType = config.comparison?.type ?? "approx";
  const comparisonRtol = config.comparison?.rtol ?? 1e-6;
  const comparisonAtol = config.comparison?.atol ?? 1e-6;

  // Run each test case
  for (const testCase of config.cases) {
    currentStdout = "";
    currentStderr = "";

    let status: TestResult["status"] = "Accepted";
    let output = "";
    let stderr = "";

    // Create a fresh case-specific namespace that inherits user functions
    // This prevents variable pollution between test cases
    // Comparison is done entirely in Python to preserve exact semantics
    // (tuple keys, sets, complex numbers, etc. all work correctly)
    const testCode = `
import copy as __copy__
__case_globals__ = __copy__.deepcopy(__user_globals__)
__test_error__ = None
__result_repr__ = None
__expected_repr__ = None
__matched__ = False
__cmp_type__ = ${JSON.stringify(comparisonType)}
__rtol__ = ${comparisonRtol}
__atol__ = ${comparisonAtol}

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

    # Parse expected value from a Python literal string (safe + supports tuple keys)
    import ast as __ast__
    __expected__ = __ast__.literal_eval(${JSON.stringify(testCase.expected)})
    
    # approximate for real numbers (incl. numpy), exact for everything else
    import math as __math__
    import numbers as __numbers__
    try:
        import numpy as __np__
    except Exception:
        __np__ = None

    def __is_numpy_array__(x):
        return __np__ is not None and isinstance(x, __np__.ndarray)

    def __approx_equal__(a, b, rel_tol=1e-6, abs_tol=1e-6):
        # identity check (handles None, same object, etc.)
        if a is b:
            return True

        # handle numpy arrays (and array vs list/tuple)
        if __is_numpy_array__(a) or __is_numpy_array__(b):
            if __is_numpy_array__(a) and __is_numpy_array__(b):
                try:
                    return bool(__np__.allclose(a, b, rtol=rel_tol, atol=abs_tol, equal_nan=True))
                except Exception:
                    return False
            if __is_numpy_array__(a) and type(b) in (list, tuple):
                return __approx_equal__(a.tolist(), list(b) if type(b) is tuple else b, rel_tol, abs_tol)
            if __is_numpy_array__(b) and type(a) in (list, tuple):
                return __approx_equal__(list(a) if type(a) is tuple else a, b.tolist(), rel_tol, abs_tol)
            return False

        # exclude bool from approximate comparison (bool is subclass of int)
        if type(a) is bool or type(b) is bool:
            return a == b

        # use tolerance for all real numbers (int, float, numpy scalars)
        # numbers.Real includes numpy.floating and numpy.integer
        if isinstance(a, __numbers__.Real) and isinstance(b, __numbers__.Real):
            try:
                return __math__.isclose(float(a), float(b), rel_tol=rel_tol, abs_tol=abs_tol)
            except Exception:
                return False

        # recursive collection comparison (use type() to exclude subclasses)
        if type(a) is list and type(b) is list:
            return len(a) == len(b) and all(__approx_equal__(x, y, rel_tol, abs_tol) for x, y in zip(a, b))
        if type(a) is tuple and type(b) is tuple:
            return len(a) == len(b) and all(__approx_equal__(x, y, rel_tol, abs_tol) for x, y in zip(a, b))
        if type(a) is dict and type(b) is dict:
            return a.keys() == b.keys() and all(__approx_equal__(a[k], b[k], rel_tol, abs_tol) for k in a)

        # fallback: exact equality with safe bool coercion
        result = a == b
        if result is NotImplemented:
            return False
        try:
            return bool(result)
        except Exception:
            return False
    
    if __cmp_type__ == "exact":
        __matched__ = __result__ == __expected__
    else:
        __matched__ = __approx_equal__(__result__, __expected__, rel_tol=__rtol__, abs_tol=__atol__)

    # Use repr() for display - shows exact Python syntax
    __result_repr__ = repr(__result__)
    __expected_repr__ = repr(__expected__)
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
      // Get comparison result from Python (comparison done in Python for exact semantics)
      const matched = await pyodide.runPythonAsync("__matched__");
      const resultRepr = await pyodide.runPythonAsync("__result_repr__");

      // Use repr() output for display - shows exact Python syntax
      output = resultRepr;
      status = matched ? "Accepted" : "Wrong Answer";
    }

    results.push({
      id: testCase.id,
      status,
      input: testCase.input,
      stdout: currentStdout,
      output,
      expected: testCase.expected,
      stderr: stderr || currentStderr,
    });
  }

  return results;
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
