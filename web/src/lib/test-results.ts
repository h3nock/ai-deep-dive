export type TestStatus =
  | "Accepted"
  | "Wrong Answer"
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
  hidden?: boolean;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  public_total?: number;
  public_passed?: number;
  hidden_total?: number;
  hidden_passed?: number;
}

export interface RunResult {
  status: TestStatus;
  summary: TestSummary;
  tests: TestResult[];
  error?: string;
}
