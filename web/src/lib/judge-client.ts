import type { RunResult } from "@/lib/test-results";

export type JudgeRunRequest = {
  problem_id: string;
  code: string;
  cases: Array<{
    id: string;
    inputs: Record<string, string>;
    expected_literal: string;
  }>;
};

export type JudgeSubmitRequest = {
  problem_id: string;
  code: string;
};

export type JudgeJobResponse = {
  job_id: string;
  status: string;
};

export type JudgeJobResult = {
  job_id: string;
  status: "queued" | "running" | "done" | "error";
  problem_id: string;
  profile: string;
  created_at: number;
  started_at?: number;
  finished_at?: number;
  attempts?: number;
  result?: RunResult;
  error?: string;
  error_kind?: "user" | "internal";
};

const BASE_URL = process.env.NEXT_PUBLIC_JUDGE_API_URL || "";

function requireBaseUrl(): string {
  if (!BASE_URL) {
    throw new Error("JUDGE API URL not configured (NEXT_PUBLIC_JUDGE_API_URL)");
  }
  return BASE_URL.replace(/\/$/, "");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail);
      }
    } catch {
      // ignore parse failure
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

function createAbortError(): Error {
  const error = new Error("Polling aborted");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }

    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(createAbortError());
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runOnJudge(
  request: JudgeRunRequest
): Promise<JudgeJobResponse> {
  const base = requireBaseUrl();
  return fetchJson<JudgeJobResponse>(`${base}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function submitToJudge(
  request: JudgeSubmitRequest
): Promise<JudgeJobResponse> {
  const base = requireBaseUrl();
  return fetchJson<JudgeJobResponse>(`${base}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function fetchJudgeResult(
  jobId: string,
  signal?: AbortSignal
): Promise<JudgeJobResult> {
  const base = requireBaseUrl();
  return fetchJson<JudgeJobResult>(`${base}/result/${jobId}`, { signal });
}

export async function waitForJudgeResult(
  jobId: string,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    intervalFn?: (attempt: number, elapsedMs: number) => number;
    onUpdate?: (r: JudgeJobResult) => void;
    signal?: AbortSignal;
  }
): Promise<JudgeJobResult> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const start = Date.now();
  let attempt = 0;

  while (Date.now() - start < timeoutMs) {
    throwIfAborted(options?.signal);
    const result = await fetchJudgeResult(jobId, options?.signal);
    options?.onUpdate?.(result);
    if (result.status === "done" || result.status === "error") {
      return result;
    }
    const elapsed = Date.now() - start;
    const intervalMs =
      options?.intervalFn?.(attempt, elapsed) ?? options?.intervalMs ?? 1000;
    await sleepWithAbort(intervalMs, options?.signal);
    attempt += 1;
  }

  throw new Error("Timed out waiting for judge result");
}
