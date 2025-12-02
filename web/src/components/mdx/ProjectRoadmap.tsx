import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { ArrowRight } from "lucide-react";

interface ProjectRoadmapProps {
  courseId: string;
  prefix: string;
}

/**
 * ProjectRoadmap Component - Navigation List
 *
 * SPACING STRATEGY:
 * - Top margin: Tier 2 (Connected) - follows intro text
 * - Bottom margin: none - let parent handle
 * - Internal items use tight spacing for visual cohesion
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
      <div className="relative">
        {projectSteps.map((post, index) => {
          const stepNumber = index + 1;
          const isLast = index === projectSteps.length - 1;

          return (
            <Link
              key={post.slug}
              href={`/${courseId}/step/${post.slug}`}
              className="group block relative"
            >
              <div className="relative flex items-center gap-4 py-3 px-4 -mx-4 rounded-lg hover:bg-zinc-800/50 transition-colors">
                {/* Step Number with Connector */}
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-muted text-sm font-medium group-hover:bg-zinc-800 transition-colors relative z-10">
                    {stepNumber}
                  </div>
                  {/* Connector line */}
                  {!isLast && (
                    <div className="absolute left-1/2 top-8 w-px h-[calc(100%+0.25rem)] bg-border -translate-x-1/2" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-primary group-hover:text-secondary transition-colors no-underline">
                    {post.title}
                  </h4>
                  <p className="text-xs text-muted line-clamp-1 mt-0.5">
                    {post.description}
                  </p>
                </div>

                {/* Arrow */}
                <div className="shrink-0 text-muted group-hover:text-secondary group-hover:translate-x-0.5 transition-all duration-200">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
