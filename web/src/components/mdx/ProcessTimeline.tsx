"use client";

import React from "react";

export interface ProcessStep {
  title: string;
  /** Optional data/code example (displayed in monospace) */
  data?: string;
  /** Description text */
  description: string;
}

interface ProcessTimelineProps {
  steps: ProcessStep[];
}

/**
 * ProcessTimeline Component - Conceptual Timeline (Read-only)
 *
 * Used for educational content explaining a process or journey.
 * NOT interactive - no hover states, no arrows, no navigation.
 *
 * Features:
 * - Small nodes (w-8 h-8) with monospace numbers
 * - Vertical line on left
 * - Consistent text hierarchy (title → data → description)
 */
export function ProcessTimeline({ steps }: ProcessTimelineProps) {
  return (
    <div
      className="not-prose relative"
      style={{
        marginTop: "var(--space-connected)",
        marginBottom: "var(--space-connected)",
      }}
    >
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border"></div>

      <div className="space-y-6">
        {steps.map((step, index) => (
          <div key={index} className="relative flex gap-4">
            <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-secondary font-mono text-xs shrink-0">
              {index + 1}
            </div>
            <div className="flex-1 pt-0.5">
              <div className="font-semibold text-primary">{step.title}</div>
              {step.data && (
                <div className="font-mono text-sm text-secondary mt-1">
                  {step.data}
                </div>
              )}
              <p className="text-sm text-secondary leading-relaxed tracking-wide mt-1">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
