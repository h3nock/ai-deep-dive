export type TestStatus =
  | "Accepted"
  | "Wrong Answer"
  | "Syntax Error"
  | "Runtime Error"
  | "Time Limit Exceeded"
  | "Memory Limit Exceeded";

export interface TestResult {
  id: string;
  status: TestStatus;
  input?: string;
  stdout?: string;
  output?: string;
  expected?: string;
  stderr?: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
}

export interface RunResult {
  status: TestStatus;
  summary: TestSummary;
  tests: TestResult[];
  error?: string;
}
