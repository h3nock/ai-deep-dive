"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";

/**
 * FrequencyWaves - Interactive visualization of sinusoidal positional encoding
 *
 * Shows multiple sine waves at different frequencies with rotating clock hands,
 * demonstrating how each "dimension" cycles at a different speed.
 */

const D_MODEL = 32;
const MAX_POSITION = 100;

function computeSinusoidal(pos: number, dim: number, dModel: number): number {
  const denominator = Math.pow(10000, (2 * dim) / dModel);
  return Math.sin(pos / denominator);
}

export function FrequencyWaves() {
  const [position, setPosition] = useState(25);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Animation loop
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setPosition((prev) => {
          const next = prev + 0.3;
          return next > MAX_POSITION ? 0 : next;
        });
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

  // Compute wave values for display dimensions
  const waves = useMemo(() => {
    const dims = [0, 2, 4, 6];
    return dims.map((dim) => {
      const denominator = Math.pow(10000, (2 * dim) / D_MODEL);
      const angle = position / denominator;
      return {
        dim,
        value: Math.sin(angle),
        angle: angle,
        wavelength: 2 * Math.PI * denominator,
      };
    });
  }, [position]);

  // Generate wave path data for SVG - use MAX_POSITION for full range
  const generateWavePath = (dim: number, width: number, height: number): string => {
    const points: string[] = [];
    const centerY = height / 2;
    const amplitude = (height / 2) * 0.8;

    for (let x = 0; x <= width; x += 0.5) {
      const pos = (x / width) * MAX_POSITION; // Map to full position range
      const value = computeSinusoidal(pos, dim, D_MODEL);
      const y = centerY - value * amplitude;
      points.push(`${x === 0 ? "M" : "L"} ${x} ${y}`);
    }
    return points.join(" ");
  };

  const getFrequencyLabel = (index: number): string => {
    const labels = ["Fastest", "Fast", "Medium", "Slow"];
    return labels[index] || "";
  };
  
  const getColor = (index: number): string => {
    const colors = ["#10b981", "#f59e0b", "#3b82f6", "#a855f7"];
    return colors[index] || "#10b981";
  };

  const CLOCK_SIZE = 32;
  const CLOCK_RADIUS = 12;
  const CLOCK_CENTER = CLOCK_SIZE / 2;

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
        {/* Controls - aligned with wave rows below */}
        <div className="flex items-center gap-3 mb-4">
          {/* Play/Pause Button - same size as clock container */}
          <div className="shrink-0">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg className="w-3.5 h-3.5 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Label - same width as wave label div (w-20) */}
          <div className="w-20 shrink-0">
            <span className="text-sm text-muted">Pos:</span>
          </div>
          
          {/* Slider - same structure as wave visualization div */}
          <div className="flex-1 h-10 relative">
            <input
              type="range"
              min="0"
              max={MAX_POSITION}
              step="0.5"
              value={position}
              onChange={(e) => {
                setIsPlaying(false);
                setPosition(parseFloat(e.target.value));
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            {/* Visual track that matches wave SVG dimensions exactly */}
            <svg
              className="w-full h-full"
              viewBox="0 0 200 40"
              preserveAspectRatio="none"
            >
              {/* Track line */}
              <line x1="0" y1="20" x2="200" y2="20" stroke="#3f3f46" strokeWidth="3" strokeLinecap="round" />
            </svg>
            {/* Thumb marker - same positioning logic as wave dots */}
            <div
              className="absolute w-3 h-3 rounded-full bg-emerald-500"
              style={{
                left: `${(position / MAX_POSITION) * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>

          <span className="text-lg font-mono text-emerald-400 w-14 text-right">
            {Math.round(position)}
          </span>
        </div>

        {/* Waves with Clocks */}
        <div className="space-y-3">
          {waves.map((wave, index) => {
            const handX = CLOCK_CENTER + CLOCK_RADIUS * Math.cos(wave.angle);
            const handY = CLOCK_CENTER - CLOCK_RADIUS * Math.sin(wave.angle);
            const color = getColor(index);
            
            return (
              <div key={wave.dim} className="flex items-center gap-3">
                {/* Clock */}
                <div className="shrink-0">
                  <svg width={CLOCK_SIZE} height={CLOCK_SIZE} viewBox={`0 0 ${CLOCK_SIZE} ${CLOCK_SIZE}`}>
                    <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={CLOCK_RADIUS} fill="none" stroke="#333" strokeWidth="1.5" />
                    <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r="2" fill="#666" />
                    <line 
                      x1={CLOCK_CENTER} y1={CLOCK_CENTER} 
                      x2={handX} y2={handY} 
                      stroke={color} strokeWidth="2" strokeLinecap="round"
                    />
                    <circle cx={handX} cy={handY} r="2.5" fill={color} />
                  </svg>
                </div>

                {/* Label */}
                <div className="w-20 shrink-0">
                  <div className="text-xs text-muted">Dim {wave.dim}</div>
                  <div className="text-xs" style={{ color }}>{getFrequencyLabel(index)}</div>
                </div>

                {/* Wave visualization */}
                <div className="flex-1 h-10 relative">
                  <svg
                    className="w-full h-full"
                    viewBox="0 0 200 40"
                    preserveAspectRatio="none"
                  >
                    <path
                      d={generateWavePath(wave.dim, 200, 40)}
                      fill="none"
                      stroke="#3f3f46"
                      strokeWidth="1.5"
                    />
                  </svg>
                  {/* Marker as absolute div to maintain perfect circle shape */}
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full"
                    style={{
                      left: `${(position / MAX_POSITION) * 100}%`,
                      top: `${50 - wave.value * 40}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: color,
                    }}
                  />
                </div>

                {/* Value */}
                <div className="w-14 text-right font-mono text-sm" style={{ color }}>
                  {wave.value.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>


      </div>
    </div>
  );
}

