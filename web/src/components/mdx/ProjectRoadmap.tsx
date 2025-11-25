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
    .filter(post => post.slug.startsWith(prefix))
    .sort((a, b) => a.step - b.step);

  return (
    <div className="space-y-2 my-8 not-prose">
      {projectSteps.map((post, index) => {
        const stepNumber = index + 1;
        
        return (
          <Link 
            key={post.slug}
            href={`/${courseId}/step/${post.slug}`}
            className="group block"
          >
            <div className="relative bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200">
              <div className="flex items-center gap-3">
                {/* Step Number */}
                <div className="shrink-0 w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-medium text-sm group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                  {stepNumber}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                    {post.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-1 mt-0.5">
                    {post.description}
                  </p>
                </div>

                {/* Arrow */}
                <div className="shrink-0 text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-200">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
