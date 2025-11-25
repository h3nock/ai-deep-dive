"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  tags: string[];
  status: "available" | "coming-soon" | "planned";
}

export function CourseCard({ title, description, icon, href, tags, status }: CourseCardProps) {
  const isAvailable = status === "available";
  const Component = isAvailable && href ? Link : "div";

  return (
    <Component 
      href={href || "#"} 
      className={cn(
        "group relative flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 transition-all duration-200",
        isAvailable ? "hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" : "opacity-60 cursor-default"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
          {icon}
        </div>
        {status !== "available" && (
          <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
            {status === "coming-soon" ? "Coming Soon" : "Planned"}
          </span>
        )}
      </div>

      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4 flex-1">
        {description}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center text-sm font-medium pt-4 border-t border-slate-100 dark:border-slate-800">
        {isAvailable ? (
          <span className="flex items-center text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
            Start Building 
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </span>
        ) : (
          <span className="flex items-center text-slate-400 dark:text-slate-500">
            <Lock className="w-4 h-4 mr-2" /> Locked
          </span>
        )}
      </div>
    </Component>
  );
}
