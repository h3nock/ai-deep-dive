/**
 * Centralized color palette for SVG visualizations.
 *
 * SVG fill/stroke attributes cannot use CSS var(), so all visualization
 * hex values live here instead of in globals.css.
 *
 * Names are semantic (role-based), not literal colors. Each visualization
 * component assigns its own meaning to these roles — e.g. "primary" might
 * represent a rotation arc in one component and a ReLU curve in another.
 * Changing a hex value here updates every visualization without renaming.
 *
 * For Tailwind-styled HTML elements inside viz components (buttons, labels,
 * legends), use inline styles with these tokens instead of literal Tailwind
 * color classes. This keeps the palette as a single source of truth.
 */

// ---------------------------------------------------------------------------
// Categorical accent palette — ordered by visual prominence
// Works on both dark and light backgrounds (saturated hues)
// ---------------------------------------------------------------------------
export const viz = {
  primary: "#3b82f6",
  primaryLight: "#60a5fa",
  secondary: "#f59e0b",
  secondaryDark: "#d97706",
  secondaryLight: "#fbbf24",
  tertiary: "#10b981",
  tertiaryDark: "#0d9668",
  quaternary: "#a855f7",
  accent: "#ec4899",
  highlight: "#fb7185",
  neutral: "#64748b",
} as const;

// ---------------------------------------------------------------------------
// Grid & axis colors — structural elements behind the data
// Dark and light variants for theme switching
// ---------------------------------------------------------------------------
type GridPalette = {
  line: string;
  subtle: string;
  axis: string;
  axisBold: string;
  dot: string;
  label: string;
  labelLight: string;
  text: string;
};

const darkGrid: GridPalette = {
  line: "#3f3f46",
  subtle: "#1c1c1e",
  axis: "#333333",
  axisBold: "#444444",
  dot: "#666666",
  label: "#52525b",
  labelLight: "#555555",
  text: "#d4d4d8",
};

const lightGrid: GridPalette = {
  line: "#d4d4d8",
  subtle: "#f4f4f5",
  axis: "#a1a1aa",
  axisBold: "#71717a",
  dot: "#a1a1aa",
  label: "#71717a",
  labelLight: "#a1a1aa",
  text: "#3f3f46",
};

/** Default dark grid export (for non-reactive contexts like preload) */
export const grid = darkGrid;

/** Get theme-appropriate grid palette */
export function getGrid(mode: "dark" | "light"): GridPalette {
  return mode === "light" ? lightGrid : darkGrid;
}

// ---------------------------------------------------------------------------
// Utility — apply alpha transparency to any palette hex
// ---------------------------------------------------------------------------
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
