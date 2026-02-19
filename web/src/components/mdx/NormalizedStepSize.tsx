"use client";

import React, { useState, useEffect, useRef } from "react";

/**
 * NormalizedStepSize - Visualizes how normalized positional encoding creates
 * variable step sizes as sequence length changes.
 */

export function NormalizedStepSize() {
  const [length, setLength] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [direction, setDirection] = useState(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stepSize = 1 / length;
  
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setLength(prev => {
          const next = prev + (direction * 5);
          if (next > 50) {
            setDirection(-1);
            return 50;
          }
          if (next < 5) {
            // Stop after completing one full cycle
            setIsPlaying(false);
            setDirection(1);
            return 5;
          }
          return next;
        });
      }, 500);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, direction]);

  const ticks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div className="my-6">
      <div className="p-5 bg-terminal rounded-lg border border-border">
        
        {/* Controls row */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 flex items-center justify-center rounded bg-surface hover:bg-border-hover transition-colors shrink-0"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-primary ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          
          <div className="flex-1">
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={length}
              onChange={(e) => {
                setLength(parseInt(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full h-1 bg-border-hover rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
          
          <div className="flex items-center gap-6 text-sm shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-muted">Length:</span>
              <span className="font-mono text-primary tabular-nums w-5 text-right">{length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted">Step:</span>
              <span className="font-mono text-amber-400 tabular-nums">{stepSize.toFixed(3)}</span>
            </div>
          </div>
        </div>

        {/* Number line visualization */}
        <div className="relative mx-2">
          {/* Step bracket above */}
          <div className="relative h-6 mb-2">
            <div 
              className="absolute left-0 h-full flex flex-col items-center justify-end transition-all duration-200 ease-out"
              style={{ width: `${stepSize * 100}%` }}
            >
              <span className="text-xs font-mono text-amber-400 mb-1">step</span>
              <div className="w-full h-2.5 border-l-2 border-r-2 border-t-2 border-amber-400/80 rounded-t" />
            </div>
          </div>
          
          {/* Line and dots container */}
          <div className="relative h-12">
            {/* The line - absolute center */}
            <div className="absolute top-[6px] left-0 right-0 h-[2px] bg-muted rounded-full" />
            
            {/* Dots and labels */}
            {ticks.map((value, i) => (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ 
                  left: `${value * 100}%`, 
                  transform: 'translateX(-50%)',
                  top: 0
                }}
              >
                {/* Dot - 14px total (w-3.5 h-3.5), line at 6px from top passes through center (6 + 1 = 7px center) */}
                <div className="w-3.5 h-3.5 rounded-full bg-surface border-2 border-muted" />
                <span className="text-[10px] font-mono text-muted mt-1.5 tabular-nums">
                  {value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
