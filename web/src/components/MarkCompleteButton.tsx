'use client';

import { Check } from 'lucide-react';
import { useProgress } from '@/lib/progress-context';
import { cn } from '@/lib/utils';

interface MarkCompleteButtonProps {
  courseId: string;
  step: number;
  nextHref?: string;
  className?: string;
}

export function MarkCompleteButton({ 
  courseId, 
  step,
  nextHref,
  className 
}: MarkCompleteButtonProps) {
  const { isComplete, toggleComplete, isLoaded } = useProgress();
  
  const completed = isComplete(courseId, step);

  const handleClick = () => {
    toggleComplete(courseId, step);
  };

  if (!isLoaded) {
    return (
      <button 
        disabled 
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm text-slate-400",
          className
        )}
      >
        <div className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600" />
        <span>Mark as complete</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200",
        completed 
          ? "text-emerald-600 dark:text-emerald-400" 
          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50",
        className
      )}
    >
      <div className={cn(
        "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200",
        completed 
          ? "bg-emerald-500 dark:bg-emerald-400 border-emerald-500 dark:border-emerald-400" 
          : "border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:group-hover:border-slate-500"
      )}>
        {completed && (
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        )}
      </div>
      <span className={cn(
        "transition-colors",
        completed && "font-medium"
      )}>
        {completed ? 'Completed' : 'Mark as complete'}
      </span>
    </button>
  );
}
