import type { editor } from "monaco-editor";

export type ColorMode = "dark" | "light";

export function getMonacoThemeName(mode: ColorMode): string {
  return mode === "light" ? "zinc-light" : "zinc-dark";
}

const DARK_COLORS: editor.IStandaloneThemeData["colors"] = {
  "editor.background": "#09090B",
  "editor.foreground": "#D4D4D8",
  "editor.lineHighlightBackground": "#18181B",
  "editor.selectionBackground": "#27272A",
  "editorGutter.background": "#09090B",
  "editorCursor.foreground": "#D4D4D8",
  "minimap.background": "#09090B",
  "scrollbarSlider.background": "#27272A80",
  "scrollbarSlider.hoverBackground": "#3f3f4680",
};

const LIGHT_COLORS: editor.IStandaloneThemeData["colors"] = {
  "editor.background": "#ffffff",
  "editor.foreground": "#3f3f46",
  "editor.lineHighlightBackground": "#f4f4f5",
  "editor.selectionBackground": "#d4d4d8",
  "editorGutter.background": "#ffffff",
  "editorCursor.foreground": "#18181B",
  "minimap.background": "#ffffff",
  "scrollbarSlider.background": "#d4d4d880",
  "scrollbarSlider.hoverBackground": "#a1a1aa80",
};

export function createMonacoTheme(mode: ColorMode = "dark"): editor.IStandaloneThemeData {
  if (mode === "light") {
    return { base: "vs", inherit: true, rules: [], colors: LIGHT_COLORS };
  }
  return { base: "vs-dark", inherit: true, rules: [], colors: DARK_COLORS };
}
