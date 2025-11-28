"use client";

import React from "react";

interface EmbeddingSpaceProps {
  showArrows?: boolean;
}

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
  const toSvgX = (x: number) => paddingLeft + ((x * scaleFactor + 1) / 2) * innerWidth;
  const toSvgY = (y: number) => paddingTop + ((1 - y * scaleFactor) / 2) * innerHeight; // Flip Y for standard math coords

  // Data points - coordinates match Section 2: [Royalty, Gender]
  // X axis = Gender (+1 masculine, -1 feminine)
  // Y axis = Royalty (+1 royal, 0 common)
  const points = [
    { name: "King", emoji: "👑", x: 1.0, y: 1.0, color: "#3b82f6" },
    { name: "Queen", emoji: "👸", x: -1.0, y: 1.0, color: "#ec4899" },
    { name: "Man", emoji: "🧔", x: 1.0, y: 0.0, color: "#3b82f6" },
    { name: "Woman", emoji: "👩", x: -1.0, y: 0.0, color: "#ec4899" },
    { name: "Apple", emoji: "🍎", x: 0.0, y: 0.0, color: "#64748b" },
  ];

  // Arrow definitions (from -> to)
  const arrows = [
    { from: "King", to: "Queen", label: "Gender Flip", color: "#f59e0b" },
    { from: "Man", to: "Woman", label: "Gender Flip", color: "#f59e0b" },
  ];

  const getPoint = (name: string) => points.find((p) => p.name === name)!;

  return (
    <div className="my-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="text-center mb-4">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {showArrows
            ? "Vector Arithmetic: The Gender Direction"
            : "The 2D Meaning Space"}
        </span>
      </div>

      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-md"
          style={{ aspectRatio: "1/1" }}
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
            className="fill-white dark:fill-slate-900/50"
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
                className={
                  v === 0
                    ? "stroke-slate-400 dark:stroke-slate-500"
                    : "stroke-slate-200 dark:stroke-slate-700"
                }
                strokeWidth={v === 0 ? 2 : 1}
                strokeDasharray={v === 0 ? "" : "4 4"}
              />
              {/* Horizontal lines */}
              <line
                x1={paddingLeft}
                y1={toSvgY(v)}
                x2={width - paddingRight}
                y2={toSvgY(v)}
                className={
                  v === 0
                    ? "stroke-slate-400 dark:stroke-slate-500"
                    : "stroke-slate-200 dark:stroke-slate-700"
                }
                strokeWidth={v === 0 ? 2 : 1}
                strokeDasharray={v === 0 ? "" : "4 4"}
              />
            </React.Fragment>
          ))}

          {/* Axis labels */}
          <text
            x={width - paddingRight + 8}
            y={toSvgY(0) + 4}
            className="fill-slate-500 dark:fill-slate-400 text-[10px] font-medium"
          >
            Gender (+)
          </text>
          <text
            x={paddingLeft - 8}
            y={toSvgY(0) + 4}
            className="fill-slate-500 dark:fill-slate-400 text-[10px] font-medium"
            textAnchor="end"
          >
            Gender (-)
          </text>
          <text
            x={toSvgX(0)}
            y={paddingTop - 10}
            className="fill-slate-500 dark:fill-slate-400 text-[10px] font-medium"
            textAnchor="middle"
          >
            Royalty (+)
          </text>
          <text
            x={toSvgX(0)}
            y={height - paddingBottom + 20}
            className="fill-slate-500 dark:fill-slate-400 text-[10px] font-medium"
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
                    className="stroke-amber-500 dark:stroke-amber-400"
                    strokeWidth="3"
                    markerEnd="url(#arrowhead)"
                    strokeLinecap="round"
                  />
                  {/* Label background */}
                  {i === 0 && (
                    <>
                      <rect
                        x={mx - 40}
                        y={my - 22}
                        width="80"
                        height="18"
                        rx="4"
                        className="fill-amber-100 dark:fill-amber-900/50"
                      />
                      <text
                        x={mx}
                        y={my - 10}
                        textAnchor="middle"
                        className="fill-amber-700 dark:fill-amber-300 text-[10px] font-semibold"
                      >
                        {arrow.label}
                      </text>
                    </>
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
                r="24"
                className="fill-white dark:fill-slate-800 stroke-slate-200 dark:stroke-slate-600"
                strokeWidth="2"
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
                className="fill-slate-700 dark:fill-slate-300 text-[11px] font-semibold"
              >
                {point.name}
              </text>
              {/* Coordinates */}
              <text
                x={toSvgX(point.x)}
                y={toSvgY(point.y) + 54}
                textAnchor="middle"
                className="fill-slate-600 dark:fill-slate-300 text-[11px] font-mono"
              >
                [{point.y}, {point.x}]
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Legend for arrows version */}
      {showArrows && (
        <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 bg-amber-500 dark:bg-amber-400 rounded-full relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[6px] border-l-amber-500 dark:border-l-amber-400 border-y-4 border-y-transparent"></div>
            </div>
            <span className="text-slate-600 dark:text-slate-400">
              Same direction = Same concept
            </span>
          </div>
        </div>
      )}

      {/* Caption */}
      <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4">
        {showArrows
          ? 'Both arrows point in the same direction, showing that "Gender" is a consistent direction in the space.'
          : "Words are positioned based on their Royalty and Gender attributes."}
      </p>
    </div>
  );
}
