'use client';

import { useProgress } from '@/lib/progress-context';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  courseId: string;
  totalSteps: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  hideWhenEmpty?: boolean;
}

export function ProgressBar({ 
  courseId, 
  totalSteps, 
  className,
  showLabel = true,
  size = 'md',
  hideWhenEmpty = false,
}: ProgressBarProps) {
  const { getPercentage, getCompletedCount, isLoaded } = useProgress();
  
  const percentage = getPercentage(courseId, totalSteps);
  const completed = getCompletedCount(courseId);

  // Hide completely if no progress and hideWhenEmpty is true
  if (hideWhenEmpty && isLoaded && completed === 0) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {isLoaded ? `${completed} of ${totalSteps} completed` : ''}
          </span>
          {isLoaded && completed > 0 && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {percentage}%
            </span>
          )}
        </div>
      )}
      <div className={cn(
        "w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden",
        size === 'sm' ? 'h-1' : 'h-1.5'
      )}>
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            percentage === 100 
              ? "bg-emerald-500 dark:bg-emerald-400" 
              : "bg-slate-400 dark:bg-slate-500"
          )}
          style={{ width: isLoaded ? `${percentage}%` : '0%' }}
        />
      </div>
    </div>
  );
}
