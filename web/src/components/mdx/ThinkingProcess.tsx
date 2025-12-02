"use client";

import React, { useState } from "react";
import { ChevronDown, BrainCircuit } from "lucide-react";

interface ThinkingProcessProps {
  title?: string;
  hint?: React.ReactNode;
  children: React.ReactNode; // The answer/explanation
}

/**
 * ThinkingProcess Component - Interactive Learning Block
 *
 * SPACING STRATEGY:
 * - Top margin: Tier 4 (Section) - this is a major interactive element
 * - Bottom margin: Tier 4 (Section) - provides significant break after engagement
 * - Internal spacing uses Tier 2 (Connected) for related elements
 * - This component signals a "pause and think" moment in the narrative
 */
export function ThinkingProcess({
  title = "Think About It",
  hint,
  children,
}: ThinkingProcessProps) {
  const [isHintOpen, setIsHintOpen] = useState(false);
  const [isAnswerOpen, setIsAnswerOpen] = useState(false);

  return (
    <div
      style={{
        marginTop: "var(--space-section)",
        marginBottom: "var(--space-section)",
      }}
    >
      {/* Header - floats on the void */}
      <div
        className="flex items-center gap-3"
        style={{ marginBottom: "var(--space-atomic)" }}
      >
        <BrainCircuit className="w-6 h-6 text-amber-400" />
        <h3 className="text-xl font-semibold text-primary">{title}</h3>
      </div>

      {/* Subtext */}
      <p
        className="text-sm text-muted italic"
        style={{ marginBottom: "var(--space-flow)" }}
      >
        Take a moment to think before revealing the answer.
      </p>

      {/* Hint section (if provided) */}
      {hint && (
        <div style={{ marginBottom: "var(--space-flow)" }}>
          <button
            onClick={() => setIsHintOpen(!isHintOpen)}
            className="group flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isHintOpen ? "rotate-0" : "-rotate-90"
              }`}
            />
            <span>{isHintOpen ? "Hide hint" : "Show hint"}</span>
          </button>

          {isHintOpen && (
            <div
              className="text-secondary animate-in fade-in slide-in-from-top-2 duration-200"
              style={{ marginTop: "var(--space-connected)" }}
            >
              {hint}
            </div>
          )}
        </div>
      )}

      {/* Reveal Answer - Ghost button, centered */}
      <div
        className="flex justify-center"
        style={{
          marginTop: "var(--space-flow)",
          marginBottom: "var(--space-flow)",
        }}
      >
        <button
          onClick={() => setIsAnswerOpen(!isAnswerOpen)}
          className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-600 rounded-lg transition-all duration-200"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isAnswerOpen ? "rotate-180" : "rotate-0"
            }`}
          />
          <span>{isAnswerOpen ? "Hide answer" : "Reveal answer"}</span>
        </button>
      </div>

      {/* Answer content - no box wrapper, just flows */}
      {isAnswerOpen && (
        <div className="animate-in fade-in slide-in-from-top-3 duration-300 prose prose-invert max-w-none [&>hr]:border-zinc-800 [&>hr]:my-8">
          {children}
        </div>
      )}
    </div>
  );
}
