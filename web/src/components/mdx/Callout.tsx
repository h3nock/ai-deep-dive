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

export function Callout({ type = "note", title, children }: CalloutProps) {
  const style = styles[type];
  const Icon = style.Icon;

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
