"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChapterCheckbox } from "./ChapterCheckbox";
import type { PostData } from "@/lib/posts";
import type { CoursePhase } from "@/lib/course-config";

interface CourseSidebarProps {
  allPosts: Omit<PostData, "content">[];
  collection: string;
  currentSlug: string;
  phases: CoursePhase[];
  collapsed: boolean;
}

export function CourseSidebar({
  allPosts,
  collection,
  currentSlug,
  phases,
  collapsed,
}: CourseSidebarProps) {
  const currentRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!collapsed) {
      currentRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [currentSlug, collapsed]);

  const visiblePosts = allPosts.filter((p) => !p.hidden);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col shrink-0 border-r border-border bg-surface/30 transition-[width] duration-200 ease-out overflow-hidden",
        collapsed ? "w-0 border-r-0" : "w-64"
      )}
    >
      <div className={cn("flex flex-col min-w-[16rem]", collapsed && "invisible")}>
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
      </div>
    </aside>
  );
}

/** Small button shown in the topbar when the sidebar is collapsed */
export function SidebarExpandButton({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="p-1.5 text-muted hover:text-primary transition-colors rounded mr-2"
      aria-label="Expand sidebar"
    >
      <PanelLeft className="w-4 h-4" />
    </button>
  );
}
