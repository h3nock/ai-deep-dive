"use client";

import { useEffect } from "react";
import { preloadMonaco } from "@/lib/monaco-preload";

/**
 * App-level Monaco preloader component.
 * Preloads Monaco during browser idle time to avoid blocking initial render.
 * This ensures the editor is ready by the time a user navigates to challenges.
 */
export function MonacoPreloader() {
  useEffect(() => {
    // Use requestIdleCallback to avoid blocking initial page render
    const ric = window.requestIdleCallback;
    if (ric) {
      const handle = ric(() => preloadMonaco(), { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }

    // Fallback for Safari: delay slightly to let initial render complete
    const timer = setTimeout(preloadMonaco, 100);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
