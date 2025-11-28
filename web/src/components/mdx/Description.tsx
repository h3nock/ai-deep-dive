import React from "react";

export function Description({ children }: { children: React.ReactNode }) {
  return (
    <div className="not-prose">
      <div className="space-y-4">
        <div
          className="[&>p]:text-base [&>p]:leading-7 [&>p]:text-slate-600 dark:[&>p]:text-slate-400 [&>p]:mb-4
        [&>h3]:text-xs [&>h3]:uppercase [&>h3]:tracking-widest [&>h3]:text-slate-400 dark:[&>h3]:text-slate-500 [&>h3]:font-medium [&>h3]:mt-8 [&>h3]:mb-2
        [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_strong]:font-semibold
        [&_code]:text-sm [&_code]:text-slate-700 dark:[&_code]:text-slate-300 [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
        [&>p_a]:text-blue-600 dark:[&>p_a]:text-blue-400 [&>p_a]:font-medium hover:[&>p_a]:underline"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
