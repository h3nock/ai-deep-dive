"use client";

import React, { useState, useEffect, useRef } from "react";
import { viz, grid } from "@/lib/viz-colors";

/**
 * BinaryVsSmooth - Animated visualization comparing discrete binary jumps
 * vs smooth sinusoidal oscillation for positional encoding.
 * 
 * Shows 3 dimensions at different frequencies:
 * - Dimension 0: Fastest (4 cycles)
 * - Dimension 1: Medium (2 cycles)
 * - Dimension 2: Slowest (1 cycle)
 */

const CYCLE_DURATION = 6000; // ms for one full animation loop

interface DimensionConfig {
  label: string;
  cycles: number;
  speedLabel: string;
}

const DIMENSIONS: DimensionConfig[] = [
  { label: "Dim 0", cycles: 4, speedLabel: "Fast" },
  { label: "Dim 1", cycles: 2, speedLabel: "Medium" },
  { label: "Dim 2", cycles: 1, speedLabel: "Slow" },
];

export function BinaryVsSmooth() {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const animate = (time: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = time;
        }
        const elapsed = time - startTimeRef.current;
        const newProgress = (elapsed % CYCLE_DURATION) / CYCLE_DURATION;
        setProgress(newProgress);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  const GRAPH_WIDTH = 180;
  const GRAPH_HEIGHT = 36;
  const PADDING_Y = 4;

  // Calculate smooth value: (1 - cos(2π * cycles * t)) / 2
  const getSmoothValue = (t: number, cycles: number): number => {
    return (1 - Math.cos(t * 2 * Math.PI * cycles)) / 2;
  };

  // Calculate binary value: step function based on phase
  const getBinaryValue = (t: number, cycles: number): number => {
    const phase = (t * cycles) % 1;
    return phase < 0.5 ? 0 : 1;
  };

  // Convert value (0-1) to Y coordinate
  const valueToY = (value: number): number => {
    const usableHeight = GRAPH_HEIGHT - PADDING_Y * 2;
    return PADDING_Y + usableHeight * (1 - value);
  };

  // Generate smooth sine path
  const generateSmoothPath = (cycles: number): string => {
    const points: string[] = [];
    for (let i = 0; i <= GRAPH_WIDTH; i++) {
      const t = i / GRAPH_WIDTH;
      const value = getSmoothValue(t, cycles);
      const y = valueToY(value);
      points.push(`${i === 0 ? "M" : "L"} ${i} ${y.toFixed(1)}`);
    }
    return points.join(" ");
  };

  // Generate binary step path
  const generateBinaryPath = (cycles: number): string => {
    const segments: string[] = [];
    const stepWidth = GRAPH_WIDTH / (cycles * 2);
    
    let isHigh: boolean = false;
    
    segments.push(`M 0 ${valueToY(0)}`);
    
    for (let i = 0; i < cycles * 2; i++) {
      const nextX = Math.min((i + 1) * stepWidth, GRAPH_WIDTH);
      const currentY = valueToY(isHigh ? 1 : 0);
      const nextIsHigh: boolean = !isHigh;
      const nextY = valueToY(nextIsHigh ? 1 : 0);
      
      // Horizontal line at current level
      segments.push(`L ${nextX.toFixed(1)} ${currentY.toFixed(1)}`);
      // Vertical jump to next level (if not last segment)
      if (i < cycles * 2 - 1) {
        segments.push(`L ${nextX.toFixed(1)} ${nextY.toFixed(1)}`);
      }
      
      isHigh = nextIsHigh;
    }
    
    return segments.join(" ");
  };

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
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              if (!isPlaying) {
                startTimeRef.current = null;
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Column Headers */}
          <div className="flex-1 grid grid-cols-[60px_1fr_1fr] gap-2 text-center">
            <div></div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: viz.highlight }}>
                Binary
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: viz.tertiary }}>
                Smooth
              </span>
            </div>
          </div>
        </div>

        {/* Dimension rows */}
        <div className="space-y-2">
          {DIMENSIONS.map((dim, idx) => {
            const markerX = progress * GRAPH_WIDTH;
            const binaryValue = getBinaryValue(progress, dim.cycles);
            const smoothValue = getSmoothValue(progress, dim.cycles);
            const binaryY = valueToY(binaryValue);
            const smoothY = valueToY(smoothValue);

            return (
              <div key={idx} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
                {/* Label */}
                <div className="text-right pr-1">
                  <div className="text-[11px] font-medium text-primary leading-tight">{dim.label}</div>
                  <div className="text-[9px] text-zinc-500">{dim.speedLabel}</div>
                </div>

                {/* Binary graph */}
                <div className="bg-zinc-900/50 rounded border border-border p-1 relative">
                  <svg
                    className="w-full"
                    viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                    preserveAspectRatio="none"
                    style={{ height: "32px" }}
                  >
                    <path
                      d={generateBinaryPath(dim.cycles)}
                      fill="none"
                      stroke={grid.line}
                      strokeWidth="1.5"
                    />
                  </svg>
                  {/* Marker as absolute div to maintain perfect circle shape */}
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: viz.highlight,
                      left: `calc(4px + ${(markerX / GRAPH_WIDTH) * 100}% * (1 - 8px / 100%))`,
                      top: `calc(4px + ${(binaryY / GRAPH_HEIGHT) * 100}% * (1 - 8px / 100%))`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                </div>

                {/* Smooth graph */}
                <div className="bg-zinc-900/50 rounded border border-border p-1 relative">
                  <svg
                    className="w-full"
                    viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                    preserveAspectRatio="none"
                    style={{ height: "32px" }}
                  >
                    <path
                      d={generateSmoothPath(dim.cycles)}
                      fill="none"
                      stroke={grid.line}
                      strokeWidth="1.5"
                    />
                  </svg>
                  {/* Marker as absolute div to maintain perfect circle shape */}
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: viz.tertiary,
                      left: `calc(4px + ${(markerX / GRAPH_WIDTH) * 100}% * (1 - 8px / 100%))`,
                      top: `calc(4px + ${(smoothY / GRAPH_HEIGHT) * 100}% * (1 - 8px / 100%))`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
