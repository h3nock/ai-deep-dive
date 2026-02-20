// Monaco Editor Preloader
// Eagerly loads Monaco in the background to eliminate loading delay when opening challenges
// This is a common best practice for browser-based editors

import { loader } from "@monaco-editor/react";
import { createMonacoTheme, getMonacoThemeName } from "@/lib/monaco-theme";

let isPreloading = false;
let isLoaded = false;

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

    // Pre-define both themes so they're ready immediately when editor mounts
    monaco.editor.defineTheme(getMonacoThemeName("dark"), createMonacoTheme("dark"));
    monaco.editor.defineTheme(getMonacoThemeName("light"), createMonacoTheme("light"));

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
