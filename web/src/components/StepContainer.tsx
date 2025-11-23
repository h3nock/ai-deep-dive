"use client";

import React from "react";
import { Navbar } from "./Navbar";
import Link from "next/link";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { PostData } from "@/lib/posts";

interface StepContainerProps {
  post: PostData;
  prevPost: Omit<PostData, "content"> | null;
  nextPost: Omit<PostData, "content"> | null;
  children: React.ReactNode; // The rendered MDX guide
  collection: string;
}

export function StepContainer({ post, prevPost, nextPost, children, collection }: StepContainerProps) {
  
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
      <Navbar />
      
      <div className="flex h-[calc(100vh-4rem)] pt-16">
        {/* Main Content Area - Full Width for Guide */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950 overflow-y-auto">
          
          <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
            
            {/* Header */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6 text-sm text-slate-500 dark:text-slate-400">
                <Link href={backLink.href} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" />
                  {backLink.label}
                </Link>
                <span className="text-slate-300 dark:text-slate-700">/</span>
                <span className="uppercase tracking-wider font-mono text-xs">Step {post.step.toString().padStart(2, '0')}</span>
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 shadow-sm">
              {children}
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
              {prevPost ? (
                <Link 
                  href={`/${collection}/step/${prevPost.slug}`}
                  className="group flex flex-col p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
                >
                  <span className="text-xs font-mono text-slate-400 mb-2 flex items-center gap-1">
                    <ChevronLeft className="w-3 h-3" /> Previous Step
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {prevPost.title}
                  </span>
                </Link>
              ) : <div />}

              {nextPost ? (
                <Link 
                  href={`/${collection}/step/${nextPost.slug}`}
                  className="group flex flex-col items-end text-right p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
                >
                  <span className="text-xs font-mono text-slate-400 mb-2 flex items-center gap-1">
                    Next Step <ChevronRight className="w-3 h-3" />
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {nextPost.title}
                  </span>
                </Link>
              ) : <div />}
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
