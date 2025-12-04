// Monaco Editor Preloader
// Eagerly loads Monaco in the background to eliminate loading delay when opening challenges
// This is a common best practice for browser-based editors

import { loader } from "@monaco-editor/react";

let isPreloading = false;
let isLoaded = false;

// Custom Monaco theme definition (must match ChallengeWorkspace)
const ZINC_DARK_THEME = {
  base: "vs-dark" as const,
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

/**
 * Preload Monaco editor in the background.
 * Call this early in app lifecycle (e.g., on homepage or course page load)
 * to ensure Monaco is ready before user opens a challenge.
 */
export async function preloadMonaco(): Promise<void> {
  // Skip if already loaded or loading
  if (isLoaded || isPreloading) {
    return;
  }

  // Skip on server-side
  if (typeof window === "undefined") {
    return;
  }

  isPreloading = true;

  try {
    // Get the Monaco instance - this triggers the load
    const monaco = await loader.init();

    // Pre-define our custom theme so it's ready immediately when editor mounts
    monaco.editor.defineTheme("zinc-dark", ZINC_DARK_THEME);

    isLoaded = true;
  } catch (error) {
    console.error("Failed to preload Monaco:", error);
  } finally {
    isPreloading = false;
  }
}

/**
 * Check if Monaco has been preloaded
 */
export function isMonacoPreloaded(): boolean {
  return isLoaded;
}
