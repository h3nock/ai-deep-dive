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

  return (
    <div className="flex flex-col h-full overflow-y-auto py-12">
      <div className="mx-auto w-full max-w-[85ch] px-6 lg:px-8">
        <header className="mb-8">
          <p className="text-muted text-sm">
            {!isProgressLoaded
              ? `${totalChallenges} ${
                  totalChallenges === 1 ? "problem" : "problems"
                }`
              : solvedCount === 0
                ? `${totalChallenges} ${
                    totalChallenges === 1 ? "problem" : "problems"
                  } to solve`
                : solvedCount === totalChallenges
                  ? "All challenges completed!"
                  : `${solvedCount} of ${totalChallenges} completed`}
          </p>
        </header>

        <div className="-mx-4 divide-y divide-border">
          {challenges.map((challenge, idx) => {
            const challengeSolved =
              isProgressLoaded && isChallengeSolved(courseId, challenge.id);
            return (
              <div key={challenge.id} className="py-1">
                <button
                  onPointerEnter={() => scheduleHoverPrefetch(idx)}
                  onPointerLeave={cancelHoverPrefetch}
                  onFocus={() => prefetchChallengeRoute(idx)}
                  onClick={() => onSelectIndex(idx)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-zinc-900/50 rounded-lg transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-muted/60 text-sm font-mono w-6">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-secondary group-hover:text-primary transition-colors flex items-center gap-2">
                      {challenge.title}
                      {challengeSolved && (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      )}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      challenge.difficulty === "Easy"
                        ? "text-emerald-400"
                        : challenge.difficulty === "Medium"
                          ? "text-amber-400"
                          : "text-rose-400"
                    }`}
                  >
                    {challenge.difficulty || "Medium"}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
