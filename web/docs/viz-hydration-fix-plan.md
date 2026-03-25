# Visualization Hydration Fix Plan

## Branch / worktree

- Branch: `viz-hydration-fix`
- Worktree: `/Users/macbook/ai-deep-dive/worktrees/viz-hydration-fix`
- Base: `origin/main`

## Goal

Fix the lesson-visual hydration mismatches **without** adding mount-time pop-in, client-only loading delays, or reduced UI responsiveness.

## Confirmed affected pages

- `/build-gpt/03-embeddings`
- `/build-gpt/04-positional-encoding`
- `/build-gpt/07-feed-forward-networks`

## Affected visualization components

- `web/src/components/mdx/EmbeddingSpace.tsx`
- `web/src/components/mdx/BinaryVsSmooth.tsx`
- `web/src/components/mdx/FrequencyWaves.tsx`
- `web/src/components/mdx/ActivationGraph.tsx`
- `web/src/components/mdx/RotationVisualization.tsx`

## Root cause

These components read the current theme during render:

- `const { resolvedTheme } = useTheme()`
- `const grid = getGrid(resolvedTheme === "light" ? "light" : "dark")`

That makes the rendered SVG/HTML attributes depend on client theme state that is not reliably known on the server. The server renders one palette and the client resolves another, causing hydration mismatches.

## Correct fix

Remove render-time theme branching from the visualizations.

Use theme-driven CSS custom properties instead of computing light/dark hex values inside React render.

Examples:

- `style={{ stroke: "var(--viz-grid-line)" }}`
- `style={{ fill: "var(--viz-grid-label)" }}`
- `style={{ color: "var(--viz-grid-text)" }}`

This keeps the markup stable across SSR and hydration while still allowing the theme to update colors immediately.

## Theme switching behavior

Theme switching must continue to work.

The fix preserves theme switching by moving the color source to CSS variables owned by the theme layer. When the theme changes, the CSS variable values change and the visuals update without requiring a different server/client render tree.

## Implementation steps

### Step 1: Add visualization CSS variables

Define visualization-specific CSS variables in the theme layer for both light and dark themes:

- `--viz-grid-line`
- `--viz-grid-subtle`
- `--viz-grid-axis`
- `--viz-grid-axis-bold`
- `--viz-grid-dot`
- `--viz-grid-label`
- `--viz-grid-label-light`
- `--viz-grid-text`

### Step 2: Refactor the affected visualizations

For each affected visualization:

- remove `useTheme()` when it is only being used for colors
- stop calling `getGrid(...)` during render
- replace theme-selected `stroke`, `fill`, and inline style values with CSS-variable-backed styles
- preserve existing layout, interactivity, and behavior

Files:

- `web/src/components/mdx/EmbeddingSpace.tsx`
- `web/src/components/mdx/BinaryVsSmooth.tsx`
- `web/src/components/mdx/FrequencyWaves.tsx`
- `web/src/components/mdx/ActivationGraph.tsx`
- `web/src/components/mdx/RotationVisualization.tsx`

### Step 3: Verify in browser

Check these pages in the browser console:

- `/build-gpt/03-embeddings`
- `/build-gpt/04-positional-encoding`
- `/build-gpt/07-feed-forward-networks`

Success criteria:

- no hydration mismatch errors
- theme toggle still updates the visuals correctly
- no client-only loading delay introduced
- no layout shift introduced
