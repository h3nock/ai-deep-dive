"use client";

import { useProgress } from "@/lib/progress-context";
import { BaseProgressBar } from "./BaseProgressBar";

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
  const { getCompletedCount, isLoaded } = useProgress();
  const completed = getCompletedCount(courseId);

  return (
    <BaseProgressBar
      completed={completed}
      total={totalSteps}
      isLoaded={isLoaded}
      label="completed"
      className={className}
      showLabel={showLabel}
      size={size}
      hideWhenEmpty={hideWhenEmpty}
    />
  );
}
