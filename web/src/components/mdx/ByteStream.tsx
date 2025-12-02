import React from "react";

interface ByteStreamProps {
  bytes: number[];
  label?: string;
}

/**
 * ByteStream Component - Visual Data Display
 *
 * SPACING STRATEGY (Component Sandwich - Asymmetric):
 * - Top margin: Tier 2 (Connected) - pulls toward intro text ("Here's the bytes:")
 * - Bottom margin: Tier 3 (Flow) - provides moderate reset before next paragraph
 * - Label uses Tier 1 (Atomic) gap to data - they are one visual unit
 */
export function ByteStream({ bytes, label }: ByteStreamProps) {
  return (
    <div
      style={{
        marginTop: "var(--space-connected)",
        marginBottom: "var(--space-flow)",
      }}
    >
      {label && (
        <div
          className="text-xs font-bold text-muted uppercase tracking-wider"
          style={{ marginBottom: "var(--space-atomic)" }}
        >
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {bytes.map((byte, index) => (
          <div key={index} className="flex flex-col items-center group">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-surface border-2 border-border text-secondary font-mono font-bold shadow-sm group-hover:border-sky-500 group-hover:text-sky-400 transition-all">
              {byte}
            </div>
            <span className="text-[10px] text-muted mt-1 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
              0x{byte.toString(16).toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
