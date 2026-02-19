"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "./ProgressBar";
import { useProgress } from "@/lib/progress-context";

interface CourseCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  tags: string[];
  status: "available" | "coming-soon" | "planned";
  courseId?: string;
  totalSteps?: number;
}

export function CourseCard({
  title,
  description,
  icon,
  href,
  tags,
  status,
  courseId,
  totalSteps = 0,
}: CourseCardProps) {
  const isAvailable = status === "available";
  const Component = isAvailable && href ? Link : "div";
  const { getCompletedCount } = useProgress();

  const completedCount = courseId ? getCompletedCount(courseId) : 0;
  const hasProgress = completedCount > 0;

  return (
    <Component
      href={href || "#"}
      prefetch={true}
      className={cn(
        "group relative flex flex-col h-full bg-background rounded-xl border p-5 md:p-6",
        "card-glow",
        isAvailable 
          ? "card-glow-interactive border-border" 
          : "card-glow-disabled border-border/50 grayscale-[30%]"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            "w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-muted transition-colors duration-300",
            isAvailable && "group-hover:bg-border group-hover:text-primary"
          )}
        >
          {icon}
        </div>
        {status !== "available" && (
          <span className="px-2 py-1 rounded-md bg-surface text-xs font-medium text-muted">
            {status === "coming-soon" ? "Coming Soon" : "Planned"}
          </span>
        )}
      </div>

      <h3 className="text-lg font-semibold text-primary mb-2">{title}</h3>

      <p className="text-sm text-secondary leading-relaxed mb-4 flex-1">
        {description}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded bg-surface text-xs text-muted"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Progress Bar (only for available courses with progress) */}
      {isAvailable && courseId && totalSteps > 0 && (
        <div className="mb-4">
          <ProgressBar
            courseId={courseId}
            totalSteps={totalSteps}
            size="sm"
            showLabel={true}
            hideWhenEmpty={true}
          />
        </div>
      )}

      <div className="flex items-center text-sm font-medium pt-4 border-t border-border">
        {isAvailable ? (
          <span className="flex items-center text-secondary group-hover:text-primary transition-colors">
            {hasProgress ? "Continue" : "Start Building"}
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </span>
        ) : (
          <span className="flex items-center text-muted">
            <Lock className="w-4 h-4 mr-2" /> Locked
          </span>
        )}
      </div>
    </Component>
  );
}
