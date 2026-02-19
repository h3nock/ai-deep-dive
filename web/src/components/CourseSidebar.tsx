"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChapterCheckbox } from "./ChapterCheckbox";
import type { PostData } from "@/lib/posts";
import type { CoursePhase } from "@/lib/course-config";

interface CourseSidebarProps {
  allPosts: Omit<PostData, "content">[];
  collection: string;
  currentSlug: string;
  phases: CoursePhase[];
}

export function CourseSidebar({
  allPosts,
  collection,
  currentSlug,
  phases,
}: CourseSidebarProps) {
  const currentRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [currentSlug]);

  const visiblePosts = allPosts.filter((p) => !p.hidden);

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border bg-surface/30 overflow-y-auto">
      {/* Back to roadmap */}
      <div className="p-4 border-b border-border">
        <Link
          href={`/${collection}`}
          className="text-sm text-muted hover:text-primary flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Roadmap
        </Link>
      </div>

      {/* Chapter list grouped by phase */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {phases.map((phase, phaseIndex) => {
          const [min, max] = phase.stepRange;
          const chaptersInPhase = visiblePosts.filter(
            (p) => p.step >= min && p.step <= max
          );
          if (chaptersInPhase.length === 0) return null;

          return (
            <div key={phaseIndex}>
              <p className="px-4 pt-4 pb-1 text-[11px] font-medium text-muted uppercase tracking-wider">
                {phase.title}
              </p>
              {chaptersInPhase.map((ch) => {
                const isCurrent = ch.slug === currentSlug;
                return (
                  <Link
                    key={ch.slug}
                    ref={isCurrent ? currentRef : undefined}
                    href={`/${collection}/${ch.slug}`}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-1.5 text-sm transition-colors",
                      isCurrent
                        ? "bg-surface text-primary font-medium"
                        : "text-muted hover:text-secondary"
                    )}
                  >
                    <ChapterCheckbox
                      courseId={collection}
                      step={ch.step}
                      size="sm"
                    />
                    <span className="truncate">{ch.title}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
