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

export function StepContainer({ post, prevPost, nextPost, children, collection }: StepContainerProps) {
  const [activeTab, setActiveTab] = useState<'guide' | 'challenges'>('guide');
  const [activeChallengeIndex, setActiveChallengeIndex] = useState<number | null>(null);
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
        label: "Back to Project 1"
      };
    }
    if (post.slug.startsWith("p2-")) {
      return {
        href: `/${collection}/step/11-project-gpt`,
        label: "Back to Project 2"
      };
    }
    return {
      href: `/${collection}`,
      label: "Back to Roadmap"
    };
  };

  const backLink = getBackLink();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-blue-500/20">
      
      <div className="flex h-screen">
        {/* Main Content Area - Full Width for Guide */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950 overflow-y-auto">
          
          {/* Tab Header (Only if challenges exist) */}
          {hasChallenges && (
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6">
              <div className="max-w-5xl mx-auto flex gap-6">
                <button
                  onClick={() => setActiveTab('guide')}
                  className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'guide'
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Guide
                </button>
                <button
                  onClick={() => {
                    setActiveTab('challenges');
                    setActiveChallengeIndex(null);
                  }}
                  className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'challenges'
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  <Code2 className="w-4 h-4" />
                  Challenges
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs">
                    {post.challenges?.length}
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'guide' ? (
            <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
              
              {/* Header */}
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-6 text-sm text-slate-500 dark:text-slate-400">
                  <Link href={backLink.href} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4" />
                    {backLink.label}
                  </Link>
                  <span className="text-slate-300 dark:text-slate-700">/</span>
                  <span className="uppercase tracking-wider font-mono text-xs">Step {(post.step?.toString() || '0').padStart(2, '0')}</span>
                </div>

                <div className="flex items-start justify-between gap-8">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
                      {post.title}
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                      {post.description}
                    </p>
                  </div>
                  <Link href={backLink.href} className="hidden md:flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors" title={backLink.label}>
                    <BookOpen className="w-6 h-6" />
                  </Link>
                </div>
              </div>

              {/* Content */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 shadow-sm prose prose-lg prose-slate dark:prose-invert max-w-none">
                {children}
              </div>

              {/* Footer: Mark Complete + Navigation */}
              <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
                {/* Mark Complete - subtle, left-aligned */}
                <div className="mb-8">
                  <MarkCompleteButton 
                    courseId={collection} 
                    step={post.step || 0}
                    nextHref={nextPost ? `/${collection}/step/${nextPost.slug}` : undefined}
                  />
                </div>

                {/* Navigation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prevPost ? (
                  <Link 
                    href={`/${collection}/step/${prevPost.slug}`}
                    className="group flex flex-col p-5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                  >
                    <span className="text-xs font-mono text-slate-400 mb-2 flex items-center gap-1">
                      <ChevronLeft className="w-3 h-3" /> Previous
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                      {prevPost.title}
                    </span>
                  </Link>
                ) : <div />}

                {nextPost ? (
                  <Link 
                    href={`/${collection}/step/${nextPost.slug}`}
                    className="group flex flex-col items-end text-right p-5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                  >
                    <span className="text-xs font-mono text-slate-400 mb-2 flex items-center gap-1">
                      Next <ChevronRight className="w-3 h-3" />
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                      {nextPost.title}
                    </span>
                  </Link>
                ) : <div />}
                </div>
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
