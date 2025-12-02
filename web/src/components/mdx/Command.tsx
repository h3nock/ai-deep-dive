"use client";

import React, { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

export function Command({
  children,
  comment,
}: {
  children: string;
  comment?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative flex items-start gap-3 py-2 px-4 -mx-4 hover:bg-zinc-800/50 rounded-lg transition-colors">
      {/* Prompt */}
      <div className="shrink-0 mt-1.5 text-muted select-none">
        <span className="text-sky-400 font-bold">❯</span>
      </div>

      {/* Code & Comment */}
      <div className="flex-1 min-w-0 font-mono text-sm leading-relaxed break-all">
        <span className="text-secondary">{children}</span>
        {comment && (
          <span className="ml-4 text-muted select-none"># {comment}</span>
        )}
      </div>

      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className="shrink-0 p-1.5 rounded-md text-muted hover:text-primary hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Copy command"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
