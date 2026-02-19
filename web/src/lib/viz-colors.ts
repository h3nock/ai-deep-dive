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
 */

// ---------------------------------------------------------------------------
// Categorical accent palette — ordered by visual prominence
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
  danger: "#fb7185",
  neutral: "#64748b",
} as const;

// ---------------------------------------------------------------------------
// Grid & axis colors — structural elements behind the data
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
