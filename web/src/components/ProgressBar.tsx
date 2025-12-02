"use client";

import { useProgress } from "@/lib/progress-context";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  courseId: string;
  totalSteps: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
  hideWhenEmpty?: boolean;
}

export function ProgressBar({
  courseId,
  totalSteps,
  className,
  showLabel = true,
  size = "md",
  hideWhenEmpty = false,
}: ProgressBarProps) {
  const { getPercentage, getCompletedCount, isLoaded } = useProgress();

  const percentage = getPercentage(courseId, totalSteps);
  const completed = getCompletedCount(courseId);

  // Hide completely if no progress and hideWhenEmpty is true
  if (hideWhenEmpty && isLoaded && completed === 0) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted">
            {isLoaded ? `${completed} of ${totalSteps} completed` : ""}
          </span>
          {isLoaded && completed > 0 && (
            <span className="text-xs font-medium text-secondary">
              {percentage}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "w-full bg-zinc-800 rounded-full overflow-hidden",
          size === "sm" ? "h-0.5" : "h-1"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            percentage === 100 ? "bg-emerald-400" : "bg-zinc-400"
          )}
          style={{ width: isLoaded ? `${percentage}%` : "0%" }}
        />
      </div>
    </div>
  );
}
