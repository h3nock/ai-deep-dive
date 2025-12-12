"use client";

import React, { useState, useEffect } from "react";

interface CharBreakdown {
  char: string;
  codePoint: string;
  bytes: number[];
}

const MAX_CHARS = 15;

/**
 * LiveByteInspector - Interactive UTF-8 Visualization
 *
 * COLOR JUSTIFICATION (per COLOR_GUIDE.md):
 * - text-secondary: Data values (decimal bytes) - standard body text
 * - text-muted: Labels, code points, hex values - meta info
 * - text-emerald-400: Total bytes count - success/positive outcome
 * - bg-zinc-800: Byte pills background - neutral container
 * - text-rose-400: Counter at limit - error state
 * - text-amber-400: Counter near limit - warning state
 */
export function LiveByteInspector() {
  const [text, setText] = useState("Hi 👋");
  const [breakdown, setBreakdown] = useState<CharBreakdown[]>([]);

  useEffect(() => {
    const encoder = new TextEncoder();
    const newBreakdown: CharBreakdown[] = [];

    for (const char of text) {
      const charBytes = encoder.encode(char);
      const codePoint = char
        .codePointAt(0)
        ?.toString(16)
        .toUpperCase()
        .padStart(4, "0");
      newBreakdown.push({
        char,
        codePoint: `U+${codePoint}`,
        bytes: Array.from(charBytes),
      });
    }
    setBreakdown(newBreakdown);
  }, [text]);

  const charCount = [...text].length;
  const totalBytes = breakdown.reduce(
    (acc, item) => acc + item.bytes.length,
    0
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    const newCharCount = [...newText].length;
    if (newCharCount <= MAX_CHARS) {
      setText(newText);
    }
  };

  // Counter color per COLOR_GUIDE: rose=error, amber=warning, muted=normal
  const getCounterColor = () => {
    if (charCount >= MAX_CHARS) return "text-rose-400";
    if (charCount >= 12) return "text-amber-400";
    return "text-muted";
  };

  return (
    <div
      style={{
        marginTop: "var(--space-connected)",
        marginBottom: "var(--space-flow)",
      }}
    >
      {/* Label outside container - per COMPONENT_GUIDE Pattern 2 */}
      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
        Type any text to see its bytes
      </div>

      {/* Terminal-style container - per COMPONENT_GUIDE Pattern 1 */}
      <div className="p-4 bg-[#121212] rounded-lg border border-zinc-800">
        {/* Input row */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <input
            type="text"
            value={text}
            onChange={handleChange}
            className="w-64 bg-surface border border-border rounded-lg px-4 py-2 text-xl font-mono text-primary text-center focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-muted"
            placeholder="Type something..."
          />
          <span className={`text-xs font-mono ${getCounterColor()}`}>
            {charCount}/{MAX_CHARS}
          </span>
        </div>

        {/* Stats row */}
        <div
          className="flex justify-center gap-6 text-sm text-muted mb-4"
        >
          <span>
            <span className="text-secondary">{charCount}</span> characters
          </span>
          <span>→</span>
          <span>
            <span className="text-emerald-400 font-semibold">{totalBytes}</span>{" "}
            bytes
          </span>
        </div>

        {/* Character breakdown */}
        {text && (
          <div className="flex flex-wrap justify-center gap-6">
            {breakdown.map((item, i) => (
              <div key={i} className="flex flex-col items-center">
                {/* Character */}
                <div className="text-3xl mb-1">
                  {item.char === " " ? (
                    <span className="text-muted text-xl">␣</span>
                  ) : (
                    item.char
                  )}
                </div>

                {/* Code Point */}
                <div className="text-xs text-muted font-mono mb-2">
                  {item.codePoint}
                </div>

                {/* Bytes */}
                <div className="flex gap-1">
                  {item.bytes.map((b, idx) => {
                    const hex = b.toString(16).toUpperCase().padStart(2, "0");
                    return (
                      <div key={idx} className="flex flex-col items-center">
                        {/* Decimal value */}
                        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800 text-secondary font-mono text-sm font-medium">
                          {b}
                        </div>
                        {/* Hex value */}
                        <div className="text-xs text-muted font-mono mt-1">
                          0x{hex}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!text && (
          <div className="text-center py-4 text-muted text-sm">
            Type something to see its bytes
          </div>
        )}
      </div>
    </div>
  );
}
