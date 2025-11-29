import React from "react";
import { AlertCircle, CheckCircle2, Info, Lightbulb } from "lucide-react";

type CalloutType = "note" | "warning" | "tip" | "success" | "info";

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const styles = {
  note: {
    border: "border-slate-300 dark:border-slate-600",
    icon: "text-slate-500 dark:text-slate-400",
    Icon: Info,
  },
  info: {
    border: "border-sky-400 dark:border-sky-500",
    icon: "text-sky-500 dark:text-sky-400",
    Icon: Info,
  },
  warning: {
    border: "border-slate-300 dark:border-slate-600",
    icon: "text-slate-500 dark:text-slate-400",
    Icon: AlertCircle,
  },
  tip: {
    border: "border-slate-300 dark:border-slate-600",
    icon: "text-slate-500 dark:text-slate-400",
    Icon: Lightbulb,
  },
  success: {
    border: "border-emerald-500 dark:border-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2,
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

export function Callout({ type = "note", title, children }: CalloutProps) {
  const style = styles[type];
  const Icon = style.Icon;
  const isSummary = type === "success" && isSummaryTitle(title);

  // Render summary-style callout with enhanced readability
  if (isSummary) {
    return (
      <div className="my-8 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
              {title}
            </h4>
          </div>
        </div>
        {/* Content */}
        <div className="px-5 py-4">
          <div className="text-slate-600 dark:text-slate-300 text-[15px] leading-[1.8] [&>ul]:list-none [&>ul]:p-0 [&>ul]:m-0 [&>ul]:space-y-2.5 [&>ul>li]:relative [&>ul>li]:pl-5 [&>ul>li]:before:content-[''] [&>ul>li]:before:absolute [&>ul>li]:before:left-0 [&>ul>li]:before:top-[0.55em] [&>ul>li]:before:w-1.5 [&>ul>li]:before:h-1.5 [&>ul>li]:before:rounded-full [&>ul>li]:before:bg-emerald-500 dark:[&>ul>li]:before:bg-emerald-400 [&>ul>li>strong]:text-slate-800 dark:[&>ul>li>strong]:text-slate-100 [&>ul>li>strong]:font-semibold [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Default callout style
  return (
    <div className={`my-8 pl-6 pr-4 py-1 border-l-4 ${style.border}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-1 shrink-0 ${style.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="font-bold text-base text-slate-900 dark:text-white mb-2">
              {title}
            </h4>
          )}
          <div className="text-slate-700 dark:text-slate-300 text-base leading-relaxed [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
