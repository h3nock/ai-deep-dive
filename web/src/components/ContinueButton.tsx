'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useProgress } from '@/lib/progress-context';
import { cn } from '@/lib/utils';

interface ContinueButtonProps {
  courseId: string;
  allSteps: number[];
  slugMap: Record<number, string>; // step -> slug
  className?: string;
}

export function ContinueButton({ 
  courseId, 
  allSteps, 
  slugMap,
  className 
}: ContinueButtonProps) {
  const { getContinueStep, getCompletedCount, isLoaded } = useProgress();
  
  const nextStep = getContinueStep(courseId, allSteps);
  const completedCount = getCompletedCount(courseId);
  const isAllComplete = completedCount === allSteps.length && allSteps.length > 0;

  if (!isLoaded) {
    return (
      <div className={cn(
        "inline-flex items-center px-6 py-3 rounded-lg bg-slate-100 dark:bg-slate-800",
        className
      )}>
        <span className="text-slate-400">Loading...</span>
      </div>
    );
  }

  const slug = nextStep ? slugMap[nextStep] : slugMap[allSteps[0]];
  
  if (!slug) return null;

  // All complete - subtle, not attention-grabbing
  if (isAllComplete) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">Course completed</span>
        </div>
        <Link
          href={`/${courseId}/step/${slugMap[allSteps[0]]}`}
          className={cn(
            "inline-flex items-center px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors",
            className
          )}
        >
          Review from start
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>
    );
  }

  const buttonText = completedCount === 0 ? 'Start Learning' : 'Continue Learning';

  return (
    <Link
      href={`/${courseId}/step/${slug}`}
      className={cn(
        "inline-flex items-center px-6 py-3 rounded-lg bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium transition-colors",
        className
      )}
    >
      {buttonText}
      <ArrowRight className="w-4 h-4 ml-2" />
    </Link>
  );
}
