import React from "react";

export function Description({ children }: { children: React.ReactNode }) {
  return (
    <div className="not-prose mb-6">
      <div
        className="[&>p]:text-lg [&>p]:leading-relaxed [&>p]:text-secondary [&>p:not(:last-child)]:mb-6
        [&>h3]:text-xs [&>h3]:uppercase [&>h3]:tracking-widest [&>h3]:text-muted [&>h3]:font-medium [&>h3]:mt-8 [&>h3]:mb-2
        [&_strong]:text-primary [&_strong]:font-semibold
        [&_code]:text-sm [&_code]:text-secondary [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
        [&>p_a]:text-sky-400 [&>p_a]:font-medium hover:[&>p_a]:underline"
      >
        {children}
      </div>
    </div>
  );
}
