"use client";

import React from "react";

/**
 * ActivationGraph - Side-by-side visualization comparing ReLU and GELU
 * activation functions. Clean, minimal plots matching the site's zinc theme.
 */

// Plot dimensions
const W = 180;
const H = 120;
const P = { t: 8, r: 12, b: 20, l: 24 };
const PW = W - P.l - P.r;
const PH = H - P.t - P.b;

// Data range
const X_RANGE = [-3, 3] as const;
const Y_RANGE = [-0.5, 3] as const;

function toX(x: number) {
  return P.l + ((x - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * PW;
}

function toY(y: number) {
  return P.t + ((Y_RANGE[1] - y) / (Y_RANGE[1] - Y_RANGE[0])) * PH;
}

function relu(x: number) {
  return Math.max(0, x);
}

function gelu(x: number) {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
}

function curve(fn: (x: number) => number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const x = X_RANGE[0] + (i / 200) * (X_RANGE[1] - X_RANGE[0]);
    const y = Math.max(Y_RANGE[0], Math.min(Y_RANGE[1], fn(x)));
    pts.push(`${i === 0 ? "M" : "L"} ${toX(x).toFixed(1)} ${toY(y).toFixed(1)}`);
  }
  return pts.join(" ");
}

function Plot({ label, path, color }: { label: string; path: string; color: string }) {
  const xAxisY = toY(0);
  const yAxisX = toX(0);

  return (
    <div className="flex-1 min-w-0">
      <div className="text-center mb-1.5">
        <span
          className="text-xs font-medium tracking-wider"
          style={{ color }}
        >
          {label}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface p-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
          {/* Grid */}
          {[-2, -1, 0, 1, 2].map((t) => (
            <line key={`gx${t}`} x1={toX(t)} y1={P.t} x2={toX(t)} y2={H - P.b} stroke="#1c1c1e" strokeWidth="0.5" />
          ))}
          {[0, 1, 2].map((t) => (
            <line key={`gy${t}`} x1={P.l} y1={toY(t)} x2={W - P.r} y2={toY(t)} stroke="#1c1c1e" strokeWidth="0.5" />
          ))}

          {/* Axes */}
          <line x1={P.l} y1={xAxisY} x2={W - P.r} y2={xAxisY} stroke="#3f3f46" strokeWidth="0.75" />
          <line x1={yAxisX} y1={P.t} x2={yAxisX} y2={H - P.b} stroke="#3f3f46" strokeWidth="0.75" />

          {/* X labels */}
          {[-2, -1, 0, 1, 2].map((t) => (
            <text key={`lx${t}`} x={toX(t)} y={H - P.b + 12} textAnchor="middle" fill="#52525b" fontSize="8" fontFamily="var(--font-mono)">
              {t}
            </text>
          ))}
          {/* Y labels */}
          {[1, 2].map((t) => (
            <text key={`ly${t}`} x={P.l - 5} y={toY(t) + 3} textAnchor="end" fill="#52525b" fontSize="8" fontFamily="var(--font-mono)">
              {t}
            </text>
          ))}

          {/* Curve */}
          <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export function ActivationGraph() {
  return (
    <div className="my-6">
      <div className="p-4 rounded-lg border border-border bg-terminal">
        <div className="flex gap-4">
          <Plot label="ReLU" path={curve(relu)} color="#60a5fa" />
          <Plot label="GELU" path={curve(gelu)} color="#fbbf24" />
        </div>
      </div>
    </div>
  );
}
