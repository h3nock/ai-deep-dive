"use client";

import React, { useMemo, useState } from "react";

interface CharComparison {
  char: string;
  codePoint: number;
  utf8Bytes: number[];
  utf32Bytes: number[];
}

const MAX_CHARS = 5;

/**
 * EncodingCompare - UTF-32 vs UTF-8 Side-by-Side Comparison
 *
 * COLOR JUSTIFICATION (per COLOR_GUIDE.md):
 * - bg-success/20 + text-success: UTF-8 bytes - success (efficient encoding)
 * - bg-background + text-border-hover: Padding zeros - muted/disabled (wasted space)
 * - bg-surface + text-secondary: Non-zero UTF-32 bytes - neutral data
 * - text-info: Savings percentage - info state
 * - text-muted: Labels, row headers - meta info
 * - text-error: Counter at limit - error state
 * - text-warning: Counter near limit - warning state
 */
export function EncodingCompare() {
  const [text, setText] = useState("Hello");
  const comparison = useMemo<CharComparison[]>(() => {
    const encoder = new TextEncoder();
    const newComparison: CharComparison[] = [];

    for (const char of text) {
      const codePoint = char.codePointAt(0) || 0;
      const utf8Bytes = Array.from(encoder.encode(char));

      // UTF-32: Always 4 bytes, big-endian
      const utf32Bytes = [
        (codePoint >> 24) & 0xff,
        (codePoint >> 16) & 0xff,
        (codePoint >> 8) & 0xff,
        codePoint & 0xff,
      ];

      newComparison.push({
        char,
        codePoint,
        utf8Bytes,
        utf32Bytes,
      });
    }
    return newComparison;
  }, [text]);

  const charCount = [...text].length;
  const utf8Total = comparison.reduce((acc, c) => acc + c.utf8Bytes.length, 0);
  const utf32Total = comparison.length * 4;
  const savings = utf32Total - utf8Total;
  const savingsPercent =
    utf32Total > 0 ? Math.round((savings / utf32Total) * 100) : 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    const newCharCount = [...newText].length;
    if (newCharCount <= MAX_CHARS) {
      setText(newText);
    }
  };

  // Counter color per COLOR_GUIDE: rose=error, amber=warning, muted=normal
  const getCounterColor = () => {
    if (charCount >= MAX_CHARS) return "text-error";
    if (charCount >= 4) return "text-warning";
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
        Compare encodings
      </div>

      {/* Terminal-style container - per COMPONENT_GUIDE Pattern 1 */}
      <div className="p-4 bg-terminal rounded-lg border border-border">
        {/* Input row */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <input
            type="text"
            value={text}
            onChange={handleChange}
            className="w-36 bg-surface border border-border rounded-lg px-3 py-2 text-lg font-mono text-primary text-center focus:outline-none focus:border-border-hover transition-colors placeholder:text-muted"
            placeholder="Type..."
          />
          <span className={`text-xs font-mono ${getCounterColor()}`}>
            {charCount}/{MAX_CHARS}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex justify-center items-center gap-6 text-sm mb-4">
          <div className="text-center">
            <div className="text-xl font-bold text-muted">{utf32Total}</div>
            <div className="text-xs text-muted">UTF-32 bytes</div>
          </div>
          <div className="text-muted">vs</div>
          <div className="text-center">
            <div className="text-xl font-bold text-success">{utf8Total}</div>
            <div className="text-xs text-muted">UTF-8 bytes</div>
          </div>
          {savings > 0 && (
            <>
              <div className="text-muted">=</div>
              <div className="text-center">
                <div className="text-xl font-bold text-info">
                  {savingsPercent}%
                </div>
                <div className="text-xs text-muted">smaller</div>
              </div>
            </>
          )}
        </div>

        {/* Byte comparison grid */}
        {text && (
          <div className="overflow-x-auto">
            <table className="mx-auto">
              <tbody>
                {/* Character row */}
                <tr>
                  <td className="w-20 pr-3 text-right text-xs text-muted font-medium uppercase tracking-wider align-middle whitespace-nowrap">
                    Char
                  </td>
                  {comparison.map((item, i) => (
                    <td key={i} className="text-center px-3 pb-2">
                      <span className="text-2xl">
                        {item.char === " " ? (
                          <span className="text-muted">␣</span>
                        ) : (
                          item.char
                        )}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* UTF-32 row */}
                <tr>
                  <td className="w-20 pr-3 text-right text-xs text-muted font-medium uppercase tracking-wider align-middle whitespace-nowrap">
                    UTF-32
                  </td>
                  {comparison.map((item, i) => (
                    <td key={i} className="text-center px-3 py-1">
                      <div className="flex gap-0.5 justify-center">
                        {item.utf32Bytes.map((b, idx) => (
                          <span
                            key={idx}
                            className={`w-6 h-6 flex items-center justify-center rounded text-xs font-mono ${
                              b === 0
                                ? "bg-background text-border-hover"
                                : "bg-surface text-secondary"
                            }`}
                          >
                            {b.toString(16).toUpperCase().padStart(2, "0")}
                          </span>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* UTF-8 row */}
                <tr>
                  <td className="w-20 pr-3 text-right text-xs text-muted font-medium uppercase tracking-wider align-middle whitespace-nowrap">
                    UTF-8
                  </td>
                  {comparison.map((item, i) => (
                    <td key={i} className="text-center px-3 py-1">
                      <div className="flex gap-0.5 justify-center">
                        {item.utf8Bytes.map((b, idx) => (
                          <span
                            key={idx}
                            className="w-6 h-6 flex items-center justify-center rounded text-xs font-mono bg-success/20 text-success"
                          >
                            {b.toString(16).toUpperCase().padStart(2, "0")}
                          </span>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!text && (
        <div className="text-center py-4 text-muted text-sm">
          Type something to compare
        </div>
      )}
    </div>
  );
}
