import type { editor } from "monaco-editor";

export const MONACO_THEME_NAME = "zinc-dark";

export const ZINC_DARK_THEME: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#09090B",
    "editor.foreground": "#D4D4D8",
    "editor.lineHighlightBackground": "#18181B",
    "editor.selectionBackground": "#27272A",
    "editorGutter.background": "#09090B",
    "editorCursor.foreground": "#D4D4D8",
    "minimap.background": "#09090B",
    "scrollbarSlider.background": "#27272A80",
    "scrollbarSlider.hoverBackground": "#3f3f4680",
  },
};
