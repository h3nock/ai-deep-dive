'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  getAllProgress,
  markStepComplete,
  markStepIncomplete,
  toggleStepComplete,
  updateCurrentStep,
  clearCourseProgress,
  type CourseProgress,
  type AllProgress,
} from './progress';

interface ProgressContextType {
  // State
  progress: AllProgress;
  isLoaded: boolean;
  
  // Actions
  markComplete: (courseId: string, step: number) => void;
  markIncomplete: (courseId: string, step: number) => void;
  toggleComplete: (courseId: string, step: number) => boolean;
  setCurrentStep: (courseId: string, step: number) => void;
  resetCourse: (courseId: string) => void;
  
  // Getters
  isComplete: (courseId: string, step: number) => boolean;
  getPercentage: (courseId: string, totalSteps: number) => number;
  getContinueStep: (courseId: string, allSteps: number[]) => number | null;
  getCourse: (courseId: string) => CourseProgress | null;
  getCompletedCount: (courseId: string) => number;
}

const ProgressContext = createContext<ProgressContextType | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<AllProgress>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load progress on mount
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setProgress(getAllProgress());
      setIsLoaded(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // Refresh progress from localStorage
  const refreshProgress = useCallback(() => {
    setProgress(getAllProgress());
  }, []);

  const markComplete = useCallback((courseId: string, step: number) => {
    markStepComplete(courseId, step);
    refreshProgress();
  }, [refreshProgress]);

  const markIncomplete = useCallback((courseId: string, step: number) => {
    markStepIncomplete(courseId, step);
    refreshProgress();
  }, [refreshProgress]);

  const toggleComplete = useCallback((courseId: string, step: number): boolean => {
    const result = toggleStepComplete(courseId, step);
    refreshProgress();
    return result;
  }, [refreshProgress]);

  const setCurrentStep = useCallback((courseId: string, step: number) => {
    const changed = updateCurrentStep(courseId, step);
    if (changed) {
      refreshProgress();
    }
  }, [refreshProgress]);

  const resetCourse = useCallback((courseId: string) => {
    clearCourseProgress(courseId);
    refreshProgress();
  }, [refreshProgress]);

  const isComplete = useCallback((courseId: string, step: number): boolean => {
    // Read from state instead of localStorage directly for reactivity
    const courseProgress = progress[courseId];
    return courseProgress?.completedSteps.includes(step) ?? false;
  }, [progress]);

  const getPercentage = useCallback((courseId: string, totalSteps: number): number => {
    const courseProgress = progress[courseId];
    if (!courseProgress || totalSteps === 0) return 0;
    return Math.round((courseProgress.completedSteps.length / totalSteps) * 100);
  }, [progress]);

  const getContinueStep = useCallback((courseId: string, allSteps: number[]): number | null => {
    const courseProgress = progress[courseId];
    if (!courseProgress) return allSteps[0] ?? null;
    
    // Find first incomplete step
    for (const step of allSteps) {
      if (!courseProgress.completedSteps.includes(step)) {
        return step;
      }
    }
    
    // All complete, return last step
    return allSteps[allSteps.length - 1] ?? null;
  }, [progress]);

  const getCourse = useCallback((courseId: string): CourseProgress | null => {
    return progress[courseId] || null;
  }, [progress]);

  const getCompletedCount = useCallback((courseId: string): number => {
    return progress[courseId]?.completedSteps.length ?? 0;
  }, [progress]);

  return (
    <ProgressContext.Provider
      value={{
        progress,
        isLoaded,
        markComplete,
        markIncomplete,
        toggleComplete,
        setCurrentStep,
        resetCourse,
        isComplete,
        getPercentage,
        getContinueStep,
        getCourse,
        getCompletedCount,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
}
