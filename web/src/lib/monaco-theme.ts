import type { editor } from "monaco-editor";

export type ColorMode = "dark" | "light";

export const MONACO_THEME_NAME = "zinc-dark";

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

export function createMonacoTheme(mode: ColorMode = "dark"): editor.IStandaloneThemeData {
  if (mode === "light") {
    // Stub: returns dark values until light palette is defined in Group 6
    return { base: "vs-dark", inherit: true, rules: [], colors: DARK_COLORS };
  }
  return { base: "vs-dark", inherit: true, rules: [], colors: DARK_COLORS };
}
