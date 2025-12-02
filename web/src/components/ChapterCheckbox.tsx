"use client";

import { Check } from "lucide-react";
import { useProgress } from "@/lib/progress-context";
import { cn } from "@/lib/utils";

interface ChapterCheckboxProps {
  courseId: string;
  step: number;
  size?: "sm" | "md";
  showOnlyWhenComplete?: boolean;
}

export function ChapterCheckbox({
  courseId,
  step,
  size = "md",
  showOnlyWhenComplete = false,
}: ChapterCheckboxProps) {
  const { isComplete, isLoaded } = useProgress();

  const completed = isComplete(courseId, step);

  if (!isLoaded) {
    return (
      <div
        className={cn(
          "rounded border border-border",
          size === "sm" ? "w-4 h-4" : "w-5 h-5"
        )}
      />
    );
  }

  if (showOnlyWhenComplete && !completed) {
    return null;
  }

  // Only show checkbox when complete - cleaner list view
  if (!completed) {
    return (
      <div
        className={cn(
          "rounded border border-border",
          size === "sm" ? "w-4 h-4" : "w-5 h-5"
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full border flex items-center justify-center shrink-0 border-emerald-400/50",
        size === "sm" ? "w-4 h-4" : "w-5 h-5"
      )}
    >
      <Check
        className={cn(
          "text-emerald-400",
          size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"
        )}
        strokeWidth={3}
      />
    </div>
  );
}
