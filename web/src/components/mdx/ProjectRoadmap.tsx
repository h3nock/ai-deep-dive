import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { ArrowRight, CheckCircle2, Terminal, Cpu, BarChart3, MessageSquare, Database, Zap, Code2, Layers, Network } from "lucide-react";

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

  // Helper to get icon (reused logic, ideally shared)
  const getIcon = (step: number) => {
    // We can use a simpler mapping here or reuse the main one
    // Since these are sub-steps (e.g. 9.1), we can map based on the decimal part or just generic icons
    const subStep = Math.round((step % 1) * 10);
    
    switch (subStep) {
      case 1: return <Terminal className="w-5 h-5" />; // Setup
      case 2: return <Cpu className="w-5 h-5" />; // Assembly
      case 3: return <BarChart3 className="w-5 h-5" />; // Training
      case 4: return <MessageSquare className="w-5 h-5" />; // Inference
      default: return <CheckCircle2 className="w-5 h-5" />;
    }
  };

  return (
    <div className="grid gap-4 my-8 not-prose">
      {projectSteps.map((post) => (
        <Link 
          key={post.slug}
          href={`/${courseId}/step/${post.slug}`}
          className="group flex items-center p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all hover:shadow-md"
        >
          {/* Icon */}
          <div className="flex-shrink-0 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {getIcon(post.step)}
          </div>

          {/* Content */}
          <div className="ml-4 flex-1">
            <div className="flex items-center gap-2 mb-1">
               <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
                STEP {post.step.toFixed(1)}
              </span>
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {post.title}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">
              {post.description}
            </p>
          </div>

          {/* Arrow */}
          <div className="ml-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all">
            <ArrowRight className="w-5 h-5" />
          </div>
        </Link>
      ))}
    </div>
  );
}
