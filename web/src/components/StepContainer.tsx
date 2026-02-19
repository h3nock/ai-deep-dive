"use client";

import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PostData } from "@/lib/posts";
import { getCourseConfig } from "@/lib/course-config";
import { CourseSidebar } from "./CourseSidebar";
import { MarkCompleteButton } from "./MarkCompleteButton";
import { ThemeToggle } from "./ThemeToggle";
import { CodeBlockCopyButtons } from "./CodeBlockCopyButton";
import { useProgress } from "@/lib/progress-context";
import { useChallengeProgress } from "@/lib/use-challenge-progress";
import type { ChallengeWorkspaceProps } from "./ChallengeWorkspace";
import {
  lessonChallengePath,
  lessonChallengesPath,
  lessonGuidePath,
} from "@/lib/lesson-routes";

const ChallengeWorkspace = dynamic<ChallengeWorkspaceProps>(
  () => import("./ChallengeWorkspace").then((mod) => mod.ChallengeWorkspace),
  {
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <div className="space-y-3 w-64">
          <div className="h-3 bg-surface rounded animate-pulse" />
          <div className="h-3 bg-surface rounded animate-pulse w-3/4" />
          <div className="h-3 bg-surface rounded animate-pulse w-1/2" />
        </div>
      </div>
    ),
  }
);

interface StepContainerProps {
  post: Omit<PostData, "content">;
  prevPost: Omit<PostData, "content"> | null;
  nextPost: Omit<PostData, "content"> | null;
  allPosts: Omit<PostData, "content">[];
  children: React.ReactNode; // The rendered MDX guide
  collection: string;
  view: "guide" | "challenges";
  challengeIndex: number | null;
}

function ArticleWithCopyButtons({ children }: { children: React.ReactNode }) {
  const articleRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <article
      ref={articleRef}
      className="prose prose-lg prose-invert max-w-none [&_table]:w-full"
    >
      {children}
      {mounted && <CodeBlockCopyButtons containerRef={articleRef} />}
    </article>
  );
}

export function StepContainer({
  post,
  prevPost,
  nextPost,
  allPosts,
  children,
  collection,
  view,
  challengeIndex,
}: StepContainerProps) {
  const router = useRouter();
  const activeTab = view;
  const activeChallengeIndex = challengeIndex;

  const hasChallenges = post.challenges && post.challenges.length > 0;
  const guideHref = lessonGuidePath(collection, post.slug);
  const challengesHref = lessonChallengesPath(collection, post.slug);
  const prefetchedChallengeRouteSetRef = useRef<Set<string>>(new Set());
  const challengeIds = useMemo(
    () => post.challenges?.map((c) => c.id) ?? [],
    [post.challenges]
  );
  const {
    solvedCount: solvedChallenges,
    total: totalChallenges,
    isLoaded: isChallengesLoaded,
  } = useChallengeProgress(collection, challengeIds);
  const { setCurrentStep } = useProgress();
  const warmChallengeHandleRef = useRef<
    { kind: "idle"; id: number } | { kind: "timeout"; id: number } | null
  >(null);

  const cancelWarmChallengeResources = useCallback(() => {
    const handle = warmChallengeHandleRef.current;
    if (!handle) {
      return;
    }

    warmChallengeHandleRef.current = null;
    if (handle.kind === "idle") {
      window.cancelIdleCallback?.(handle.id);
      return;
    }

    window.clearTimeout(handle.id);
  }, []);

  const warmChallengeTabResources = useCallback(
    (mode: "idle" | "now") => {
      if (typeof window === "undefined") return;

      const run = () => {
        warmChallengeHandleRef.current = null;
        void import("./ChallengeWorkspace");
        void import("./ChallengeEditor");
      };

      if (mode === "now") {
        cancelWarmChallengeResources();
        run();
        return;
      }

      if (warmChallengeHandleRef.current) {
        return;
      }

      const ric = window.requestIdleCallback;
      if (ric) {
        const id = ric(run, { timeout: 1500 });
        warmChallengeHandleRef.current = { kind: "idle", id };
        return;
      }

      const id = window.setTimeout(run, 300);
      warmChallengeHandleRef.current = { kind: "timeout", id };
    },
    [cancelWarmChallengeResources]
  );

  const prefetchChallengeIndex = useCallback(
    (index: number) => {
      if (!hasChallenges) {
        return;
      }

      const challengeId = post.challenges?.[index]?.id;
      if (!challengeId) {
        return;
      }

      if (prefetchedChallengeRouteSetRef.current.has(challengeId)) {
        return;
      }
      prefetchedChallengeRouteSetRef.current.add(challengeId);
      router.prefetch(lessonChallengePath(collection, post.slug, challengeId));
    },
    [collection, hasChallenges, post.challenges, post.slug, router]
  );

  useEffect(() => {
    prefetchedChallengeRouteSetRef.current.clear();
  }, [collection, post.slug]);

  const handleChallengeIndexChange = useCallback(
    (index: number | null) => {
      if (!hasChallenges) {
        return;
      }

      if (index === null) {
        router.push(challengesHref, { scroll: false });
        return;
      }

      const challengeId = post.challenges?.[index]?.id;
      if (!challengeId) {
        return;
      }

      router.push(lessonChallengePath(collection, post.slug, challengeId), {
        scroll: false,
      });
    },
    [challengesHref, collection, hasChallenges, post.challenges, post.slug, router]
  );

  // Track current step when viewing a chapter
  useEffect(() => {
    if (post.step) {
      setCurrentStep(collection, post.step);
    }
  }, [collection, post.step, setCurrentStep]);

  useEffect(() => {
    if (activeTab !== "challenges" || !hasChallenges) return;
    warmChallengeTabResources("idle");
    return cancelWarmChallengeResources;
  }, [
    activeTab,
    cancelWarmChallengeResources,
    hasChallenges,
    warmChallengeTabResources,
  ]);

  useEffect(() => {
    if (activeTab !== "challenges" || !hasChallenges) return;
    // Only prefetch from the list view to avoid prefetch churn while switching challenges.
    if (activeChallengeIndex !== null) return;
    prefetchChallengeIndex(0);
  }, [activeChallengeIndex, activeTab, hasChallenges, prefetchChallengeIndex]);

  // Smart Back Link Logic
  const getBackLink = () => {
    if (post.slug.startsWith("p1-")) {
      return {
        href: `/${collection}/09-project-translator`,
        label: "Back to Project 1",
      };
    }
    if (post.slug.startsWith("p2-")) {
      return {
        href: `/${collection}/11-project-gpt`,
        label: "Back to Project 2",
      };
    }
    return {
      href: `/${collection}`,
      label: "Back to Roadmap",
    };
  };

  const backLink = getBackLink();

  const courseConfig = getCourseConfig(collection);
  const phases = courseConfig?.phases ?? [];

  return (
    <div className="min-h-screen bg-background text-secondary font-sans selection:bg-muted/20">
      <div className="flex h-screen">
        {/* Sidebar — desktop only */}
        <CourseSidebar
          allPosts={allPosts}
          collection={collection}
          currentSlug={post.slug}
          phases={phases}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto">
          {/* Reading progress bar */}
          <div className="reading-progress" />

          {/* Top Bar */}
          <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-6">
            <div className="max-w-5xl mx-auto flex items-center py-2">
              {hasChallenges ? (
                <div className="inline-flex rounded-full border border-border p-1 bg-background">
                  <Link
                    href={guideHref}
                    prefetch
                    className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                      activeTab === "guide"
                        ? "bg-surface font-medium text-primary"
                        : "text-muted hover:text-secondary"
                    }`}
                  >
                    Guide
                  </Link>
                  <Link
                    href={challengesHref}
                    prefetch
                    className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                      activeTab === "challenges"
                        ? "bg-surface font-medium text-primary"
                        : "text-muted hover:text-secondary"
                    }`}
                  >
                    Challenges
                    <span className="ml-1.5 text-muted">
                      {isChallengesLoaded
                        ? `${solvedChallenges}/${totalChallenges}`
                        : `0/${totalChallenges}`}
                    </span>
                  </Link>
                </div>
              ) : (
                <div className="flex-1" />
              )}
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            </div>
          </div>

          {activeTab === "guide" ? (
            <main className="flex-1 w-full py-12">
              {/* Centered Content Column with Responsive Gutter */}
              <div className="mx-auto max-w-[75ch] px-6 lg:px-8">
                {/* Header */}
                <header className="animate-fade-in-up mb-12 pb-8 border-b border-border">
                  <Link
                    href={backLink.href}
                    prefetch={true}
                    className="text-sm text-muted hover:text-primary flex items-center gap-1 mb-6 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {backLink.label}
                  </Link>
                  <span className="text-7xl font-bold text-border/30 font-mono leading-none select-none">
                    {(post.step?.toString() || "0").padStart(2, "0")}
                  </span>
                  <h1 className="text-3xl md:text-4xl font-bold text-primary mt-3 mb-4 tracking-tight">
                    {post.title}
                  </h1>
                  <p className="text-lg text-muted leading-relaxed">
                    {post.description}
                  </p>
                </header>

                {/* Content - The Reading Rail */}
                <ArticleWithCopyButtons>
                  {children}
                </ArticleWithCopyButtons>

                {/* Footer: Mark Complete + Navigation */}
                <footer className="mt-12 pt-8 border-t border-border">
                  {/* Mark Complete - subtle, left-aligned */}
                  <div className="mb-8">
                    <MarkCompleteButton
                      courseId={collection}
                      step={post.step || 0}
                      nextHref={
                        nextPost
                          ? `/${collection}/${nextPost.slug}`
                          : undefined
                      }
                    />
                  </div>

                  {/* Navigation — asymmetric: prev subtle, next prominent */}
                  <div className="flex items-start justify-between gap-4">
                    {prevPost ? (
                      <Link
                        href={`/${collection}/${prevPost.slug}`}
                        prefetch={true}
                        className="group flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors shrink-0"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>{prevPost.title}</span>
                      </Link>
                    ) : (
                      <div />
                    )}

                    {nextPost && (
                      <Link
                        href={`/${collection}/${nextPost.slug}`}
                        prefetch={true}
                        className="group flex flex-col items-end text-right p-5 rounded-xl bg-surface/50 border border-border hover:border-border-hover transition-all ml-auto max-w-xs"
                      >
                        <span className="text-xs font-mono text-muted mb-2 flex items-center gap-1">
                          Next Chapter <ChevronRight className="w-3 h-3" />
                        </span>
                        <span className="font-medium text-primary group-hover:text-secondary transition-colors">
                          {nextPost.title}
                        </span>
                      </Link>
                    )}
                  </div>
                </footer>
              </div>
            </main>
          ) : (
            <ChallengeWorkspace
              courseId={collection}
              challenges={post.challenges || []}
              activeChallengeIndex={activeChallengeIndex}
              setActiveChallengeIndex={handleChallengeIndexChange}
              prefetchChallengeIndex={prefetchChallengeIndex}
            />
          )}
        </div>
      </div>
    </div>
  );
}
