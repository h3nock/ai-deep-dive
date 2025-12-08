"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Map } from "lucide-react";
import { PostData } from "@/lib/posts";
import { ChallengeWorkspace } from "./ChallengeWorkspace";
import { MarkCompleteButton } from "./MarkCompleteButton";
import { useProgress } from "@/lib/progress-context";
import { preloadMonaco } from "@/lib/monaco-preload";

interface StepContainerProps {
  post: PostData;
  prevPost: Omit<PostData, "content"> | null;
  nextPost: Omit<PostData, "content"> | null;
  children: React.ReactNode; // The rendered MDX guide
  collection: string;
  initialTab?: "guide" | "challenges";
  initialChallengeIndex?: number | null;
}

export function StepContainer({
  post,
  prevPost,
  nextPost,
  children,
  collection,
  initialTab = "guide",
  initialChallengeIndex = null,
}: StepContainerProps) {
  const pathname = usePathname();

  // State is the source of truth - initialized from server props to prevent flash
  const [activeTab, setActiveTab] = useState<"guide" | "challenges">(initialTab);
  const [activeChallengeIndex, setActiveChallengeIndex] = useState<number | null>(
    initialChallengeIndex
  );

  const hasChallenges = post.challenges && post.challenges.length > 0;
  const { setCurrentStep } = useProgress();

  // Track if we should sync state to URL (skip initial mount)
  const shouldSyncToUrl = useRef(false);

  // Sync state TO URL when state changes (after initial mount)
  // Uses history.replaceState for instant URL update (no Next.js navigation overhead)
  useEffect(() => {
    if (!shouldSyncToUrl.current) {
      shouldSyncToUrl.current = true;
      return;
    }

    const params = new URLSearchParams();

    if (activeTab === "challenges") {
      params.set("view", "challenges");
      if (activeChallengeIndex !== null) {
        params.set("c", activeChallengeIndex.toString());
      }
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    // Use history.replaceState for instant URL update (no navigation)
    window.history.replaceState(null, "", newUrl);
  }, [activeTab, activeChallengeIndex, pathname]);

  // Sync state FROM URL when browser navigates (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");
      const cParam = params.get("c");

      const newTab = viewParam === "challenges" && hasChallenges ? "challenges" : "guide";
      setActiveTab(newTab);

      if (cParam !== null && hasChallenges) {
        const parsed = parseInt(cParam, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < post.challenges!.length) {
          setActiveChallengeIndex(parsed);
        } else {
          setActiveChallengeIndex(null);
        }
      } else {
        setActiveChallengeIndex(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasChallenges, post.challenges?.length]);

  // Simple handlers that just update state
  const handleTabChange = useCallback((tab: "guide" | "challenges") => {
    setActiveTab(tab);
    // Always clear challenge index when switching tabs
    // (going to guide = no challenge, going to challenges = show list)
    setActiveChallengeIndex(null);
  }, []);

  const handleChallengeIndexChange = useCallback((index: number | null) => {
    setActiveChallengeIndex(index);
  }, []);

  // Track current step when viewing a chapter
  useEffect(() => {
    if (post.step) {
      setCurrentStep(collection, post.step);
    }
  }, [collection, post.step, setCurrentStep]);

  // Preload Monaco editor - run immediately for faster load
  // When starting on challenges tab, Monaco will already be loading
  useEffect(() => {
    if (hasChallenges) {
      preloadMonaco();
    }
  }, [hasChallenges]);

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

  return (
    <div className="min-h-screen bg-background text-secondary font-sans selection:bg-zinc-500/20">
      <div className="flex h-screen">
        {/* Main Content Area - Full Width for Guide */}
        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto">
          {/* Tab Header (Only if challenges exist) */}
          {hasChallenges && (
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-6">
              <div className="max-w-5xl mx-auto flex gap-6">
                <button
                  onClick={() => handleTabChange("guide")}
                  className={`py-4 text-sm font-semibold tracking-wide border-b-2 transition-colors ${
                    activeTab === "guide"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-secondary"
                  }`}
                >
                  Guide
                </button>
                <button
                  onClick={() => handleTabChange("challenges")}
                  className={`py-4 text-sm font-semibold tracking-wide border-b-2 transition-colors ${
                    activeTab === "challenges"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-secondary"
                  }`}
                >
                  Challenges
                  <span className="ml-1.5 text-muted">
                    ({post.challenges?.length})
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "guide" ? (
            <main className="flex-1 w-full py-12">
              {/* Centered Content Column with Responsive Gutter */}
              <div className="mx-auto max-w-[85ch] px-6 lg:px-8">
                {/* Header */}
                <header className="mb-12 border-b border-border pb-8">
                  <div className="flex items-center gap-3 mb-6 text-sm text-muted">
                    <Link
                      href={backLink.href}
                      className="hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {backLink.label}
                    </Link>
                    <span className="text-border">/</span>
                    <span className="uppercase tracking-wider font-mono text-xs">
                      Step {(post.step?.toString() || "0").padStart(2, "0")}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <h1 className="text-3xl md:text-4xl font-bold text-primary mb-4 tracking-tight">
                        {post.title}
                      </h1>
                      <p className="text-lg text-muted leading-relaxed">
                        {post.description}
                      </p>
                    </div>
                    <Link
                      href={backLink.href}
                      className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg border border-border text-muted hover:text-primary hover:border-zinc-600 transition-colors shrink-0"
                      title={backLink.label}
                    >
                      <Map className="w-5 h-5" />
                    </Link>
                  </div>
                </header>

                {/* Content - The Reading Rail */}
                <article
                  className="prose prose-lg prose-invert max-w-none
                  [&_table]:w-full
                "
                >
                  {children}
                </article>

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

                  {/* Navigation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {prevPost ? (
                      <Link
                        href={`/${collection}/${prevPost.slug}`}
                        className="group flex flex-col p-5 rounded-xl border border-border hover:border-zinc-600 hover:bg-surface transition-all"
                      >
                        <span className="text-xs font-mono text-muted mb-2 flex items-center gap-1">
                          <ChevronLeft className="w-3 h-3" /> Previous
                        </span>
                        <span className="font-medium text-primary group-hover:text-secondary transition-colors">
                          {prevPost.title}
                        </span>
                      </Link>
                    ) : (
                      <div />
                    )}

                    {nextPost ? (
                      <Link
                        href={`/${collection}/${nextPost.slug}`}
                        className="group flex flex-col items-end text-right p-5 rounded-xl border border-border hover:border-zinc-600 hover:bg-surface transition-all"
                      >
                        <span className="text-xs font-mono text-muted mb-2 flex items-center gap-1">
                          Next <ChevronRight className="w-3 h-3" />
                        </span>
                        <span className="font-medium text-primary group-hover:text-secondary transition-colors">
                          {nextPost.title}
                        </span>
                      </Link>
                    ) : (
                      <div />
                    )}
                  </div>
                </footer>
              </div>
            </main>
          ) : (
            <ChallengeWorkspace
              challenges={post.challenges || []}
              activeChallengeIndex={activeChallengeIndex}
              setActiveChallengeIndex={handleChallengeIndexChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
