"use client";

import { useMemo } from "react";
import { useSelectedLayoutSegments } from "next/navigation";

import type { PostData } from "@/lib/posts";
import { StepContainer } from "@/components/StepContainer";

interface LessonRouteShellProps {
  post: Omit<PostData, "content">;
  prevPost: Omit<PostData, "content"> | null;
  nextPost: Omit<PostData, "content"> | null;
  collection: string;
  guideContent: React.ReactNode;
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function LessonRouteShell({
  post,
  prevPost,
  nextPost,
  collection,
  guideContent,
}: LessonRouteShellProps) {
  const segments = useSelectedLayoutSegments();

  const { view, challengeIndex } = useMemo(() => {
    if (segments[0] !== "challenges") {
      return { view: "guide" as const, challengeIndex: null };
    }

    if (!segments[1]) {
      return { view: "challenges" as const, challengeIndex: null };
    }

    const challengeId = decodeSegment(segments[1]);
    const index = post.challenges?.findIndex((challenge) => challenge.id === challengeId) ?? -1;

    return {
      view: "challenges" as const,
      challengeIndex: index >= 0 ? index : null,
    };
  }, [post.challenges, segments]);

  return (
    <StepContainer
      post={post}
      prevPost={prevPost}
      nextPost={nextPost}
      collection={collection}
      view={view}
      challengeIndex={challengeIndex}
    >
      {guideContent}
    </StepContainer>
  );
}
