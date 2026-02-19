"use client";

import React, { useState } from "react";
import { viz, grid, withAlpha } from "@/lib/viz-colors";

/**
 * RotationVisualization - Interactive demonstration of how rotation matrix transforms vectors
 *
 * Color roles (all derived from viz-colors.ts):
 *   viz.tertiary  → input vector
 *   viz.secondary → output vector
 *   viz.primary   → rotation arc / matrix
 */

const CIRCLE_RADIUS = 85;
const CENTER = 105;

export function RotationVisualization() {
  const [inputAngleDegrees, setInputAngleDegrees] = useState(0);
  const [rotationDegrees, setRotationDegrees] = useState(90);
  const [highlightRow, setHighlightRow] = useState<0 | 1 | null>(null);

  const inputAngleRadians = (inputAngleDegrees * Math.PI) / 180;
  const sinInput = Math.sin(inputAngleRadians);
  const cosInput = Math.cos(inputAngleRadians);

  const rotationRadians = (rotationDegrees * Math.PI) / 180;
  const cosTheta = Math.cos(rotationRadians);
  const sinTheta = Math.sin(rotationRadians);

  const cosOutput = cosTheta * cosInput - sinTheta * sinInput;
  const sinOutput = sinTheta * cosInput + cosTheta * sinInput;

  // Standard trig: x = cos(theta), y = sin(theta)
  // SVG y-axis is inverted, so we negate y
  const inputX = CENTER + cosInput * CIRCLE_RADIUS;
  const inputY = CENTER - sinInput * CIRCLE_RADIUS;
  const outputX = CENTER + cosOutput * CIRCLE_RADIUS;
  const outputY = CENTER - sinOutput * CIRCLE_RADIUS;

  const fmt = (n: number) => {
    // Fix negative zero display
    const val = Object.is(n, -0) || Math.abs(n) < 0.005 ? 0 : n;
    return val.toFixed(2);
  };

  // Presets: standard unit circle positions (theta measured from positive x-axis)
  const positionPresets = [
    { name: "Right", angle: 0 },
    { name: "Top", angle: 90 },
    { name: "Left", angle: 180 },
    { name: "Bottom", angle: 270 },
  ];

  const highlightBg = withAlpha(grid.line, 0.6);
  const arcRadius = CIRCLE_RADIUS * 0.45;

  return (
    <div style={{ marginTop: "var(--space-connected)", marginBottom: "var(--space-flow)" }}>
      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
        Interactive: Matrix Multiplication in Action
      </div>

      <div className="p-4 bg-terminal rounded-lg border border-border">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-secondary">Start at:</span>
            <div className="flex gap-1">
              {positionPresets.map((p) => {
                const isActive = inputAngleDegrees === p.angle;
                return (
                  <button
                    key={p.name}
                    onClick={() => setInputAngleDegrees(p.angle)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      isActive
                        ? ''
                        : 'bg-surface hover:bg-border-hover border-border-hover text-secondary'
                    }`}
                    style={isActive ? {
                      backgroundColor: withAlpha(viz.tertiary, 0.2),
                      borderColor: withAlpha(viz.tertiary, 0.5),
                      color: viz.tertiary,
                    } : undefined}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            <span className="font-mono text-xs" style={{ color: viz.tertiary }}>
              [{fmt(cosInput)}, {fmt(sinInput)}]
            </span>
          </div>

          <div className="w-px bg-border-hover hidden sm:block" />

          <div className="flex items-center gap-3">
            <span className="text-secondary">Rotate by:</span>
            <div className="flex gap-1">
              {[30, 45, 60, 90].map((deg) => {
                const isActive = rotationDegrees === deg;
                return (
                  <button
                    key={deg}
                    onClick={() => setRotationDegrees(deg)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      isActive
                        ? ''
                        : 'bg-surface hover:bg-border-hover border-border-hover text-secondary'
                    }`}
                    style={isActive ? {
                      backgroundColor: withAlpha(viz.primary, 0.2),
                      borderColor: withAlpha(viz.primary, 0.5),
                      color: viz.primary,
                    } : undefined}
                  >
                    {deg}°
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main visualization */}
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          {/* Circle Diagram */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <svg width="240" height="230" viewBox="0 0 240 230">
              <defs>
                <marker
                  id="arrowMarker"
                  markerWidth="10"
                  markerHeight="10"
                  refX="5"
                  refY="5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,2 L0,8 L6,5 Z" fill={viz.primary} />
                </marker>
              </defs>

              <line x1="10" y1={CENTER} x2="200" y2={CENTER} stroke={grid.axis} strokeWidth="1" />
              <line x1={CENTER} y1="10" x2={CENTER} y2="200" stroke={grid.axis} strokeWidth="1" />
              <circle cx={CENTER} cy={CENTER} r={CIRCLE_RADIUS} fill="none" stroke={grid.axisBold} strokeWidth="1.5" />

              {rotationDegrees > 0 && (
                <path
                  d={createRotationArc(inputAngleDegrees, rotationDegrees, arcRadius, CENTER)}
                  fill="none"
                  stroke={viz.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  markerEnd="url(#arrowMarker)"
                />
              )}

              <line x1={CENTER} y1={CENTER} x2={inputX} y2={inputY} stroke={viz.tertiary} strokeWidth="2.5" />
              <line x1={CENTER} y1={CENTER} x2={outputX} y2={outputY} stroke={viz.secondary} strokeWidth="2.5" />

              <circle cx={inputX} cy={inputY} r="7" fill={viz.tertiary} stroke={viz.tertiaryDark} strokeWidth="1" />
              <circle cx={outputX} cy={outputY} r="7" fill={viz.secondary} stroke={viz.secondaryDark} strokeWidth="1" />

              <text x={CENTER + CIRCLE_RADIUS + 14} y={CENTER + 4} fill={grid.labelLight} fontSize="10" textAnchor="start">x (cos)</text>
              <text x={CENTER + 8} y={CENTER - CIRCLE_RADIUS - 14} fill={grid.labelLight} fontSize="10">y (sin)</text>

              {rotationDegrees > 0 && (
                <text x={CENTER} y={220} fill={viz.primary} fontSize="11" textAnchor="middle" fontWeight="500">
                  Rotation: {rotationDegrees}°
                </text>
              )}
            </svg>

            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: viz.tertiary }} />
                <span className="text-secondary">Input</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: viz.secondary }} />
                <span className="text-secondary">Output</span>
              </div>
            </div>
          </div>

          {/* Matrix Equation - margin-bottom aligns with circle's horizontal centerline */}
          <div className="flex items-center gap-2 font-mono text-sm flex-wrap flex-1" style={{ marginBottom: '55px' }}>
            {/* Output vector */}
            <div
              className="flex flex-col p-2 border-l-2 border-r-2 rounded shrink-0"
              style={{
                borderColor: viz.secondary,
                backgroundColor: withAlpha(viz.secondary, 0.1),
              }}
            >
              <span className="font-bold text-center px-2" style={{ color: viz.secondary }}>{fmt(cosOutput)}</span>
              <span className="font-bold text-center px-2" style={{ color: viz.secondary }}>{fmt(sinOutput)}</span>
            </div>

            <span className="text-muted">=</span>

            {/* Rotation matrix */}
            <div
              className="flex flex-col p-2 border-l-2 border-r-2 rounded shrink-0"
              style={{
                borderColor: viz.primary,
                backgroundColor: withAlpha(viz.primary, 0.1),
              }}
            >
              <div
                className="flex py-0.5 px-1 rounded transition-colors"
                style={{ backgroundColor: highlightRow === 0 ? highlightBg : 'transparent' }}
              >
                <span className="w-14 text-center shrink-0" style={{ color: viz.primary }}>{fmt(cosTheta)}</span>
                <span className="w-14 text-center shrink-0" style={{ color: viz.primary }}>{fmt(-sinTheta)}</span>
              </div>
              <div
                className="flex py-0.5 px-1 rounded transition-colors"
                style={{ backgroundColor: highlightRow === 1 ? highlightBg : 'transparent' }}
              >
                <span className="w-14 text-center shrink-0" style={{ color: viz.primary }}>{fmt(sinTheta)}</span>
                <span className="w-14 text-center shrink-0" style={{ color: viz.primary }}>{fmt(cosTheta)}</span>
              </div>
            </div>

            <span className="text-muted">×</span>

            {/* Input vector */}
            <div
              className="flex flex-col p-2 border-l-2 border-r-2 rounded transition-colors shrink-0"
              style={{
                borderColor: viz.tertiary,
                backgroundColor: highlightRow !== null ? highlightBg : withAlpha(viz.tertiary, 0.1),
              }}
            >
              <span className="font-bold text-center px-2" style={{ color: viz.tertiary }}>{fmt(cosInput)}</span>
              <span className="font-bold text-center px-2" style={{ color: viz.tertiary }}>{fmt(sinInput)}</span>
            </div>

            <span className="text-muted">=</span>

            {/* Expanded calculations */}
            <div className="flex flex-col shrink-0">
              <div
                className="py-1 px-2 rounded cursor-pointer transition-colors text-xs whitespace-nowrap"
                style={{ backgroundColor: highlightRow === 0 ? highlightBg : 'transparent' }}
                onMouseEnter={() => setHighlightRow(0)}
                onMouseLeave={() => setHighlightRow(null)}
              >
                <span style={{ color: viz.primary }}>{fmt(cosTheta)}</span>
                <span style={{ color: grid.label }}>×</span>
                <span style={{ color: viz.tertiary }}>{fmt(cosInput)}</span>
                <span style={{ color: grid.label }}> + </span>
                <span style={{ color: viz.primary }}>{fmt(-sinTheta)}</span>
                <span style={{ color: grid.label }}>×</span>
                <span style={{ color: viz.tertiary }}>{fmt(sinInput)}</span>
              </div>
              <div
                className="py-1 px-2 rounded cursor-pointer transition-colors text-xs whitespace-nowrap"
                style={{ backgroundColor: highlightRow === 1 ? highlightBg : 'transparent' }}
                onMouseEnter={() => setHighlightRow(1)}
                onMouseLeave={() => setHighlightRow(null)}
              >
                <span style={{ color: viz.primary }}>{fmt(sinTheta)}</span>
                <span style={{ color: grid.label }}>×</span>
                <span style={{ color: viz.tertiary }}>{fmt(cosInput)}</span>
                <span style={{ color: grid.label }}> + </span>
                <span style={{ color: viz.primary }}>{fmt(cosTheta)}</span>
                <span style={{ color: grid.label }}>×</span>
                <span style={{ color: viz.tertiary }}>{fmt(sinInput)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function createRotationArc(inputAngleDeg: number, rotationDeg: number, radius: number, center: number): string {
  // Standard trig: 0° at right (positive x-axis), counterclockwise positive
  // SVG angles: 0° at right, but clockwise positive (y-axis inverted)
  // So we negate angles for SVG
  const startAngle = -inputAngleDeg;
  const endAngle = -(inputAngleDeg + rotationDeg);

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const startX = center + radius * Math.cos(startRad);
  const startY = center + radius * Math.sin(startRad);
  const endX = center + radius * Math.cos(endRad);
  const endY = center + radius * Math.sin(endRad);

  const largeArcFlag = Math.abs(rotationDeg) > 180 ? 1 : 0;
  // sweepFlag = 0 for counterclockwise in SVG (which is our positive direction)
  const sweepFlag = 0;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;
}
