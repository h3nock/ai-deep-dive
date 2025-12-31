"use client";

import { useCallback, useState } from "react";
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

  const activeChallengeIndex =
    externalActiveIndex !== undefined ? externalActiveIndex : internalActiveIndex;
  const setActiveChallengeIndex =
    externalSetActiveIndex || setInternalActiveIndex;

  const onSelectIndex = useCallback(
    (index: number) => setActiveChallengeIndex(index),
    [setActiveChallengeIndex]
  );

  if (activeChallengeIndex === null) {
    return (
      <div className="flex h-[calc(100vh-4rem)] bg-background border-t border-border overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ChallengeList
            courseId={courseId}
            challenges={challenges}
            onSelectIndex={onSelectIndex}
          />
        </div>
      </div>
    );
  }

  return (
    <ChallengeEditor
      courseId={courseId}
      challenges={challenges}
      activeChallengeIndex={activeChallengeIndex}
      setActiveChallengeIndex={setActiveChallengeIndex}
    />
  );
}
