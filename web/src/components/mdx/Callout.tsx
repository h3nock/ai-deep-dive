import React from "react";
import { AlertTriangle, Check, Info, Lightbulb } from "lucide-react";

type CalloutType = "note" | "warning" | "tip" | "success" | "info";

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  /** When true, uses a more muted text color to de-emphasize the content */
  muted?: boolean;
  children: React.ReactNode;
}

const styles = {
  note: {
    border: "border-border-hover",
    bg: "",
    icon: "text-secondary",
    Icon: Info,
  },
  info: {
    border: "border-info/50",
    bg: "bg-info/5",
    icon: "text-info",
    Icon: Info,
  },
  warning: {
    border: "border-warning/50",
    bg: "bg-warning/5",
    icon: "text-warning",
    Icon: AlertTriangle,
  },
  tip: {
    border: "border-border-hover",
    bg: "bg-success/5",
    icon: "text-secondary",
    Icon: Lightbulb,
  },
  success: {
    border: "border-success/50",
    bg: "bg-success/5",
    icon: "text-success",
    Icon: Check,
  },
};

// Check if title indicates this is a summary section
const isSummaryTitle = (title?: string) => {
  if (!title) return false;
  const lowerTitle = title.toLowerCase();
  return (
    lowerTitle.includes("summary") || lowerTitle.includes("what we learned")
  );
};

/**
 * Callout Component - Highlighted Information Block
 *
 * SPACING STRATEGY (Component Sandwich - Asymmetric):
 * - Top margin: Tier 2 (Connected) - pulls toward the intro text above
 * - Bottom margin: Tier 4 (Section) - provides mental reset before next content
 * - This asymmetry connects the callout to what introduces it while giving
 *   breathing room before continuing
 */
export function Callout({ type = "note", title, muted = false, children }: CalloutProps) {
  const style = styles[type];
  const Icon = style.Icon;
  const isSummary = type === "success" && isSummaryTitle(title);

  // Summary callout: Left-border pattern (no box, typography-driven)
  // Gets extra top margin since it's usually a section-ending element
  if (isSummary) {
    return (
      <div
        style={{
          marginTop: "var(--space-section)",
          marginBottom: "var(--space-flow)",
        }}
      >
        {/* Header - no border, aligned with content */}
        <div
          className="flex items-center gap-2 pl-6"
          style={{ marginBottom: "var(--space-connected)" }}
        >
          <Check className="w-4 h-4 text-success shrink-0" strokeWidth={2.5} />
          <span className="font-semibold text-primary text-base leading-none">{title}</span>
        </div>
        {/* Content with emerald bullets - use pseudo-element for precise line positioning */}
        <div className="relative pl-6 text-secondary text-base leading-relaxed [&>ul]:list-none [&>ul]:p-0 [&>ul]:m-0 [&>ul]:space-y-3 [&>ul>li]:relative [&>ul>li]:pl-5 [&>ul>li]:before:content-[''] [&>ul>li]:before:absolute [&>ul>li]:before:left-0 [&>ul>li]:before:top-[0.6em] [&>ul>li]:before:w-1.5 [&>ul>li]:before:h-1.5 [&>ul>li]:before:rounded-full [&>ul>li]:before:bg-success [&>ul>li>strong]:text-primary [&>ul>li>strong]:font-medium [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          {/* Vertical line - starts at first bullet center, ends at last bullet center */}
          <div className="absolute left-0 top-[0.6em] bottom-[0.6em] w-0.5 bg-success/50"></div>
          {children}
        </div>
      </div>
    );
  }

  // Text color: muted callouts use lighter text to de-emphasize
  const textColorClass = muted ? "text-muted" : "text-secondary";

  // Default callout: Left-border pattern
  // Connected to preceding content, provides reset after
  return (
    <div
      className={`not-prose pl-6 pr-6 border-l-2 rounded-r-lg ${style.border} ${style.bg}`}
      style={{
        marginTop: "var(--space-connected)",
        marginBottom: "var(--space-section)",
        paddingTop: style.bg ? "1rem" : undefined,
        paddingBottom: style.bg ? "1rem" : undefined,
      }}
    >
      {title && (
        <div
          className="flex items-center gap-2"
          style={{ marginBottom: "var(--space-atomic)" }}
        >
          <Icon className={`w-4 h-4 shrink-0 ${style.icon}`} />
          <span className="font-semibold text-sm text-primary leading-none">
            {title}
          </span>
        </div>
      )}
      <div 
        className={`${textColorClass} leading-relaxed [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&_p]:!text-base [&_strong]:!text-base`}
      >
        {children}
      </div>
    </div>
  );
}
