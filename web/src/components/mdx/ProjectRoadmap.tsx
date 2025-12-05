import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { ArrowRight } from "lucide-react";
import { ChapterCheckbox } from "@/components/ChapterCheckbox";

interface ProjectRoadmapProps {
  courseId: string;
  prefix: string;
}

/**
 * ProjectRoadmap Component - Navigation Timeline
 *
 * Uses the unified Navigation Timeline pattern:
 * - Continuous vertical line on left
 * - Circular nodes (numbered)
 * - Consistent hover treatment with Course Homepage
 */
export function ProjectRoadmap({ courseId, prefix }: ProjectRoadmapProps) {
  const posts = getAllPosts(courseId);

  // Filter for posts that start with the prefix (e.g., "p1-")
  // and sort by step number
  const projectSteps = posts
    .filter((post) => post.slug.startsWith(prefix))
    .sort((a, b) => a.step - b.step);

  return (
    <div className="not-prose" style={{ marginTop: "var(--space-connected)" }}>
      {/* Navigation Timeline - matches Course Homepage pattern EXACTLY */}
      <div className="relative ml-4 pl-4 border-l border-zinc-800">
        {projectSteps.map((post, index) => {
          const stepNumber = index + 1;

          return (
            <Link
              key={post.slug}
              href={`/${courseId}/${post.slug}`}
              className="group block relative border-b border-border last:border-0"
            >
              {/* Timeline Node - ChapterCheckbox for state sync & consistency */}
              <div className="absolute -left-[24.5px] top-1/2 -translate-y-1/2 z-10 bg-background ring-4 ring-background">
                <ChapterCheckbox
                  courseId={courseId}
                  step={post.step}
                  size="sm"
                />
              </div>

              {/* Content Floating on Void - Inset from borders */}
              <div className="relative my-1 py-2 px-4 rounded-lg transition-all duration-200 hover:bg-zinc-900/50 group-hover:translate-x-0.5">
                <div className="flex items-center gap-4">
                  {/* Step Number - Subtle (matches Homepage) */}
                  <div className="shrink-0 w-8 h-8 flex items-center justify-center text-muted/50 font-mono text-sm group-hover:text-primary transition-colors">
                    {stepNumber}
                  </div>

                  {/* Text Content (Stacked) */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-primary group-hover:text-white transition-colors">
                      {post.title}
                    </h4>
                    <p className="text-xs text-muted line-clamp-1 mt-0.5 group-hover:text-zinc-400 transition-colors">
                      {post.description}
                    </p>
                  </div>

                  {/* Arrow - Always visible for balance */}
                  <div className="shrink-0 text-zinc-700 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 ml-auto">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
