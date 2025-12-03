"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "./Navbar";
import Link from "next/link";
import { ChevronLeft, ChevronRight, BookOpen, Code2 } from "lucide-react";
import { PostData } from "@/lib/posts";
import { ChallengeWorkspace } from "./ChallengeWorkspace";
import { MarkCompleteButton } from "./MarkCompleteButton";
import { useProgress } from "@/lib/progress-context";

interface StepContainerProps {
  post: PostData;
  prevPost: Omit<PostData, "content"> | null;
  nextPost: Omit<PostData, "content"> | null;
  children: React.ReactNode; // The rendered MDX guide
  collection: string;
}

export function StepContainer({
  post,
  prevPost,
  nextPost,
  children,
  collection,
}: StepContainerProps) {
  const [activeTab, setActiveTab] = useState<"guide" | "challenges">("guide");
  const [activeChallengeIndex, setActiveChallengeIndex] = useState<
    number | null
  >(null);
  const hasChallenges = post.challenges && post.challenges.length > 0;
  const { setCurrentStep } = useProgress();

  // Track current step when viewing a chapter
  useEffect(() => {
    if (post.step) {
      setCurrentStep(collection, post.step);
    }
  }, [collection, post.step, setCurrentStep]);

  // Smart Back Link Logic
  const getBackLink = () => {
    if (post.slug.startsWith("p1-")) {
      return {
        href: `/${collection}/step/09-project-translator`,
        label: "Back to Project 1",
      };
    }
    if (post.slug.startsWith("p2-")) {
      return {
        href: `/${collection}/step/11-project-gpt`,
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
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6">
              <div className="max-w-5xl mx-auto flex gap-6">
                <button
                  onClick={() => setActiveTab("guide")}
                  className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "guide"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-secondary"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Guide
                </button>
                <button
                  onClick={() => {
                    setActiveTab("challenges");
                    setActiveChallengeIndex(null);
                  }}
                  className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === "challenges"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-secondary"
                  }`}
                >
                  <Code2 className="w-4 h-4" />
                  Challenges
                  <span className="px-2 py-0.5 rounded-full bg-surface text-xs">
                    {post.challenges?.length}
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
                      <BookOpen className="w-5 h-5" />
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
                          ? `/${collection}/step/${nextPost.slug}`
                          : undefined
                      }
                    />
                  </div>

                  {/* Navigation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {prevPost ? (
                      <Link
                        href={`/${collection}/step/${prevPost.slug}`}
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
                        href={`/${collection}/step/${nextPost.slug}`}
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
              setActiveChallengeIndex={setActiveChallengeIndex}
            />
          )}
        </div>
      </div>
    </div>
  );
}
