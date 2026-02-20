"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ChallengeList } from "./ChallengeList";
import type { Challenge } from "@/lib/challenge-types";

export interface ChallengeWorkspaceProps {
  courseId: string;
  challenges: Challenge[];
  activeChallengeIndex: number | null;
  setActiveChallengeIndex: (index: number | null) => void;
  prefetchChallengeIndex?: (index: number) => void;
}

const ChallengeEditor = dynamic(
  () => import("./ChallengeEditor").then((mod) => mod.ChallengeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center text-muted">
        Loading editor...
      </div>
    ),
  }
);

export function ChallengeWorkspace({
  courseId,
  challenges,
  activeChallengeIndex,
  setActiveChallengeIndex,
  prefetchChallengeIndex,
}: ChallengeWorkspaceProps) {
  const [editorMounted, setEditorMounted] = useState(
    activeChallengeIndex !== null
  );
  const [cachedChallengeIndex, setCachedChallengeIndex] = useState<number | null>(
    activeChallengeIndex
  );

  useEffect(() => {
    if (activeChallengeIndex === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setEditorMounted(true);
      setCachedChallengeIndex(activeChallengeIndex);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeChallengeIndex]);

  const onSelectIndex = useCallback(
    (index: number) => {
      setEditorMounted(true);
      setCachedChallengeIndex(index);
      setActiveChallengeIndex(index);
    },
    [setActiveChallengeIndex]
  );

  const editorChallengeIndex = activeChallengeIndex ?? cachedChallengeIndex;
  const showList = activeChallengeIndex === null;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Challenge List - shown when no challenge selected */}
      {showList && (
        <div className="flex-1 overflow-hidden">
          <ChallengeList
            courseId={courseId}
            challenges={challenges}
            onSelectIndex={onSelectIndex}
            onPrefetchIndex={prefetchChallengeIndex}
          />
        </div>
      )}

      {editorMounted && editorChallengeIndex !== null && (
        <div
          className={`flex-1 flex flex-col min-h-0 ${showList ? "hidden" : ""}`}
          aria-hidden={showList}
        >
          <ChallengeEditor
            courseId={courseId}
            challenges={challenges}
            activeChallengeIndex={editorChallengeIndex}
            setActiveChallengeIndex={setActiveChallengeIndex}
          />
        </div>
      )}
    </div>
  );
}
