/**
 * Centralized color palette for SVG visualizations.
 *
 * SVG fill/stroke attributes cannot use CSS var(), so all visualization
 * hex values live here instead of in globals.css.
 */

// ---------------------------------------------------------------------------
// Accent palette – used for data points, lines, and highlights
// ---------------------------------------------------------------------------
export const viz = {
  blue: "#3b82f6",
  blueLight: "#60a5fa",
  amber: "#f59e0b",
  amberDark: "#d97706",
  amberLight: "#fbbf24",
  pink: "#ec4899",
  emerald: "#10b981",
  emeraldDark: "#0d9668",
  purple: "#a855f7",
  rose: "#fb7185",
  slate: "#64748b",
} as const;

// ---------------------------------------------------------------------------
// Grid & axis colors – structural elements behind the data
// ---------------------------------------------------------------------------
export const grid = {
  line: "#3f3f46",
  subtle: "#1c1c1e",
  axis: "#333333",
  axisBold: "#444444",
  dot: "#666666",
  label: "#52525b",
  labelLight: "#555555",
} as const;
