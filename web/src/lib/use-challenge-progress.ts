"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CHALLENGE_PROGRESS_EVENT,
  clearChallengeStorageCache,
  isChallengeSolved,
  type ChallengeProgressEventDetail,
} from "@/lib/challenge-storage";

export function useChallengeProgress(courseId: string, challengeIds: string[]) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);

  const stableIds = useMemo(() => challengeIds.slice(), [challengeIds]);
  const stableIdSet = useMemo(() => new Set(stableIds), [stableIds]);

  const recompute = useCallback(() => {
    if (typeof window === "undefined") return;

    let nextSolved = 0;
    for (const id of stableIds) {
      if (isChallengeSolved(courseId, id)) {
        nextSolved++;
      }
    }
    setSolvedCount(nextSolved);
  }, [courseId, stableIds]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      recompute();
      setIsLoaded(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [recompute]);

  useEffect(() => {
    const onProgressChanged = (event: Event) => {
      if (event.type === "storage") {
        const storageEvent = event as StorageEvent;
        if (storageEvent.key) {
          const prefix = `challenge:${courseId}:`;
          const isStatusKey =
            storageEvent.key.startsWith(prefix) &&
            storageEvent.key.endsWith(":status");

          if (!isStatusKey) {
            return;
          }

          const challengeId = storageEvent.key.slice(
            prefix.length,
            storageEvent.key.length - ":status".length
          );
          if (!stableIdSet.has(challengeId)) {
            return;
          }
        }

        // localStorage changed in another tab; clear caches before recompute
        clearChallengeStorageCache();
        recompute();
        return;
      }

      const maybeCustom = event as CustomEvent<ChallengeProgressEventDetail>;
      const detail = maybeCustom.detail;
      if (detail?.courseId && detail.courseId !== courseId) return;

      if (detail?.challengeId && !stableIdSet.has(detail.challengeId)) return;

      if (
        detail?.challengeIds &&
        detail.challengeIds.length > 0 &&
        !detail.challengeIds.some((id) => stableIdSet.has(id))
      ) {
        return;
      }

      recompute();
    };

    window.addEventListener(CHALLENGE_PROGRESS_EVENT, onProgressChanged);
    window.addEventListener("storage", onProgressChanged);
    return () => {
      window.removeEventListener(CHALLENGE_PROGRESS_EVENT, onProgressChanged);
      window.removeEventListener("storage", onProgressChanged);
    };
  }, [courseId, recompute, stableIdSet]);

  const total = stableIds.length;
  const percentage = total === 0 ? 0 : Math.round((solvedCount / total) * 100);

  return { solvedCount, total, percentage, isLoaded };
}
