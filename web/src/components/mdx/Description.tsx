import React from "react";

/**
 * Description Component - The Reading Paragraph
 *
 * SPACING STRATEGY:
 * - Uses Tier 3 (Flow Gap) for bottom margin to maintain reading rhythm
 * - No top margin - relies on parent/sibling spacing for "Component Sandwich" pattern
 * - When multiple Descriptions appear consecutively, they flow together naturally
 * - When Description precedes a component, it acts as "intro text" (tight connection)
 *
 * @param noMargin - When true, removes bottom margin (use when parent handles spacing via gap)
 * @param attached - When true, removes bottom margin (use when content follows that is semantically part of this paragraph, e.g., a table introduced with ":")
 */
export function Description({
  children,
  noMargin = false,
  attached = false,
}: {
  children: React.ReactNode;
  noMargin?: boolean;
  attached?: boolean;
}) {
  const shouldRemoveMargin = noMargin || attached;
  return (
    <div
      className="not-prose"
      style={
        shouldRemoveMargin ? undefined : { marginBottom: "var(--space-flow)" }
      }
    >
      <div
        className="[&>p]:text-lg [&>p]:leading-relaxed [&>p]:text-secondary [&>p:not(:last-child)]:mb-4
        [&>h3]:text-xs [&>h3]:uppercase [&>h3]:tracking-widest [&>h3]:text-muted [&>h3]:font-medium [&>h3]:mt-6 [&>h3]:mb-2
        [&_strong]:text-primary [&_strong]:font-semibold
        [&_code]:text-sm [&_code]:text-secondary [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
        [&>p_a]:text-primary [&>p_a]:underline [&>p_a]:underline-offset-4 [&>p_a]:decoration-border hover:[&>p_a]:decoration-secondary hover:[&>p_a]:text-primary [&>p_a]:transition-colors
        [&>ul]:mt-3 [&>ul]:space-y-2 [&>ul]:text-secondary [&>ul]:text-lg [&>ul]:leading-relaxed
        [&>ul>li]:pl-1"
      >
        {children}
      </div>
    </div>
  );
}
