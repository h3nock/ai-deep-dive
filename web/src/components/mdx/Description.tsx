import React from "react";

export function Description({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="prose prose-slate dark:prose-invert max-w-none 
      prose-p:text-lg prose-p:leading-8 prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:mb-6
      prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
      prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-semibold
      prose-ul:my-4 prose-ul:list-disc prose-ul:pl-4
      prose-li:my-1 prose-li:text-slate-600 dark:prose-li:text-slate-300
      prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-blue-50 dark:prose-code:bg-blue-900/20 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-code:font-medium prose-code:border prose-code:border-blue-100 dark:prose-code:border-blue-800"
    >
      {children}
    </div>
  );
}
