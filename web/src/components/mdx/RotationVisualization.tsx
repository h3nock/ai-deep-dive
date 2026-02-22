"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { viz, getGrid, withAlpha } from "@/lib/viz-colors";

/**
 * RotationVisualization — "The Rotation Playground"
 *
 * Interactive demonstration of how a rotation matrix transforms vectors
 * on the unit circle. Always stacked vertically: circle on top, equation below.
 * Animated transitions when angle or start position changes.
 *
 * Color roles:
 *   viz.tertiary  → input vector (green)
 *   viz.secondary → output vector (amber)
 *   viz.primary   → rotation arc / matrix (blue)
 */

const CIRCLE_RADIUS = 100;
const CENTER = 140;
const SVG_SIZE = 280;

export function RotationVisualization() {
  const { resolvedTheme } = useTheme();
  const grid = getGrid(resolvedTheme === "light" ? "light" : "dark");

  const [inputAngleDegrees, setInputAngleDegrees] = useState(0);
  const [rotationDegrees, setRotationDegrees] = useState(90);
  const [highlightRow, setHighlightRow] = useState<0 | 1 | null>(null);

  // Animated angle state
  const [animInputAngle, setAnimInputAngle] = useState(0);
  const [animRotationAngle, setAnimRotationAngle] = useState(90);
  const animRef = useRef<number | null>(null);
  const animStartRef = useRef<{ time: number; fromInput: number; fromRotation: number } | null>(null);

  const ANIM_DURATION = 350; // ms

  const cancelAnim = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    animStartRef.current = null;
  }, []);

  useEffect(() => {
    // If already at target, skip
    if (animInputAngle === inputAngleDegrees && animRotationAngle === rotationDegrees) {
      return;
    }

    const fromInput = animInputAngle;
    const fromRotation = animRotationAngle;

    cancelAnim();

    const animate = (time: number) => {
      if (animStartRef.current === null) {
        animStartRef.current = { time, fromInput, fromRotation };
      }

      const elapsed = time - animStartRef.current.time;
      const rawT = Math.min(elapsed / ANIM_DURATION, 1);
      // Ease-out: t * (2 - t)
      const t = rawT * (2 - rawT);

      const newInput = animStartRef.current.fromInput + (inputAngleDegrees - animStartRef.current.fromInput) * t;
      const newRotation = animStartRef.current.fromRotation + (rotationDegrees - animStartRef.current.fromRotation) * t;

      setAnimInputAngle(newInput);
      setAnimRotationAngle(newRotation);

      if (rawT < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        animRef.current = null;
        animStartRef.current = null;
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return cancelAnim;
  }, [inputAngleDegrees, rotationDegrees, cancelAnim]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use animated values for rendering
  const inputAngleRadians = (animInputAngle * Math.PI) / 180;
  const cosInput = Math.cos(inputAngleRadians);
  const sinInput = Math.sin(inputAngleRadians);

  const rotationRadians = (animRotationAngle * Math.PI) / 180;
  const cosTheta = Math.cos(rotationRadians);
  const sinTheta = Math.sin(rotationRadians);

  const cosOutput = cosTheta * cosInput - sinTheta * sinInput;
  const sinOutput = sinTheta * cosInput + cosTheta * sinInput;

  const inputX = CENTER + cosInput * CIRCLE_RADIUS;
  const inputY = CENTER - sinInput * CIRCLE_RADIUS;
  const outputX = CENTER + cosOutput * CIRCLE_RADIUS;
  const outputY = CENTER - sinOutput * CIRCLE_RADIUS;

  // Use target (non-animated) values for text displays
  const targetInputRad = (inputAngleDegrees * Math.PI) / 180;
  const targetRotRad = (rotationDegrees * Math.PI) / 180;
  const targetCosInput = Math.cos(targetInputRad);
  const targetSinInput = Math.sin(targetInputRad);
  const targetCosTheta = Math.cos(targetRotRad);
  const targetSinTheta = Math.sin(targetRotRad);
  const targetCosOutput = targetCosTheta * targetCosInput - targetSinTheta * targetSinInput;
  const targetSinOutput = targetSinTheta * targetCosInput + targetCosTheta * targetSinInput;

  const fmt = (n: number) => {
    const val = Object.is(n, -0) || Math.abs(n) < 0.005 ? 0 : n;
    return val.toFixed(2);
  };

  const positionPresets = [
    { name: "Right", angle: 0 },
    { name: "Top", angle: 90 },
    { name: "Left", angle: 180 },
    { name: "Bottom", angle: 270 },
  ];

  const highlightBg = withAlpha(viz.primary, 0.12);
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
                    className={`px-3 py-1.5 text-xs rounded border transition-colors duration-150 ${
                      isActive
                        ? ""
                        : "bg-surface hover:bg-border-hover border-border-hover text-secondary"
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: withAlpha(viz.tertiary, 0.2),
                            borderColor: withAlpha(viz.tertiary, 0.5),
                            color: viz.tertiary,
                          }
                        : undefined
                    }
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            <span className="font-mono tabular-nums text-xs" style={{ color: viz.tertiary }}>
              [{fmt(targetCosInput)}, {fmt(targetSinInput)}]
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
                    className={`px-3 py-1.5 text-xs rounded border transition-colors duration-150 ${
                      isActive
                        ? ""
                        : "bg-surface hover:bg-border-hover border-border-hover text-secondary"
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: withAlpha(viz.primary, 0.2),
                            borderColor: withAlpha(viz.primary, 0.5),
                            color: viz.primary,
                          }
                        : undefined
                    }
                  >
                    {deg}°
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Vertically stacked: circle then equation */}
        <div className="flex flex-col items-center gap-4">
          {/* Circle Diagram */}
          <div className="flex flex-col items-center gap-2">
            <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
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
                {/* Glow filter for endpoint dots */}
                <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Axes */}
              <line x1="20" y1={CENTER} x2={SVG_SIZE - 20} y2={CENTER} stroke={grid.axis} strokeWidth="1" />
              <line x1={CENTER} y1="20" x2={CENTER} y2={SVG_SIZE - 20} stroke={grid.axis} strokeWidth="1" />

              {/* Unit circle */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={CIRCLE_RADIUS}
                fill="none"
                stroke={grid.axisBold}
                strokeWidth="1.5"
              />

              {/* Rotation arc */}
              {animRotationAngle > 0 && (
                <path
                  d={createRotationArc(animInputAngle, animRotationAngle, arcRadius, CENTER)}
                  fill="none"
                  stroke={viz.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  markerEnd="url(#arrowMarker)"
                />
              )}

              {/* Input vector */}
              <line
                x1={CENTER}
                y1={CENTER}
                x2={inputX}
                y2={inputY}
                stroke={viz.tertiary}
                strokeWidth="2.5"
              />

              {/* Output vector */}
              <line
                x1={CENTER}
                y1={CENTER}
                x2={outputX}
                y2={outputY}
                stroke={viz.secondary}
                strokeWidth="2.5"
              />

              {/* Input endpoint with glow */}
              <circle
                cx={inputX}
                cy={inputY}
                r="9"
                fill={viz.tertiary}
                stroke={viz.tertiaryDark}
                strokeWidth="1"
                filter="url(#dotGlow)"
              />

              {/* Output endpoint with glow */}
              <circle
                cx={outputX}
                cy={outputY}
                r="9"
                fill={viz.secondary}
                stroke={viz.secondaryDark}
                strokeWidth="1"
                filter="url(#dotGlow)"
              />

              {/* Axis labels */}
              <text
                x={CENTER + CIRCLE_RADIUS + 16}
                y={CENTER + 4}
                fill={grid.labelLight}
                fontSize="10"
                textAnchor="start"
              >
                x (cos)
              </text>
              <text
                x={CENTER + 8}
                y={CENTER - CIRCLE_RADIUS - 16}
                fill={grid.labelLight}
                fontSize="10"
              >
                y (sin)
              </text>

              {/* Rotation label */}
              {rotationDegrees > 0 && (
                <text
                  x={CENTER}
                  y={SVG_SIZE - 12}
                  fill={viz.primary}
                  fontSize="11"
                  textAnchor="middle"
                  fontWeight="500"
                >
                  Rotation: {rotationDegrees}°
                </text>
              )}
            </svg>

            {/* Legend */}
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: viz.tertiary }} />
                <span className="text-secondary">
                  Input{" "}
                  <span className="font-mono tabular-nums text-xs" style={{ color: viz.tertiary }}>
                    ({fmt(targetCosInput)}, {fmt(targetSinInput)})
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: viz.secondary }} />
                <span className="text-secondary">
                  Output{" "}
                  <span className="font-mono tabular-nums text-xs" style={{ color: viz.secondary }}>
                    ({fmt(targetCosOutput)}, {fmt(targetSinOutput)})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Matrix Equation */}
          <div className="flex items-center gap-2 font-mono text-base flex-wrap justify-center">
            {/* Output vector */}
            <div
              className="flex flex-col p-2 border-l-2 border-r-2 rounded shrink-0"
              style={{
                borderColor: viz.secondary,
                backgroundColor: withAlpha(viz.secondary, 0.1),
              }}
            >
              <span className="font-bold text-center px-2" style={{ color: viz.secondary }}>
                {fmt(targetCosOutput)}
              </span>
              <span className="font-bold text-center px-2" style={{ color: viz.secondary }}>
                {fmt(targetSinOutput)}
              </span>
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
                className="flex py-0.5 px-1 rounded transition-colors duration-150"
                style={{
                  backgroundColor: highlightRow === 0 ? highlightBg : "transparent",
                }}
              >
                <span className="w-16 text-center shrink-0" style={{ color: viz.primary }}>
                  {fmt(targetCosTheta)}
                </span>
                <span className="w-16 text-center shrink-0" style={{ color: viz.primary }}>
                  {fmt(-targetSinTheta)}
                </span>
              </div>
              <div
                className="flex py-0.5 px-1 rounded transition-colors duration-150"
                style={{
                  backgroundColor: highlightRow === 1 ? highlightBg : "transparent",
                }}
              >
                <span className="w-16 text-center shrink-0" style={{ color: viz.primary }}>
                  {fmt(targetSinTheta)}
                </span>
                <span className="w-16 text-center shrink-0" style={{ color: viz.primary }}>
                  {fmt(targetCosTheta)}
                </span>
              </div>
            </div>

            <span className="text-muted">×</span>

            {/* Input vector */}
            <div
              className="flex flex-col p-2 border-l-2 border-r-2 rounded transition-colors duration-150 shrink-0"
              style={{
                borderColor: viz.tertiary,
                backgroundColor: highlightRow !== null ? highlightBg : withAlpha(viz.tertiary, 0.1),
              }}
            >
              <span className="font-bold text-center px-2" style={{ color: viz.tertiary }}>
                {fmt(targetCosInput)}
              </span>
              <span className="font-bold text-center px-2" style={{ color: viz.tertiary }}>
                {fmt(targetSinInput)}
              </span>
            </div>

            <span className="text-muted">=</span>

            {/* Expanded calculations */}
            <div className="flex flex-col shrink-0">
              <div
                className="py-1 px-2 rounded cursor-pointer transition-colors duration-150 text-sm whitespace-nowrap"
                style={{ backgroundColor: highlightRow === 0 ? highlightBg : "transparent" }}
                onMouseEnter={() => setHighlightRow(0)}
                onMouseLeave={() => setHighlightRow(null)}
              >
                <span style={{ color: viz.primary }}>{fmt(targetCosTheta)}</span>
                <span style={{ color: grid.label }}>×</span>
                <span style={{ color: viz.tertiary }}>{fmt(targetCosInput)}</span>
                <span style={{ color: grid.label }}> + </span>
                <span style={{ color: viz.primary }}>{fmt(-targetSinTheta)}</span>
                <span style={{ color: grid.label }}>×</span>
                <span style={{ color: viz.tertiary }}>{fmt(targetSinInput)}</span>
              </div>
              <div
                className="py-1 px-2 rounded cursor-pointer transition-colors duration-150 text-sm whitespace-nowrap"
                style={{ backgroundColor: highlightRow === 1 ? highlightBg : "transparent" }}
                onMouseEnter={() => setHighlightRow(1)}
                onMouseLeave={() => setHighlightRow(null)}
              >
                <span style={{ color: viz.primary }}>{fmt(targetSinTheta)}</span>
                <span style={{ color: grid.label }}>×</span>
                <span style={{ color: viz.tertiary }}>{fmt(targetCosInput)}</span>
                <span style={{ color: grid.label }}> + </span>
                <span style={{ color: viz.primary }}>{fmt(targetCosTheta)}</span>
                <span style={{ color: grid.label }}>×</span>
                <span style={{ color: viz.tertiary }}>{fmt(targetSinInput)}</span>
              </div>
            </div>
          </div>

          {/* Hover hint */}
          <div className="text-[11px] text-muted">
            Hover a row to trace the multiplication
          </div>
        </div>
      </div>
    </div>
  );
}

function createRotationArc(
  inputAngleDeg: number,
  rotationDeg: number,
  radius: number,
  center: number
): string {
  const startAngle = -inputAngleDeg;
  const endAngle = -(inputAngleDeg + rotationDeg);

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const startX = center + radius * Math.cos(startRad);
  const startY = center + radius * Math.sin(startRad);
  const endX = center + radius * Math.cos(endRad);
  const endY = center + radius * Math.sin(endRad);

  const largeArcFlag = Math.abs(rotationDeg) > 180 ? 1 : 0;
  const sweepFlag = 0;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;
}
