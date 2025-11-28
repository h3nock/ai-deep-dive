import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { ArrowRight } from "lucide-react";

interface ProjectRoadmapProps {
  courseId: string;
  prefix: string;
}

export function ProjectRoadmap({ courseId, prefix }: ProjectRoadmapProps) {
  const posts = getAllPosts(courseId);

  // Filter for posts that start with the prefix (e.g., "p1-")
  // and sort by step number
  const projectSteps = posts
    .filter((post) => post.slug.startsWith(prefix))
    .sort((a, b) => a.step - b.step);

  return (
    <div className="mt-4 not-prose">
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
              <div className="relative flex items-center gap-4 py-3 px-4 -mx-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                {/* Step Number with Connector */}
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm font-medium group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors relative z-10">
                    {stepNumber}
                  </div>
                  {/* Connector line */}
                  {!isLast && (
                    <div className="absolute left-1/2 top-8 w-px h-[calc(100%+0.25rem)] bg-slate-200 dark:bg-slate-700 -translate-x-1/2" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors no-underline">
                    {post.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-1 mt-0.5">
                    {post.description}
                  </p>
                </div>

                {/* Arrow */}
                <div className="shrink-0 text-slate-300 dark:text-slate-700 group-hover:text-slate-400 dark:group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-200">
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
