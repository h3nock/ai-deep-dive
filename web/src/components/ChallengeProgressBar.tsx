"use client";

import { cn } from "@/lib/utils";
import { useChallengeProgress } from "@/lib/use-challenge-progress";

interface ChallengeProgressBarProps {
  courseId: string;
  challengeIds: string[];
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
  hideWhenEmpty?: boolean;
}

export function ChallengeProgressBar({
  courseId,
  challengeIds,
  className,
  showLabel = true,
  size = "md",
  hideWhenEmpty = false,
}: ChallengeProgressBarProps) {
  const { solvedCount, total, percentage, isLoaded } = useChallengeProgress(
    courseId,
    challengeIds
  );

  if (hideWhenEmpty && isLoaded && solvedCount === 0) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted">
            {isLoaded ? `${solvedCount} of ${total} solved` : ""}
          </span>
          {isLoaded && solvedCount > 0 && (
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

