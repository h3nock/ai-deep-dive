"use client";

import React from "react";

interface StepProps {
  title?: string;
  children: React.ReactNode;
}

/**
 * Step Component - Major Section Container
 *
 * SPACING STRATEGY:
 * - Uses Tier 4 (Section Gap) for vertical padding - signals topic change
 * - Border creates visual break (replaces need for massive whitespace alone)
 * - Internal children use Tier 2 (Connected Gap) - they belong to same topic
 * - Headline uses Tier 2 gap to content - it introduces what follows
 * - last:border-0 removes redundant border at end
 */
export function Step({ title, children }: StepProps) {
  // If no title, this is a project intro step - render more cleanly
  if (!title) {
    return (
      <div className="relative">
        <div
          className="flex flex-col"
          style={{ gap: "var(--space-connected)" }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-b border-border last:border-0"
      style={{
        paddingTop: "var(--space-section)",
        paddingBottom: "var(--space-section)",
      }}
    >
      <h3
        className="text-2xl font-bold text-primary"
        style={{ marginBottom: "var(--space-connected)" }}
      >
        {title}
      </h3>
      <div className="flex flex-col" style={{ gap: "var(--space-connected)" }}>
        {children}
      </div>
    </div>
  );
}
