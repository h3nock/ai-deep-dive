"use client";

import React, { useState } from "react";

/**
 * RotationVisualization - Interactive demonstration of how rotation matrix transforms vectors
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
  
  const sinOutput = cosTheta * sinInput + sinTheta * cosInput;
  const cosOutput = -sinTheta * sinInput + cosTheta * cosInput;

  const inputX = CENTER + sinInput * CIRCLE_RADIUS;
  const inputY = CENTER - cosInput * CIRCLE_RADIUS;
  const outputX = CENTER + sinOutput * CIRCLE_RADIUS;
  const outputY = CENTER - cosOutput * CIRCLE_RADIUS;

  const fmt = (n: number) => {
    // Fix negative zero display
    const val = Object.is(n, -0) || Math.abs(n) < 0.005 ? 0 : n;
    return val.toFixed(2);
  };

  const positionPresets = [
    { name: "Top", angle: 0 },
    { name: "Right", angle: 90 },
    { name: "Bottom", angle: 180 },
    { name: "Left", angle: 270 },
  ];

  const highlightBg = "rgba(63, 63, 70, 0.6)";
  const arcRadius = CIRCLE_RADIUS * 0.45;

  return (
    <div style={{ marginTop: "var(--space-connected)", marginBottom: "var(--space-flow)" }}>
      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
        Interactive: Matrix Multiplication in Action
      </div>

      <div className="p-4 bg-[#121212] rounded-lg border border-zinc-800">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-secondary">Start at:</span>
            <div className="flex gap-1">
              {positionPresets.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setInputAngleDegrees(p.angle)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    inputAngleDegrees === p.angle
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-secondary'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <span className="text-emerald-400 font-mono text-xs">
              [{fmt(sinInput)}, {fmt(cosInput)}]
            </span>
          </div>

          <div className="w-px bg-zinc-700 hidden sm:block" />

          <div className="flex items-center gap-3">
            <span className="text-secondary">Rotate by:</span>
            <div className="flex gap-1">
              {[30, 45, 60, 90].map((deg) => (
                <button
                  key={deg}
                  onClick={() => setRotationDegrees(deg)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    rotationDegrees === deg 
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                      : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-secondary'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main visualization */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Circle Diagram */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <svg width="210" height="230" viewBox="0 0 210 230">
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
                  <path d="M0,2 L0,8 L6,5 Z" fill="#3b82f6" />
                </marker>
              </defs>

              <line x1="10" y1={CENTER} x2="200" y2={CENTER} stroke="#333" strokeWidth="1" />
              <line x1={CENTER} y1="10" x2={CENTER} y2="200" stroke="#333" strokeWidth="1" />
              <circle cx={CENTER} cy={CENTER} r={CIRCLE_RADIUS} fill="none" stroke="#444" strokeWidth="1.5" />
              
              {rotationDegrees > 0 && (
                <path
                  d={createRotationArc(inputAngleDegrees, rotationDegrees, arcRadius, CENTER)}
                  fill="none" 
                  stroke="#3b82f6" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                  markerEnd="url(#arrowMarker)"
                />
              )}

              <line x1={CENTER} y1={CENTER} x2={inputX} y2={inputY} stroke="#10b981" strokeWidth="2.5" />
              <line x1={CENTER} y1={CENTER} x2={outputX} y2={outputY} stroke="#f59e0b" strokeWidth="2.5" />

              <circle cx={inputX} cy={inputY} r="7" fill="#10b981" stroke="#0d9668" strokeWidth="1" />
              <circle cx={outputX} cy={outputY} r="7" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />

              <text x="198" y={CENTER - 6} fill="#555" fontSize="10" textAnchor="end">sin</text>
              <text x={CENTER + 6} y="16" fill="#555" fontSize="10">cos</text>

              {rotationDegrees > 0 && (
                <text x={CENTER} y={220} fill="#3b82f6" fontSize="11" textAnchor="middle" fontWeight="500">
                  Rotation: {rotationDegrees}°
                </text>
              )}
            </svg>

            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-secondary">Input</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-secondary">Output</span>
              </div>
            </div>
          </div>

          {/* Matrix Equation - no extra container */}
          <div className="flex items-center gap-2 font-mono text-sm flex-wrap flex-1">
            {/* Output vector */}
            <div className="flex flex-col p-2 border-l-2 border-r-2 border-amber-500 rounded bg-amber-500/10 shrink-0">
              <span className="text-amber-400 font-bold text-center px-2">{fmt(sinOutput)}</span>
              <span className="text-amber-400 font-bold text-center px-2">{fmt(cosOutput)}</span>
            </div>
            
            <span className="text-muted">=</span>

            {/* Rotation matrix */}
            <div className="flex flex-col p-2 border-l-2 border-r-2 border-blue-500 rounded bg-blue-500/10 shrink-0">
              <div 
                className="flex py-0.5 px-1 rounded transition-colors"
                style={{ backgroundColor: highlightRow === 0 ? highlightBg : 'transparent' }}
              >
                <span className="w-14 text-center text-blue-400 shrink-0">{fmt(cosTheta)}</span>
                <span className="w-14 text-center text-blue-400 shrink-0">{fmt(sinTheta)}</span>
              </div>
              <div 
                className="flex py-0.5 px-1 rounded transition-colors"
                style={{ backgroundColor: highlightRow === 1 ? highlightBg : 'transparent' }}
              >
                <span className="w-14 text-center text-blue-400 shrink-0">{fmt(-sinTheta)}</span>
                <span className="w-14 text-center text-blue-400 shrink-0">{fmt(cosTheta)}</span>
              </div>
            </div>

            <span className="text-muted">×</span>

            {/* Input vector */}
            <div 
              className="flex flex-col p-2 border-l-2 border-r-2 border-emerald-500 rounded transition-colors shrink-0"
              style={{ backgroundColor: highlightRow !== null ? highlightBg : 'rgba(16, 185, 129, 0.1)' }}
            >
              <span className="text-emerald-400 font-bold text-center px-2">{fmt(sinInput)}</span>
              <span className="text-emerald-400 font-bold text-center px-2">{fmt(cosInput)}</span>
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
                <span className="text-blue-400">{fmt(cosTheta)}</span>
                <span className="text-zinc-500">×</span>
                <span className="text-emerald-400">{fmt(sinInput)}</span>
                <span className="text-zinc-500"> + </span>
                <span className="text-blue-400">{fmt(sinTheta)}</span>
                <span className="text-zinc-500">×</span>
                <span className="text-emerald-400">{fmt(cosInput)}</span>
              </div>
              <div 
                className="py-1 px-2 rounded cursor-pointer transition-colors text-xs whitespace-nowrap"
                style={{ backgroundColor: highlightRow === 1 ? highlightBg : 'transparent' }}
                onMouseEnter={() => setHighlightRow(1)}
                onMouseLeave={() => setHighlightRow(null)}
              >
                <span className="text-blue-400">{fmt(-sinTheta)}</span>
                <span className="text-zinc-500">×</span>
                <span className="text-emerald-400">{fmt(sinInput)}</span>
                <span className="text-zinc-500"> + </span>
                <span className="text-blue-400">{fmt(cosTheta)}</span>
                <span className="text-zinc-500">×</span>
                <span className="text-emerald-400">{fmt(cosInput)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function createRotationArc(inputAngleDeg: number, rotationDeg: number, radius: number, center: number): string {
  const startAngle = 90 - inputAngleDeg;
  const endAngle = 90 - inputAngleDeg - rotationDeg;
  
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  
  const startX = center + radius * Math.cos(startRad);
  const startY = center - radius * Math.sin(startRad);
  const endX = center + radius * Math.cos(endRad);
  const endY = center - radius * Math.sin(endRad);
  
  const largeArcFlag = Math.abs(rotationDeg) > 180 ? 1 : 0;
  const sweepFlag = 1;
  
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;
}
