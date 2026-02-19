"use client";

import { Check } from "lucide-react";
import { useProgress } from "@/lib/progress-context";
import { cn } from "@/lib/utils";

interface MarkCompleteButtonProps {
  courseId: string;
  step: number;
  nextHref?: string;
  className?: string;
}

export function MarkCompleteButton({
  courseId,
  step,
  className,
}: MarkCompleteButtonProps) {
  const { isComplete, toggleComplete, isLoaded } = useProgress();

  const completed = isComplete(courseId, step);

  const handleClick = () => {
    toggleComplete(courseId, step);
  };

  if (!isLoaded) {
    return (
      <button
        disabled
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm text-muted",
          className
        )}
      >
        <div className="w-4 h-4 rounded border border-border" />
        <span>Mark as complete</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200",
        completed
          ? "text-emerald-400"
          : "text-muted hover:text-secondary hover:bg-surface",
        className
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200",
          completed
            ? "border-emerald-400/50"
            : "border-border group-hover:border-border-hover"
        )}
      >
        {completed && (
          <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
        )}
      </div>
      <span className={cn("transition-colors", completed && "font-medium")}>
        {completed ? "Completed" : "Mark as complete"}
      </span>
    </button>
  );
}
