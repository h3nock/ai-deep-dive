"use client";

import { cn } from "@/lib/utils";
import { useChallengeProgress } from "@/lib/use-challenge-progress";

interface ChallengeProgressPillProps {
  courseId: string;
  challengeIds: string[];
  className?: string;
}

export function ChallengeProgressPill({
  courseId,
  challengeIds,
  className,
}: ChallengeProgressPillProps) {
  const { solvedCount, total, isLoaded } = useChallengeProgress(courseId, challengeIds);

  if (total === 0) return null;

  const isComplete = isLoaded && solvedCount === total;
  const isInProgress = isLoaded && solvedCount > 0 && solvedCount < total;

  const statusText = !isLoaded
    ? "Loading"
    : isComplete
      ? "Completed"
      : isInProgress
        ? "In progress"
        : "Not started";

  const dotClass = isComplete
    ? "bg-success/55"
    : isInProgress
      ? "bg-warning/50"
      : "bg-muted/35";

  const textClass =
    isLoaded && solvedCount > 0 ? "text-secondary" : "text-muted";

  const label = isLoaded ? `${solvedCount}/${total}` : `0/${total}`;
  const ariaLabel = isLoaded
    ? `${statusText}: ${solvedCount} of ${total} problems solved`
    : `Problems: ${total}`;

  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-12 items-center justify-center rounded-md border border-border bg-surface/25 px-2 text-xs font-mono tabular-nums",
        "transition-colors group-hover:bg-surface/35",
        textClass,
        className
      )}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", dotClass)}
        />
        <span>{label}</span>
      </span>
    </span>
  );
}
