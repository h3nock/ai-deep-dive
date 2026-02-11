// Progress tracking using localStorage
// No auth required - perfect for open source and try-before-signup flow

export interface CourseProgress {
  completedSteps: number[];
  lastVisited: string; // ISO date string
  currentStep: number;
}

export interface AllProgress {
  [courseId: string]: CourseProgress;
}

const STORAGE_KEY = "course-progress";

// Get all progress data
export function getAllProgress(): AllProgress {
  if (typeof window === "undefined") return {};

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Get progress for a specific course
export function getCourseProgress(courseId: string): CourseProgress | null {
  const all = getAllProgress();
  return all[courseId] || null;
}

// Save progress for a course
function saveProgress(courseId: string, progress: CourseProgress): void {
  if (typeof window === "undefined") return;

  try {
    const all = getAllProgress();
    all[courseId] = progress;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    console.error("Failed to save progress:", error);
  }
}

// Mark a step as complete
export function markStepComplete(courseId: string, step: number): void {
  const progress = getCourseProgress(courseId) || {
    completedSteps: [],
    lastVisited: new Date().toISOString(),
    currentStep: step,
  };

  if (!progress.completedSteps.includes(step)) {
    progress.completedSteps.push(step);
    progress.completedSteps.sort((a, b) => a - b);
  }

  progress.lastVisited = new Date().toISOString();
  saveProgress(courseId, progress);
}

// Mark a step as incomplete
export function markStepIncomplete(courseId: string, step: number): void {
  const progress = getCourseProgress(courseId);
  if (!progress) return;

  progress.completedSteps = progress.completedSteps.filter((s) => s !== step);
  progress.lastVisited = new Date().toISOString();
  saveProgress(courseId, progress);
}

// Toggle step completion
export function toggleStepComplete(courseId: string, step: number): boolean {
  const progress = getCourseProgress(courseId);
  const isCompleted = progress?.completedSteps.includes(step) ?? false;

  if (isCompleted) {
    markStepIncomplete(courseId, step);
    return false;
  } else {
    markStepComplete(courseId, step);
    return true;
  }
}

// Check if a step is complete
export function isStepComplete(courseId: string, step: number): boolean {
  const progress = getCourseProgress(courseId);
  return progress?.completedSteps.includes(step) ?? false;
}

// Update current step (for "continue where you left off")
// Returns true only when persisted data actually changes.
export function updateCurrentStep(courseId: string, step: number): boolean {
  const existing = getCourseProgress(courseId);
  if (existing && existing.currentStep === step) {
    return false;
  }

  const progress = existing || {
    completedSteps: [],
    lastVisited: new Date().toISOString(),
    currentStep: step,
  };

  progress.currentStep = step;
  progress.lastVisited = new Date().toISOString();
  saveProgress(courseId, progress);
  return true;
}

// Get completion percentage
export function getCompletionPercentage(
  courseId: string,
  totalSteps: number
): number {
  const progress = getCourseProgress(courseId);
  if (!progress || totalSteps === 0) return 0;

  return Math.round((progress.completedSteps.length / totalSteps) * 100);
}

// Clear progress for a specific course
export function clearCourseProgress(courseId: string): void {
  const all = getAllProgress();
  delete all[courseId];
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
