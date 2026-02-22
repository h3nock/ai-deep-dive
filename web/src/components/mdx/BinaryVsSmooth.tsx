"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { viz, getGrid, withAlpha } from "@/lib/viz-colors";

/**
 * BinaryVsSmooth — Slider-driven comparison of binary vs sinusoidal encoding.
 *
 * Shows 3 dimensions at different frequencies. The user scrubs a position
 * slider (0-49) and watches binary values snap while smooth values glide.
 * A fingerprint section at the bottom makes the "aha" visible: binary
 * fingerprints stay identical for stretches then jump, while smooth
 * fingerprints vary continuously.
 */

const MAX_POSITION = 49;
const PLAY_SPEED = 3; // positions per second

interface DimensionConfig {
  label: string;
  cycles: number;
  speedLabel: string;
  color: string;
}

const DIMENSIONS: DimensionConfig[] = [
  { label: "Dim 0", cycles: 4, speedLabel: "Fast", color: viz.tertiary },
  { label: "Dim 1", cycles: 2, speedLabel: "Medium", color: viz.secondary },
  { label: "Dim 2", cycles: 1, speedLabel: "Slow", color: viz.quaternary },
];

const GRAPH_WIDTH = 200;
const GRAPH_HEIGHT = 80;
const GRAPH_PADDING_Y = 8;

function getSmoothValue(t: number, cycles: number): number {
  return (1 - Math.cos(t * 2 * Math.PI * cycles)) / 2;
}

function getBinaryValue(t: number, cycles: number): number {
  const phase = (t * cycles) % 1;
  return phase < 0.5 ? 0 : 1;
}

function valueToY(value: number): number {
  const usable = GRAPH_HEIGHT - GRAPH_PADDING_Y * 2;
  return GRAPH_PADDING_Y + usable * (1 - value);
}

function generateSmoothPath(cycles: number): string {
  const parts: string[] = [];
  for (let i = 0; i <= GRAPH_WIDTH; i++) {
    const t = i / GRAPH_WIDTH;
    const y = valueToY(getSmoothValue(t, cycles));
    parts.push(`${i === 0 ? "M" : "L"} ${i} ${y.toFixed(1)}`);
  }
  return parts.join(" ");
}

function generateBinaryPath(cycles: number): string {
  const parts: string[] = [];
  const stepWidth = GRAPH_WIDTH / (cycles * 2);
  let isHigh = false;

  parts.push(`M 0 ${valueToY(0)}`);

  for (let i = 0; i < cycles * 2; i++) {
    const nextX = Math.min((i + 1) * stepWidth, GRAPH_WIDTH);
    const currentY = valueToY(isHigh ? 1 : 0);
    const nextIsHigh: boolean = !isHigh;
    const nextY = valueToY(nextIsHigh ? 1 : 0);

    parts.push(`L ${nextX.toFixed(1)} ${currentY.toFixed(1)}`);
    if (i < cycles * 2 - 1) {
      parts.push(`L ${nextX.toFixed(1)} ${nextY.toFixed(1)}`);
    }
    isHigh = nextIsHigh;
  }
  return parts.join(" ");
}

export function BinaryVsSmooth() {
  const { resolvedTheme } = useTheme();
  const grid = getGrid(resolvedTheme === "light" ? "light" : "dark");

  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    lastTimeRef.current = null;
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      stopAnimation();
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current !== null) {
        const dt = (time - lastTimeRef.current) / 1000;
        setPosition((prev) => {
          const next = prev + dt * PLAY_SPEED;
          return next > MAX_POSITION ? 0 : next;
        });
      }
      lastTimeRef.current = time;
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return stopAnimation;
  }, [isPlaying, stopAnimation]);

  const t = position / MAX_POSITION;
  const markerX = t * GRAPH_WIDTH;

  const dimValues = DIMENSIONS.map((dim) => ({
    binary: getBinaryValue(t, dim.cycles),
    smooth: getSmoothValue(t, dim.cycles),
  }));

  return (
    <div
      style={{
        marginTop: "var(--space-connected)",
        marginBottom: "var(--space-flow)",
      }}
    >
      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
        3 Dimensions · Different Frequencies
      </div>

      <div className="p-4 bg-terminal rounded-lg border border-border">
        {/* Controls */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
            }}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-surface hover:bg-border-hover transition-colors border border-border-hover"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg className="w-3.5 h-3.5 text-secondary" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-secondary" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min="0"
            max={MAX_POSITION}
            step="1"
            value={Math.round(position)}
            onChange={(e) => {
              setIsPlaying(false);
              setPosition(parseInt(e.target.value, 10));
            }}
            className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${viz.tertiary} 0%, ${viz.tertiary} ${(position / MAX_POSITION) * 100}%, ${grid.line} ${(position / MAX_POSITION) * 100}%, ${grid.line} 100%)`,
              accentColor: viz.tertiary,
            }}
          />

          <span
            className="text-lg font-mono tabular-nums w-8 text-right shrink-0 font-semibold"
            style={{ color: viz.tertiary }}
          >
            {Math.round(position)}
          </span>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 mb-2">
          <div className="w-16" />
          <div className="text-center">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: grid.text }}
            >
              Binary
            </span>
          </div>
          <div className="text-center">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: grid.text }}
            >
              Smooth (Sine)
            </span>
          </div>
        </div>

        {/* Dimension rows */}
        <div className="space-y-3">
          {DIMENSIONS.map((dim, idx) => {
            const binaryVal = dimValues[idx].binary;
            const smoothVal = dimValues[idx].smooth;
            const binaryY = valueToY(binaryVal);
            const smoothY = valueToY(smoothVal);

            return (
              <div key={idx} className="grid grid-cols-[auto_1fr_1fr] gap-x-3 items-center">
                {/* Row label */}
                <div className="w-16 text-right pr-1">
                  <div className="text-[13px] font-medium text-primary leading-tight">
                    {dim.label}
                  </div>
                  <div className="text-[11px]" style={{ color: dim.color }}>
                    {dim.speedLabel}
                  </div>
                </div>

                {/* Binary graph */}
                <div>
                  <svg
                    className="w-full"
                    viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ height: "64px" }}
                  >
                    {/* Midline */}
                    <line
                      x1="0"
                      y1={GRAPH_HEIGHT / 2}
                      x2={GRAPH_WIDTH}
                      y2={GRAPH_HEIGHT / 2}
                      stroke={grid.line}
                      strokeWidth="0.5"
                      opacity={0.3}
                    />
                    {/* Path */}
                    <path
                      d={generateBinaryPath(dim.cycles)}
                      fill="none"
                      stroke={dim.color}
                      strokeWidth="2"
                      opacity={0.6}
                    />
                    {/* Marker */}
                    <circle
                      cx={markerX}
                      cy={binaryY}
                      r={5}
                      fill={dim.color}
                      stroke={withAlpha(dim.color, 0.5)}
                      strokeWidth="1.5"
                    />
                  </svg>
                  {/* Value below graph */}
                  <div
                    className="text-[11px] font-mono tabular-nums text-center mt-0.5"
                    style={{ color: dim.color }}
                  >
                    {binaryVal.toFixed(0)}
                  </div>
                </div>

                {/* Smooth graph */}
                <div>
                  <svg
                    className="w-full"
                    viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ height: "64px" }}
                  >
                    {/* Midline */}
                    <line
                      x1="0"
                      y1={GRAPH_HEIGHT / 2}
                      x2={GRAPH_WIDTH}
                      y2={GRAPH_HEIGHT / 2}
                      stroke={grid.line}
                      strokeWidth="0.5"
                      opacity={0.3}
                    />
                    {/* Path */}
                    <path
                      d={generateSmoothPath(dim.cycles)}
                      fill="none"
                      stroke={dim.color}
                      strokeWidth="2"
                    />
                    {/* Marker */}
                    <circle
                      cx={markerX}
                      cy={smoothY}
                      r={5}
                      fill={dim.color}
                      stroke={withAlpha(dim.color, 0.5)}
                      strokeWidth="1.5"
                    />
                  </svg>
                  {/* Value below graph */}
                  <div
                    className="text-[11px] font-mono tabular-nums text-center mt-0.5"
                    style={{ color: dim.color }}
                  >
                    {smoothVal.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Fingerprint comparison — raw value vectors side by side */}
        <div className="mt-5 pt-4 border-t border-border">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 items-baseline">
            <div className="w-16 text-right pr-1">
              <div className="text-[11px] text-muted">Encoding</div>
            </div>
            <div className="text-center">
              <span className="font-mono tabular-nums text-sm">
                [
                {dimValues.map((dv, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span style={{ color: grid.label }}>, </span>}
                    <span style={{ color: DIMENSIONS[i].color }}>{dv.binary.toFixed(0)}</span>
                  </React.Fragment>
                ))}
                ]
              </span>
            </div>
            <div className="text-center">
              <span className="font-mono tabular-nums text-sm">
                [
                {dimValues.map((dv, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span style={{ color: grid.label }}>, </span>}
                    <span style={{ color: DIMENSIONS[i].color }}>{dv.smooth.toFixed(2)}</span>
                  </React.Fragment>
                ))}
                ]
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
