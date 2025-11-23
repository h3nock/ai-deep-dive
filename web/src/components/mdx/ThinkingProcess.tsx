"use client";

import React, { useState } from "react";
import { Lightbulb, ChevronDown, ChevronRight, BrainCircuit } from "lucide-react";

interface ThinkingProcessProps {
  title?: string;
  hint?: React.ReactNode;
  children: React.ReactNode; // The answer/explanation
}

export function ThinkingProcess({ title = "Stop & Think", hint, children }: ThinkingProcessProps) {
  const [isHintOpen, setIsHintOpen] = useState(false);
  const [isAnswerOpen, setIsAnswerOpen] = useState(false);

  return (
    <div className="my-8 border border-amber-200 dark:border-amber-900/50 rounded-xl overflow-hidden bg-amber-50/50 dark:bg-amber-900/10">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {title}
          </h3>
          <div className="text-slate-700 dark:text-slate-300 prose dark:prose-invert max-w-none">
            {/* This is where the question usually goes, but in MDX usage, 
                the question is often before this component. 
                However, we can pass the question as children if we redesign.
                For now, let's assume this component WRAPS the answer, 
                and the question is just text above it. 
                
                Wait, the user's markdown has:
                > STOP & THINK
                > <details> Hint </details>
                > <details> Answer </details>
                
                So this component should probably replace that entire block.
            */}
            <p className="text-sm text-slate-600 dark:text-slate-400 italic">
              Take a moment to answer the questions above before revealing the solution.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {hint && (
          <div className="border-t border-amber-200/50 dark:border-amber-900/30 pt-2">
            <button
              onClick={() => setIsHintOpen(!isHintOpen)}
              className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
            >
              {isHintOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {isHintOpen ? "Hide Hint" : "Need a Hint?"}
            </button>
            
            {isHintOpen && (
              <div className="mt-2 pl-6 text-slate-700 dark:text-slate-300 text-sm animate-in fade-in slide-in-from-top-2">
                {hint}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-amber-200/50 dark:border-amber-900/30 pt-2">
          <button
            onClick={() => setIsAnswerOpen(!isAnswerOpen)}
            className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            {isAnswerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {isAnswerOpen ? "Hide Answer" : "Reveal Answer"}
          </button>

          {isAnswerOpen && (
            <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 prose dark:prose-invert max-w-none">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
