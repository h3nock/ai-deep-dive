"use client";

import React from "react";
import { viz } from "@/lib/viz-colors";

interface EmbeddingSpaceProps {
  showArrows?: boolean;
}

/**
 * EmbeddingSpace Component - Interactive Visualization
 *
 * SPACING STRATEGY (Component Sandwich - Asymmetric):
 * - Top margin: Tier 2 (Connected) - pulls toward intro text
 * - Bottom margin: Tier 3 (Flow) - provides reset before next paragraph
 * - Internal elements use Tier 1 (Atomic) for tight label-to-visual relationships
 */
export function EmbeddingSpace({ showArrows = false }: EmbeddingSpaceProps) {
  // Grid configuration
  const width = 440;
  const height = 400;
  const paddingLeft = 70;
  const paddingRight = 70;
  const paddingTop = 50;
  const paddingBottom = 50;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  // Convert data coordinates (-1 to 1) to SVG coordinates
  // Scale factor to keep points away from edges (0.75 means points go from -0.75 to 0.75 instead of -1 to 1)
  const scaleFactor = 0.7;
  const toSvgX = (x: number) =>
    paddingLeft + ((x * scaleFactor + 1) / 2) * innerWidth;
  const toSvgY = (y: number) =>
    paddingTop + ((1 - y * scaleFactor) / 2) * innerHeight; // Flip Y for standard math coords

  // Data points - coordinates match Section 2: [Royalty, Gender]
  // X axis = Gender (+1 masculine, -1 feminine)
  // Y axis = Royalty (+1 royal, 0 common)
  const points = [
    { name: "King", emoji: "👑", x: 1.0, y: 1.0, color: viz.blue },
    { name: "Queen", emoji: "👸", x: -1.0, y: 1.0, color: viz.pink },
    { name: "Man", emoji: "🧔", x: 1.0, y: 0.0, color: viz.blue },
    { name: "Woman", emoji: "👩", x: -1.0, y: 0.0, color: viz.pink },
    { name: "Apple", emoji: "🍎", x: 0.0, y: 0.0, color: viz.slate },
  ];

  // Arrow definitions (from -> to)
  const arrows = [
    { from: "King", to: "Queen", label: "Gender Flip", color: viz.amber },
    { from: "Man", to: "Woman", label: "Gender Flip", color: viz.amber },
  ];

  const getPoint = (name: string) => points.find((p) => p.name === name)!;

  return (
    <div
      className="py-6"
      style={{
        marginTop: "var(--space-connected)",
        marginBottom: "var(--space-flow)",
      }}
    >
      <div
        className="text-center"
        style={{ marginBottom: "var(--space-atomic)" }}
      >
        <span className="text-xs text-muted">
          {showArrows
            ? "Vector Arithmetic"
            : "2D Vector Space"}
        </span>
      </div>

      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-sm"
        >
          {/* Definitions for arrow markers */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" className="fill-amber-500" />
            </marker>
            <marker
              id="arrowhead-dark"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" className="fill-amber-400" />
            </marker>
          </defs>

          {/* Background grid */}
          <rect
            x={paddingLeft}
            y={paddingTop}
            width={innerWidth}
            height={innerHeight}
            className="fill-background"
            rx="4"
          />

          {/* Grid lines */}
          {[-1, -0.5, 0, 0.5, 1].map((v) => (
            <React.Fragment key={v}>
              {/* Vertical lines */}
              <line
                x1={toSvgX(v)}
                y1={paddingTop}
                x2={toSvgX(v)}
                y2={height - paddingBottom}
                className={v === 0 ? "stroke-zinc-600" : "stroke-zinc-800"}
                strokeWidth={v === 0 ? 2 : 1}
                strokeDasharray={v === 0 ? "" : "4 4"}
              />
              {/* Horizontal lines */}
              <line
                x1={paddingLeft}
                y1={toSvgY(v)}
                x2={width - paddingRight}
                y2={toSvgY(v)}
                className={v === 0 ? "stroke-zinc-600" : "stroke-zinc-800"}
                strokeWidth={v === 0 ? 2 : 1}
                strokeDasharray={v === 0 ? "" : "4 4"}
              />
            </React.Fragment>
          ))}

          {/* Axis labels */}
          <text
            x={width - paddingRight + 8}
            y={toSvgY(0) + 4}
            className="fill-zinc-500 text-[10px]"
          >
            Gender (+)
          </text>
          <text
            x={paddingLeft - 8}
            y={toSvgY(0) + 4}
            className="fill-zinc-500 text-[10px]"
            textAnchor="end"
          >
            Gender (-)
          </text>
          <text
            x={toSvgX(0)}
            y={paddingTop - 10}
            className="fill-zinc-500 text-[10px]"
            textAnchor="middle"
          >
            Royalty (+)
          </text>
          <text
            x={toSvgX(0)}
            y={height - paddingBottom + 20}
            className="fill-zinc-500 text-[10px]"
            textAnchor="middle"
          >
            Royalty (-)
          </text>

          {/* Arrows showing direction (only when showArrows is true) */}
          {showArrows &&
            arrows.map((arrow, i) => {
              const from = getPoint(arrow.from);
              const to = getPoint(arrow.to);

              // Calculate offset to not overlap with emoji
              const dx = toSvgX(to.x) - toSvgX(from.x);
              const dy = toSvgY(to.y) - toSvgY(from.y);
              const len = Math.sqrt(dx * dx + dy * dy);
              const offsetStart = 25;
              const offsetEnd = 35;

              const x1 = toSvgX(from.x) + (dx / len) * offsetStart;
              const y1 = toSvgY(from.y) + (dy / len) * offsetStart;
              const x2 = toSvgX(to.x) - (dx / len) * offsetEnd;
              const y2 = toSvgY(to.y) - (dy / len) * offsetEnd;

              // Midpoint for label
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;

              return (
                <g key={`arrow-${i}`}>
                  {/* Arrow line */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    className="stroke-amber-400/70"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                    strokeLinecap="round"
                  />
                  {/* Label - just text, no background */}
                  {i === 0 && (
                    <text
                      x={mx}
                      y={my - 12}
                      textAnchor="middle"
                      className="fill-zinc-400 text-[10px]"
                    >
                      {arrow.label}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Data points */}
          {points.map((point) => (
            <g key={point.name}>
              {/* Point background circle */}
              <circle
                cx={toSvgX(point.x)}
                cy={toSvgY(point.y)}
                r="22"
                className="fill-surface"
              />
              {/* Emoji */}
              <text
                x={toSvgX(point.x)}
                y={toSvgY(point.y) + 6}
                textAnchor="middle"
                className="text-xl"
                style={{ fontSize: "20px" }}
              >
                {point.emoji}
              </text>
              {/* Label */}
              <text
                x={toSvgX(point.x)}
                y={toSvgY(point.y) + 42}
                textAnchor="middle"
                className="fill-zinc-300 text-[11px] font-medium"
              >
                {point.name}
              </text>
              {/* Coordinates */}
              <text
                x={toSvgX(point.x)}
                y={toSvgY(point.y) + 54}
                textAnchor="middle"
                className="fill-zinc-500 text-[10px] font-mono"
              >
                [{point.y}, {point.x}]
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Legend for arrows version */}
      {showArrows && (
        <div
          className="flex flex-col sm:flex-row justify-center items-center gap-4 text-sm"
          style={{ marginTop: "var(--space-connected)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-amber-400/70 rounded-full relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-amber-400/70 border-y-[3px] border-y-transparent"></div>
            </div>
            <span className="text-xs text-muted">Same direction = Same concept</span>
          </div>
        </div>
      )}

      {/* Caption */}
      <p
        className="text-center text-xs text-muted"
        style={{ marginTop: "var(--space-connected)" }}
      >
        {showArrows
          ? 'Both arrows point in the same direction, showing that "Gender" is a consistent direction in the space.'
          : "Tokens are positioned based on their Royalty and Gender scores."}
      </p>
    </div>
  );
}
