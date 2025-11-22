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
  color: "blue" | "purple" | "emerald" | "amber";
}

export function CourseCard({ title, description, icon, href, tags, status, color }: CourseCardProps) {
  const isAvailable = status === "available";
  const Component = isAvailable && href ? Link : "div";
  
  const colorStyles = {
    blue: "group-hover:border-blue-500/50 group-hover:shadow-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
    purple: "group-hover:border-purple-500/50 group-hover:shadow-purple-500/20 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20",
    emerald: "group-hover:border-emerald-500/50 group-hover:shadow-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
    amber: "group-hover:border-amber-500/50 group-hover:shadow-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
  };

  const badgeColors = {
    available: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    "coming-soon": "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    planned: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  };

  return (
    <Component 
      href={href || "#"} 
      className={cn(
        "group relative flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 transition-all duration-300",
        isAvailable ? "hover:shadow-xl hover:-translate-y-1 cursor-pointer" : "opacity-75 cursor-default"
      )}
    >
      <div className="flex items-start justify-between mb-6">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300", colorStyles[color].split(" ").slice(2).join(" "))}>
          {icon}
        </div>
        <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider", badgeColors[status])}>
          {status.replace("-", " ")}
        </span>
      </div>

      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {title}
      </h3>
      
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 flex-1">
        {description}
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {tags.map(tag => (
          <span key={tag} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center text-sm font-bold pt-6 border-t border-slate-100 dark:border-slate-800">
        {isAvailable ? (
          <span className="flex items-center text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
            Start Building <ArrowRight className="w-4 h-4 ml-2" />
          </span>
        ) : (
          <span className="flex items-center text-slate-400">
            <Lock className="w-4 h-4 mr-2" /> Locked
          </span>
        )}
      </div>
    </Component>
  );
}
