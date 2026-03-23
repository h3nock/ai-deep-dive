export interface TestCase {
  id: string;
  inputs: Record<string, string>;
  expected_literal: string;
  explanation?: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  initialCode: string;
  hint?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  chapterNumber?: string;
  problemNumber?: string;

  problemId: string;
  arguments: { name: string; type?: string }[];
  runner: string;
  executionProfile: "light" | "torch";
  comparison:
    | { type: "exact" }
    | { type: "allclose"; rtol: number; atol: number };
  timeLimitS: number;
  memoryMb: number;

  publicCases: TestCase[];
}
