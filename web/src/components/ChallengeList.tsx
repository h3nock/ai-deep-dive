"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { useChallengeProgress } from "@/lib/use-challenge-progress";
import { isChallengeSolved } from "@/lib/challenge-storage";
import type { Challenge } from "@/lib/challenge-types";

type ChallengeListProps = {
  courseId: string;
  challenges: Challenge[];
  onSelectIndex: (index: number) => void;
  onPrefetchIndex?: (index: number) => void;
};

export function ChallengeList({
  courseId,
  challenges,
  onSelectIndex,
  onPrefetchIndex,
}: ChallengeListProps) {
  const challengeIds = useMemo(() => challenges.map((c) => c.id), [challenges]);
  const { solvedCount, total: totalChallenges, isLoaded: isProgressLoaded } =
    useChallengeProgress(courseId, challengeIds);
  const prefetchedIndexSetRef = useRef<Set<number>>(new Set());
  const hoverPrefetchHandleRef = useRef<number | null>(null);

  const prefetchChallengeRoute = useCallback(
    (index: number) => {
      if (!onPrefetchIndex || prefetchedIndexSetRef.current.has(index)) {
        return;
      }
      prefetchedIndexSetRef.current.add(index);
      onPrefetchIndex(index);
    },
    [onPrefetchIndex]
  );

  const cancelHoverPrefetch = useCallback(() => {
    if (hoverPrefetchHandleRef.current === null) {
      return;
    }
    window.clearTimeout(hoverPrefetchHandleRef.current);
    hoverPrefetchHandleRef.current = null;
  }, []);

  const scheduleHoverPrefetch = useCallback(
    (index: number) => {
      cancelHoverPrefetch();
      hoverPrefetchHandleRef.current = window.setTimeout(() => {
        hoverPrefetchHandleRef.current = null;
        prefetchChallengeRoute(index);
      }, 160);
    },
    [cancelHoverPrefetch, prefetchChallengeRoute]
  );

  useEffect(() => {
    prefetchedIndexSetRef.current.clear();
  }, [challenges]);

  useEffect(() => cancelHoverPrefetch, [cancelHoverPrefetch]);

  const statusMessage = !isProgressLoaded
    ? `${totalChallenges} ${totalChallenges === 1 ? "problem" : "problems"}`
    : solvedCount === 0
      ? `${totalChallenges} ${totalChallenges === 1 ? "problem" : "problems"} to solve`
      : solvedCount === totalChallenges
        ? "All challenges completed!"
        : `${solvedCount} of ${totalChallenges} completed`;

  return (
    <div className="flex flex-col h-full overflow-y-auto py-12">
      <div className="mx-auto w-full max-w-[75ch] px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold text-primary">
              {isProgressLoaded ? solvedCount : 0}
            </span>
            <span className="text-lg text-muted">/ {totalChallenges}</span>
          </div>
          <p className="text-sm text-muted">{statusMessage}</p>
        </header>

        <div className="grid grid-cols-1 gap-3">
          {challenges.map((challenge, idx) => {
            const challengeSolved =
              isProgressLoaded && isChallengeSolved(courseId, challenge.id);
            return (
              <button
                key={challenge.id}
                onPointerEnter={() => scheduleHoverPrefetch(idx)}
                onPointerLeave={cancelHoverPrefetch}
                onFocus={() => prefetchChallengeRoute(idx)}
                onClick={() => onSelectIndex(idx)}
                className="w-full text-left bg-surface/30 hover:bg-surface/50 rounded-xl border border-border hover:border-border-hover p-4 flex items-center gap-4 transition-all group"
              >
                <span className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-muted font-mono text-sm shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-secondary group-hover:text-primary transition-colors flex items-center gap-2">
                  {challenge.title}
                  {challengeSolved && (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  )}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    challenge.difficulty === "Easy"
                      ? "bg-success/10 text-success"
                      : challenge.difficulty === "Medium"
                        ? "bg-warning/10 text-warning"
                        : "bg-error/10 text-error"
                  }`}
                >
                  {challenge.difficulty || "Medium"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
