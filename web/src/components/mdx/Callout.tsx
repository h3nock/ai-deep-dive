import React from "react";
import { AlertTriangle, Check, Info, Lightbulb } from "lucide-react";

type CalloutType = "note" | "warning" | "tip" | "success" | "info";

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const styles = {
  note: {
    border: "border-zinc-700",
    icon: "text-zinc-400",
    Icon: Info,
  },
  info: {
    border: "border-sky-500/50",
    icon: "text-sky-400",
    Icon: Info,
  },
  warning: {
    border: "border-amber-500/50",
    icon: "text-amber-400",
    Icon: AlertTriangle,
  },
  tip: {
    border: "border-zinc-700",
    icon: "text-zinc-400",
    Icon: Lightbulb,
  },
  success: {
    border: "border-emerald-400/50",
    icon: "text-emerald-400",
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
export function Callout({ type = "note", title, children }: CalloutProps) {
  const style = styles[type];
  const Icon = style.Icon;
  const isSummary = type === "success" && isSummaryTitle(title);

  // Summary callout: Left-border pattern (no box, typography-driven)
  // Gets extra top margin since it's usually a section-ending element
  if (isSummary) {
    return (
      <div
        className="pl-6 border-l-2 border-emerald-400/50"
        style={{
          marginTop: "var(--space-section)",
          marginBottom: "var(--space-flow)",
        }}
      >
        {/* Header floats on void */}
        <div
          className="flex items-center gap-2.5"
          style={{ marginBottom: "var(--space-connected)" }}
        >
          <div className="w-5 h-5 rounded-full border border-emerald-400/50 flex items-center justify-center">
            <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
          </div>
          <h4 className="font-semibold text-primary text-lg">{title}</h4>
        </div>
        {/* Content with emerald bullets */}
        <div className="text-secondary text-base leading-relaxed [&>ul]:list-none [&>ul]:p-0 [&>ul]:m-0 [&>ul]:space-y-3 [&>ul>li]:relative [&>ul>li]:pl-5 [&>ul>li]:before:content-[''] [&>ul>li]:before:absolute [&>ul>li]:before:left-0 [&>ul>li]:before:top-[0.6em] [&>ul>li]:before:w-1.5 [&>ul>li]:before:h-1.5 [&>ul>li]:before:rounded-full [&>ul>li]:before:bg-emerald-400 [&>ul>li>strong]:text-primary [&>ul>li>strong]:font-medium [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          {children}
        </div>
      </div>
    );
  }

  // Default callout: Left-border pattern
  // Connected to preceding content, provides reset after
  return (
    <div
      className={`pl-6 border-l-2 ${style.border}`}
      style={{
        marginTop: "var(--space-connected)",
        marginBottom: "var(--space-section)",
      }}
    >
      {title && (
        <div
          className="flex items-center gap-2"
          style={{ marginBottom: "var(--space-atomic)" }}
        >
          <Icon className={`w-4 h-4 ${style.icon}`} />
          <h4 className="font-semibold text-sm text-primary">{title}</h4>
        </div>
      )}
      <div className="text-secondary text-base leading-relaxed [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
