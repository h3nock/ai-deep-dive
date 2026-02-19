"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useProgress } from "@/lib/progress-context";
import { cn } from "@/lib/utils";

interface ContinueButtonProps {
  courseId: string;
  allSteps: number[];
  slugMap: Record<number, string>; // step -> slug
  className?: string;
}

export function ContinueButton({
  courseId,
  allSteps,
  slugMap,
  className,
}: ContinueButtonProps) {
  const { getContinueStep, getCompletedCount, isLoaded } = useProgress();

  const nextStep = getContinueStep(courseId, allSteps);
  const completedCount = getCompletedCount(courseId);
  const isAllComplete =
    completedCount === allSteps.length && allSteps.length > 0;

  if (!isLoaded) {
    return (
      <div
        className={cn(
          "inline-flex items-center px-6 py-3 rounded-lg bg-surface",
          className
        )}
      >
        <span className="text-muted">Loading...</span>
      </div>
    );
  }

  const slug = nextStep ? slugMap[nextStep] : slugMap[allSteps[0]];

  if (!slug) return null;

  // All complete - subtle, not attention-grabbing
  if (isAllComplete) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <div className="w-5 h-5 rounded-full border border-emerald-400/50 flex items-center justify-center">
            <Check className="w-3 h-3" strokeWidth={3} />
          </div>
          <span className="font-medium">Course completed</span>
        </div>
        <Link
          href={`/${courseId}/${slugMap[allSteps[0]]}`}
          className={cn(
            "inline-flex items-center px-5 py-2.5 rounded-lg border border-border text-secondary hover:bg-surface text-sm font-medium transition-colors",
            className
          )}
        >
          Review from start
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>
    );
  }

  const buttonText =
    completedCount === 0 ? "Start Learning" : "Continue Learning";

  return (
    <Link
      href={`/${courseId}/${slug}`}
      prefetch={true}
      className={cn(
        "inline-flex items-center px-6 py-3 rounded-lg bg-primary hover:bg-primary-hover text-background font-medium transition-colors",
        className
      )}
    >
      {buttonText}
      <ArrowRight className="w-4 h-4 ml-2" />
    </Link>
  );
}
