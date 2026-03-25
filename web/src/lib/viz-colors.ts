/**
 * Centralized color palette for SVG visualizations.
 *
 * Semantic accent colors live here as fixed values. Theme-reactive visualization
 * chrome uses CSS variables so SSR and hydration render the same markup.
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
// Theme-owned CSS variables keep render output stable across SSR/hydration.
// ---------------------------------------------------------------------------
export const vizGrid = {
  line: "var(--viz-grid-line)",
  subtle: "var(--viz-grid-subtle)",
  axis: "var(--viz-grid-axis)",
  axisBold: "var(--viz-grid-axis-bold)",
  dot: "var(--viz-grid-dot)",
  label: "var(--viz-grid-label)",
  labelLight: "var(--viz-grid-label-light)",
  text: "var(--viz-grid-text)",
} as const;

// ---------------------------------------------------------------------------
// Utility — apply alpha transparency to any palette hex
// ---------------------------------------------------------------------------
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function withAlphaVar(value: string, alpha: number): string {
  const percent = Math.round(Math.max(0, Math.min(1, alpha)) * 1000) / 10;
  return `color-mix(in srgb, ${value} ${percent}%, transparent)`;
}
