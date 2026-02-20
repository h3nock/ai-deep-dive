"use client";

import { useEffect } from "react";

const COPY_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

function createCopyButton(code: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "code-copy-btn";
  btn.setAttribute("aria-label", "Copy code");
  btn.innerHTML = `<span class="code-copy-icon">${COPY_SVG}</span><span class="code-check-icon">${CHECK_SVG}</span>`;

  let timer: ReturnType<typeof setTimeout>;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      clearTimeout(timer);
      btn.classList.add("copied");
      timer = setTimeout(() => btn.classList.remove("copied"), 2000);
    } catch {
      // Clipboard API not available
    }
  });

  return btn;
}

/**
 * Injects copy buttons into all rehype-pretty-code figures
 * within the referenced container element.
 */
export function CodeBlockCopyButtons({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const figures = container.querySelectorAll("[data-rehype-pretty-code-figure]");
    const injected: HTMLButtonElement[] = [];

    figures.forEach((figure) => {
      if (figure.querySelector(".code-copy-btn")) return;

      figure.classList.add("relative", "group");
      const code = figure.querySelector("code")?.textContent ?? "";
      const btn = createCopyButton(code);
      figure.appendChild(btn);
      injected.push(btn);
    });

    return () => {
      injected.forEach((btn) => btn.remove());
    };
  }, [containerRef]);

  return null;
}
