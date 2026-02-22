"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "next-themes";
import { viz, getGrid, withAlpha } from "@/lib/viz-colors";

/**
 * FrequencyWaves — "The Clock Orchestra"
 *
 * Shows multiple sine waves at different frequencies with rotating clock hands.
 * Each dimension cycles at a different speed. A fingerprint section at the
 * bottom shows the encoding vector at the current position as vertical bars.
 */

const D_MODEL = 32;
const MAX_POSITION = 100;
const PLAY_SPEED = 3; // positions per second

function computeSinusoidal(pos: number, dim: number, dModel: number): number {
  const denominator = Math.pow(10000, (2 * dim) / dModel);
  return Math.sin(pos / denominator);
}

const DIMS = [0, 2, 4, 6] as const;
const FREQ_LABELS = ["Fastest", "Fast", "Medium", "Slow"];
const DIM_COLORS = [viz.tertiary, viz.secondary, viz.primary, viz.quaternary];

const CLOCK_SIZE = 56;
const CLOCK_RADIUS = 22;
const CLOCK_CENTER = CLOCK_SIZE / 2;

const WAVE_WIDTH = 200;
const WAVE_HEIGHT = 64;

function generateWavePath(dim: number, width: number, height: number): string {
  const points: string[] = [];
  const centerY = height / 2;
  const amplitude = (height / 2) * 0.8;

  for (let x = 0; x <= width; x += 0.5) {
    const pos = (x / width) * MAX_POSITION;
    const value = computeSinusoidal(pos, dim, D_MODEL);
    const y = centerY - value * amplitude;
    points.push(`${x === 0 ? "M" : "L"} ${x} ${y.toFixed(1)}`);
  }
  return points.join(" ");
}

function generateFillPath(dim: number, width: number, height: number, positionFrac: number): string {
  const points: string[] = [];
  const centerY = height / 2;
  const amplitude = (height / 2) * 0.8;
  const endX = positionFrac * width;

  // Start at baseline
  points.push(`M 0 ${centerY}`);

  // Trace wave up to current position
  for (let x = 0; x <= endX; x += 0.5) {
    const pos = (x / width) * MAX_POSITION;
    const value = computeSinusoidal(pos, dim, D_MODEL);
    const y = centerY - value * amplitude;
    points.push(`L ${x} ${y.toFixed(1)}`);
  }

  // Close back to baseline
  points.push(`L ${endX} ${centerY}`);
  points.push("Z");

  return points.join(" ");
}

export function FrequencyWaves() {
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

  const waves = useMemo(() => {
    return DIMS.map((dim) => {
      const denominator = Math.pow(10000, (2 * dim) / D_MODEL);
      const angle = position / denominator;
      return {
        dim,
        value: Math.sin(angle),
        angle,
      };
    });
  }, [position]);

  const positionFrac = position / MAX_POSITION;

  return (
    <div
      style={{
        marginTop: "var(--space-connected)",
        marginBottom: "var(--space-flow)",
      }}
    >
      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
        Multi-Frequency Encoding: Clocks + Waves
      </div>

      <div className="p-4 bg-terminal rounded-lg border border-border">
        {/* Controls */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
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

          <span className="text-sm text-muted shrink-0">Position</span>

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
              background: `linear-gradient(to right, ${viz.tertiary} 0%, ${viz.tertiary} ${positionFrac * 100}%, ${grid.line} ${positionFrac * 100}%, ${grid.line} 100%)`,
              accentColor: viz.tertiary,
            }}
          />

          <span
            className="text-lg font-mono tabular-nums w-8 text-right shrink-0"
            style={{ color: viz.tertiary }}
          >
            {Math.round(position)}
          </span>
        </div>

        {/* Wave rows */}
        <div className="space-y-4">
          {waves.map((wave, index) => {
            const color = DIM_COLORS[index];
            const handX = CLOCK_CENTER + CLOCK_RADIUS * Math.cos(wave.angle);
            const handY = CLOCK_CENTER - CLOCK_RADIUS * Math.sin(wave.angle);

            const waveCenterY = WAVE_HEIGHT / 2;
            const amplitude = (WAVE_HEIGHT / 2) * 0.8;
            const markerX = positionFrac * WAVE_WIDTH;
            const markerY = waveCenterY - wave.value * amplitude;

            const sign = wave.value >= 0 ? "+" : "";

            return (
              <div key={wave.dim} className="flex items-center gap-3">
                {/* Clock */}
                <div className="shrink-0">
                  <svg
                    width={CLOCK_SIZE}
                    height={CLOCK_SIZE}
                    viewBox={`0 0 ${CLOCK_SIZE} ${CLOCK_SIZE}`}
                  >
                    {/* Clock face */}
                    <circle
                      cx={CLOCK_CENTER}
                      cy={CLOCK_CENTER}
                      r={CLOCK_RADIUS}
                      fill="none"
                      stroke={grid.axis}
                      strokeWidth="1.5"
                    />
                    {/* 12 tick marks */}
                    {Array.from({ length: 12 }, (_, i) => {
                      const tickAngle = (i * Math.PI * 2) / 12;
                      const innerR = CLOCK_RADIUS - 3;
                      const outerR = CLOCK_RADIUS;
                      return (
                        <line
                          key={i}
                          x1={CLOCK_CENTER + innerR * Math.cos(tickAngle)}
                          y1={CLOCK_CENTER - innerR * Math.sin(tickAngle)}
                          x2={CLOCK_CENTER + outerR * Math.cos(tickAngle)}
                          y2={CLOCK_CENTER - outerR * Math.sin(tickAngle)}
                          stroke={grid.line}
                          strokeWidth="1"
                          opacity={0.3}
                        />
                      );
                    })}
                    {/* Center dot */}
                    <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r="2" fill={grid.dot} />
                    {/* Hand */}
                    <line
                      x1={CLOCK_CENTER}
                      y1={CLOCK_CENTER}
                      x2={handX}
                      y2={handY}
                      stroke={color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    {/* Hand tip dot */}
                    <circle cx={handX} cy={handY} r="3.5" fill={color} />
                  </svg>
                </div>

                {/* Label */}
                <div className="w-24 shrink-0">
                  <div className="text-xs text-muted">Dim {wave.dim}</div>
                  <div className="text-xs" style={{ color }}>
                    {FREQ_LABELS[index]}
                  </div>
                </div>

                {/* Wave visualization */}
                <div className="flex-1">
                  <svg
                    className="w-full"
                    viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ height: "64px" }}
                  >
                    {/* Center line */}
                    <line
                      x1="0"
                      y1={waveCenterY}
                      x2={WAVE_WIDTH}
                      y2={waveCenterY}
                      stroke={grid.line}
                      strokeWidth="0.5"
                      opacity={0.3}
                    />
                    {/* Filled area under wave up to current position */}
                    <path
                      d={generateFillPath(wave.dim, WAVE_WIDTH, WAVE_HEIGHT, positionFrac)}
                      fill={withAlpha(color, 0.08)}
                    />
                    {/* Wave path */}
                    <path
                      d={generateWavePath(wave.dim, WAVE_WIDTH, WAVE_HEIGHT)}
                      fill="none"
                      stroke={grid.line}
                      strokeWidth="1.5"
                    />
                    {/* Vertical position line */}
                    <line
                      x1={markerX}
                      y1={4}
                      x2={markerX}
                      y2={WAVE_HEIGHT - 4}
                      stroke={grid.line}
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      opacity={0.4}
                    />
                    {/* Marker */}
                    <circle
                      cx={markerX}
                      cy={markerY}
                      r={5}
                      fill={color}
                      stroke={withAlpha(color, 0.5)}
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>

                {/* Value display */}
                <div className="w-16 shrink-0 text-right">
                  <div
                    className="text-sm font-mono tabular-nums"
                    style={{ color }}
                  >
                    {sign}{wave.value.toFixed(2)}
                  </div>
                  {/* Tiny horizontal bar showing value direction */}
                  <svg width="48" height="6" viewBox="0 0 48 6" className="ml-auto mt-0.5">
                    <line x1="24" y1="3" x2="24" y2="3" stroke={grid.line} strokeWidth="1" />
                    <rect
                      x={wave.value >= 0 ? 24 : 24 + wave.value * 22}
                      y="1"
                      width={Math.abs(wave.value) * 22}
                      height="4"
                      rx="1"
                      fill={withAlpha(color, 0.6)}
                    />
                    {/* Center tick */}
                    <line x1="24" y1="0" x2="24" y2="6" stroke={grid.line} strokeWidth="0.5" opacity={0.5} />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>

        {/* Fingerprint section */}
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-[11px] text-muted text-center mb-2">
            Encoding Vector at Position {Math.round(position)}
          </div>
          <svg
            className="w-full max-w-[240px] mx-auto"
            viewBox="0 0 200 50"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Zero baseline */}
            <line x1="10" y1="25" x2="190" y2="25" stroke={grid.line} strokeWidth="0.5" opacity={0.4} />

            {waves.map((wave, i) => {
              const color = DIM_COLORS[i];
              const barWidth = 30;
              const gap = 12;
              const totalWidth = 4 * barWidth + 3 * gap;
              const startX = (200 - totalWidth) / 2;
              const x = startX + i * (barWidth + gap);
              const barHeight = Math.abs(wave.value) * 22;
              const y = wave.value >= 0 ? 25 - barHeight : 25;

              return (
                <g key={wave.dim}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="2"
                    fill={withAlpha(color, 0.7)}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={48}
                    fill={grid.label}
                    fontSize="7"
                    textAnchor="middle"
                  >
                    d{wave.dim}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
