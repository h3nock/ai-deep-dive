"use client";

import { useProgress } from "@/lib/progress-context";
import { useChallengeProgress } from "@/lib/use-challenge-progress";
import { cn } from "@/lib/utils";

interface ProgressStatCardsProps {
  courseId: string;
  totalChapters: number;
  challengeIds: string[];
}

export function ProgressStatCards({
  courseId,
  totalChapters,
  challengeIds,
}: ProgressStatCardsProps) {
  const { getCompletedCount, isLoaded: chaptersLoaded } = useProgress();
  const {
    solvedCount,
    total: totalChallenges,
    isLoaded: challengesLoaded,
  } = useChallengeProgress(courseId, challengeIds);

  const completedChapters = chaptersLoaded ? getCompletedCount(courseId) : 0;
  const chapterPct =
    totalChapters === 0
      ? 0
      : Math.round((completedChapters / totalChapters) * 100);
  const challengePct =
    totalChallenges === 0
      ? 0
      : Math.round((solvedCount / totalChallenges) * 100);

  return (
    <div className="mt-6 flex gap-3 flex-wrap">
      <ProgressCard
        completed={completedChapters}
        total={totalChapters}
        label="chapters"
        percentage={chapterPct}
        isLoaded={chaptersLoaded}
      />
      {totalChallenges > 0 && (
        <ProgressCard
          completed={solvedCount}
          total={totalChallenges}
          label="problems"
          percentage={challengePct}
          isLoaded={challengesLoaded}
        />
      )}
      <div className="bg-surface rounded-xl px-4 py-3">
        <span className="text-xl font-bold text-primary">~120</span>
        <span className="block text-xs text-muted mt-0.5">hours</span>
      </div>
    </div>
  );
}

function ProgressCard({
  completed,
  total,
  label,
  percentage,
  isLoaded,
}: {
  completed: number;
  total: number;
  label: string;
  percentage: number;
  isLoaded: boolean;
}) {
  const isComplete = isLoaded && percentage === 100;

  return (
    <div className="bg-surface rounded-xl px-4 pt-3 pb-3 min-w-[7rem]">
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-primary">
          {isLoaded ? completed : total}
        </span>
        {isLoaded && (
          <span className="text-sm text-muted/60">/ {total}</span>
        )}
      </div>
      <span className="block text-xs text-muted mt-0.5">{label}</span>
      <div className="mt-2.5 w-full bg-border/25 rounded-full overflow-hidden h-1">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            isComplete ? "bg-success progress-shimmer" : "bg-secondary"
          )}
          style={{ width: isLoaded ? `${percentage}%` : "0%" }}
        />
      </div>
    </div>
  );
}
