"use client";

import { useCallback, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { ChallengeList } from "./ChallengeList";
import type { Challenge } from "@/lib/challenge-types";

export interface ChallengeWorkspaceProps {
  courseId: string;
  challenges: Challenge[];
  activeChallengeIndex?: number | null;
  setActiveChallengeIndex?: (index: number | null) => void;
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
  activeChallengeIndex: externalActiveIndex,
  setActiveChallengeIndex: externalSetActiveIndex,
}: ChallengeWorkspaceProps) {
  const [internalActiveIndex, setInternalActiveIndex] = useState<number | null>(
    null
  );
  // Track if editor has ever been shown - only mount after first selection
  const hasEverOpenedEditor = useRef(false);

  const activeChallengeIndex =
    externalActiveIndex !== undefined ? externalActiveIndex : internalActiveIndex;
  const setActiveChallengeIndex =
    externalSetActiveIndex || setInternalActiveIndex;

  // Track if we've ever opened any challenge (to avoid mounting editor prematurely)
  if (activeChallengeIndex !== null) {
    hasEverOpenedEditor.current = true;
  }

  const onSelectIndex = useCallback(
    (index: number) => setActiveChallengeIndex(index),
    [setActiveChallengeIndex]
  );

  const showList = activeChallengeIndex === null;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background border-t border-border overflow-hidden">
      {/* Challenge List - shown when no challenge selected */}
      {showList && (
        <div className="flex-1 overflow-hidden">
          <ChallengeList
            courseId={courseId}
            challenges={challenges}
            onSelectIndex={onSelectIndex}
          />
        </div>
      )}

      {/* Editor - kept mounted (but hidden) to preserve Monaco workers */}
      {/* Only mount after user has opened at least one challenge */}
      {hasEverOpenedEditor.current && (
        <div
          className={`flex-1 ${showList ? "hidden" : ""}`}
          aria-hidden={showList}
        >
          <ChallengeEditor
            courseId={courseId}
            challenges={challenges}
            activeChallengeIndex={activeChallengeIndex ?? 0}
            setActiveChallengeIndex={setActiveChallengeIndex}
          />
        </div>
      )}
    </div>
  );
}
