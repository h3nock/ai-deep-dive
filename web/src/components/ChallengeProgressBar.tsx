"use client";

import { useChallengeProgress } from "@/lib/use-challenge-progress";
import { BaseProgressBar } from "./BaseProgressBar";

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
  const { solvedCount, total, isLoaded } = useChallengeProgress(
    courseId,
    challengeIds
  );

  return (
    <BaseProgressBar
      completed={solvedCount}
      total={total}
      isLoaded={isLoaded}
      label="solved"
      className={className}
      showLabel={showLabel}
      size={size}
      hideWhenEmpty={hideWhenEmpty}
    />
  );
}
