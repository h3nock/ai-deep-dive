import type { TestConfig } from "@/lib/pyodide";

type Comparison = {
  type?: "exact" | "allclose";
  rtol?: number;
  atol?: number;
};

type PublicTestCase = {
  id: string;
  input_code?: string;
  inputs?: Record<string, string>;
  expected: unknown;
  expected_is_code?: boolean;
  hidden?: boolean;
  comparison?: Comparison;
};

type PublicTestsFile = {
  version?: number;
  cases: PublicTestCase[];
};

type PublicManifest = {
  problem_id: string;
  version: string;
  bundle: string;
  runner: string;
  comparison?: Comparison;
};

type PublicBundle = {
  version: string;
  runner: string;
  comparison?: Comparison;
  tests: PublicTestsFile | PublicTestCase[];
};

const bundleCache = new Map<string, PublicBundle>();

function problemPath(problemId: string): string {
  return problemId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return res.json() as Promise<T>;
}

function pythonLiteral(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return Number.isFinite(value) ? `${value}` : "float('nan')";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => pythonLiteral(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${JSON.stringify(key)}: ${pythonLiteral(val)}`)
      .join(", ");
    return `{${entries}}`;
  }
  return JSON.stringify(value);
}

function normalizeTests(tests: PublicTestsFile | PublicTestCase[]): PublicTestCase[] {
  if (Array.isArray(tests)) return tests;
  return tests.cases ?? [];
}

export async function fetchPublicBundle(problemId: string): Promise<PublicBundle> {
  const path = problemPath(problemId);
  const manifestUrl = `/judge-tests/${path}/public_manifest.json`;
  const manifest = await fetchJson<PublicManifest>(manifestUrl);
  const cacheKey = `${problemId}@${manifest.version}`;

  if (bundleCache.has(cacheKey)) {
    return bundleCache.get(cacheKey)!;
  }

  const bundleUrl = `/judge-tests/${path}/${manifest.bundle}`;
  const bundle = await fetchJson<PublicBundle>(bundleUrl);
  bundleCache.set(cacheKey, bundle);
  return bundle;
}

export function bundleToTestConfig(bundle: PublicBundle): TestConfig {
  const comparisonType = bundle.comparison?.type;
  if (comparisonType && comparisonType !== "exact" && comparisonType !== "allclose") {
    console.warn(`Unknown comparison type: ${comparisonType}`);
  }

  const cases = normalizeTests(bundle.tests).map((tc) => {
    let input = tc.input_code ?? "";
    if (!input && tc.inputs) {
      input = Object.entries(tc.inputs)
        .map(([key, value]) => `${key} = ${value}`)
        .join("\n");
      if (input) input += "\n";
    }

    const expected = tc.expected_is_code
      ? String(tc.expected)
      : pythonLiteral(tc.expected);

    return {
      id: tc.id,
      input,
      expected,
      hidden: tc.hidden,
    };
  });

  return {
    runner: bundle.runner,
    cases,
    comparison: bundle.comparison,
  };
}
