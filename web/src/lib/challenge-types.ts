export interface Challenge {
  id: string;
  title: string;
  description: string; // Markdown string
  initialCode: string;
  hint?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  arguments?: { name: string; type: string }[];
  executionSnippet?: string; // Code to run the function, e.g. "print(solution(numRows))"
  dependencies?: string[]; // Required packages (determines browser vs CLI execution)
  problemId: string; // Problem id for server-side judge
  chapterNumber?: string; // e.g., "02" from "02-tokenization"
  problemNumber?: string; // e.g., "01" from "01-pair-counter"
  visibleTestCases?: number; // Limit examples shown in left panel
}
