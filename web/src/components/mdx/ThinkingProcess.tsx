"use client";

import React, { useState } from "react";
import { ChevronDown, BrainCircuit } from "lucide-react";

interface ThinkingProcessProps {
  title?: string;
  hint?: React.ReactNode;
  children: React.ReactNode; // The answer/explanation
  /** When true, adds section-level margins (48px). Use for standalone usage outside of Step. */
  withSectionBreak?: boolean;
  /** Optional className for custom spacing (e.g., 'content-attached' when following an intro) */
  className?: string;
}

/**
 * ThinkingProcess Component - Interactive Learning Block
 *
 * SPACING STRATEGY:
 * - Default: NO outer margins - respects parent's gap-based spacing (e.g., inside Step)
 * - With `withSectionBreak`: Adds Tier 4 (Section) margins for standalone usage
 * - With `className="content-attached"`: Tight coupling to preceding intro text
 * - Internal spacing uses Tier 2 (Connected) for related elements
 * - This component signals a "pause and think" moment in the narrative
 */
export function ThinkingProcess({
  title = "Think About It",
  hint,
  children,
  withSectionBreak = false,
  className,
}: ThinkingProcessProps) {
  const [isHintOpen, setIsHintOpen] = useState(false);
  const [isAnswerOpen, setIsAnswerOpen] = useState(false);

  return (
    <div
      className={className}
      style={
        withSectionBreak
          ? {
              marginTop: "var(--space-section)",
              marginBottom: "var(--space-section)",
            }
          : undefined
      }
    >
      {/* Header - icon and title vertically centered */}
      <div
        className="flex items-center gap-2"
        style={{ marginBottom: "var(--space-atomic)" }}
      >
        <div className="flex items-center justify-center w-5 h-5">
          <BrainCircuit className="w-[18px] h-[18px] text-warning" />
        </div>
        <span className="text-lg font-semibold text-primary">{title}</span>
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
            className="group flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors"
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
          className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary hover:text-primary border border-border hover:border-border-hover rounded-lg transition-all duration-200"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isAnswerOpen ? "rotate-180" : "rotate-0"
            }`}
          />
          <span>{isAnswerOpen ? "Hide answer" : "Reveal answer"}</span>
        </button>
      </div>

      {/* Answer content - subtle left accent to mark the answer zone */}
      {isAnswerOpen && (
        <div className="border-l-2 border-border pl-5 animate-in fade-in slide-in-from-top-3 duration-300 prose prose-invert max-w-none [&>hr]:border-border [&>hr]:my-8">
          {children}
        </div>
      )}
    </div>
  );
}
