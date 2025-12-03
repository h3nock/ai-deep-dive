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

// Load Pyodide from CDN
export async function loadPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    // Dynamically load Pyodide script if not already loaded
    if (typeof window !== "undefined" && !(window as any).loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.6/full/pyodide.js";
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

  pyodide.setStdout({
    batched: (text: string) => {
      currentStdout += text;
      onStdout?.(text);
    },
  });

  pyodide.setStderr({
    batched: (text: string) => {
      currentStderr += text;
      onStderr?.(text);
    },
  });

  // First, try to execute user code to define functions/classes
  // We wrap this in a fresh namespace that persists across test cases
  const setupCode = `
__user_globals__ = {}
exec(${JSON.stringify(userCode)}, __user_globals__)
`;

  try {
    await pyodide.runPythonAsync(setupCode);
  } catch (error: any) {
    // If user code fails, all tests fail
    return [
      {
        id: "error",
        status: "Runtime Error",
        input: "",
        stdout: currentStdout,
        output: "",
        expected: "",
        stderr: error.message || String(error),
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

    try {
      // Create a fresh case-specific namespace that inherits user functions
      // This prevents variable pollution between test cases
      const testCode = `
import json as __json__
__case_globals__ = __user_globals__.copy()
exec(${JSON.stringify(testCase.input)}, __case_globals__)
__result__ = eval(${JSON.stringify(config.runner)}, __case_globals__)

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

__result_json__ = __json__.dumps(__serialize__(__result__))
`;

      await pyodide.runPythonAsync(testCode);

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
    } catch (error: any) {
      status = "Runtime Error";
      stderr = currentStderr + (error.message || String(error));
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
