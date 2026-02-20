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
      {/* Navigation Timeline - matches Course Homepage pattern */}
      <div className="relative ml-3 pl-6 border-l border-border">
        {projectSteps.map((post, index) => {
          const stepNumber = index + 1;

          return (
            <Link
              key={post.slug}
              href={`/${courseId}/${post.slug}`}
              className="group relative block py-3 first:pt-1 last:pb-1 border-b border-border/30 last:border-0"
            >
              {/* Timeline node */}
              <div className="absolute -left-[31px] top-1/2 -translate-y-1/2 bg-background ring-4 ring-background">
                <ChapterCheckbox
                  courseId={courseId}
                  step={post.step}
                  size="sm"
                />
              </div>

              {/* Row content */}
              <div className="flex items-center gap-4 rounded-lg px-4 py-2.5 transition-colors hover:bg-surface/50">
                <span className="shrink-0 w-7 font-mono text-sm text-muted/50 group-hover:text-primary transition-colors">
                  {stepNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm md:text-base font-medium text-primary group-hover:text-secondary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-xs md:text-sm text-muted line-clamp-1 mt-0.5">
                    {post.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-border group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
