"use client";

import { useEffect } from "react";
import { preloadMonaco } from "@/lib/monaco-preload";

/**
 * App-level Monaco preloader component.
 * Triggers Monaco preload immediately on app mount, before user navigates to challenges.
 * This ensures the editor is ready instantly when needed.
 */
export function MonacoPreloader() {
  useEffect(() => {
    // Start preloading Monaco immediately
    // This runs on first page load regardless of which page
    preloadMonaco();
  }, []);

  // This component renders nothing
  return null;
}
