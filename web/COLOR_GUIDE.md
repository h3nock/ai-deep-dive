# Color System Guide

> **Philosophy**: Eye-safe dark theme optimized for long hours reading sessions.
> No pure whites (#FFFFFF) or pure blacks (#000000). No blue light strain. No glare. 

---

## Core Palette

### Backgrounds (The Canvas)

| Name               | Hex         | Tailwind          | Usage                                       |
| ------------------ | ----------- | ----------------- | ------------------------------------------- |
| **Void**     | `#09090B` | `bg-background` | Page background - the darkest layer         |
| **Surface**  | `#18181B` | `bg-surface`    | Elevated elements: cards, sidebars, headers |
| **Terminal** | `#121212` | `bg-[#121212]`  | Code blocks, data containers                |

```
Depth Stack (darkest to lightest):
#09090B (void) → #121212 (terminal) → #18181B (surface) → #27272A (hover)
```

---

### Text Hierarchy

| Name                | Hex         | Tailwind           | Usage                                   |
| ------------------- | ----------- | ------------------ | --------------------------------------- |
| **Primary**   | `#D4D4D8` | `text-primary`   | Headings, bold text, important labels   |
| **Secondary** | `#A1A1AA` | `text-secondary` | Body text, paragraphs                   |
| **Muted**     | `#71717A` | `text-muted`     | Labels, captions, meta info, timestamps |
| **Links**     | `#D4D4D8` | `text-primary`   | Interactive text elements (underline)   |

```
Reading contrast (lightest to darkest):
#D4D4D8 (primary) → #A1A1AA (secondary) → #71717A (muted)
```

---

### Borders & Dividers

| Name                    | Hex         | Tailwind            | Usage                           |
| ----------------------- | ----------- | ------------------- | ------------------------------- |
| **Border**        | `#27272A` | `border-border`   | Default borders, table dividers |
| **Border Hover**  | `#3F3F46` | `border-zinc-700` | Hover state borders             |
| **Border Subtle** | `#27272A` | `border-zinc-800` | Container edges                 |

---

## Semantic Colors

### State Indicators

| State             | Color   | Text                 | Border                    | Background            |
| ----------------- | ------- | -------------------- | ------------------------- | --------------------- |
| **Success** | Emerald | `text-emerald-400` | `border-emerald-400/50` | `bg-emerald-500/20` |
| **Error**   | Rose    | `text-rose-400`    | `border-rose-400/50`    | `bg-rose-500/20`    |
| **Warning** | Amber   | `text-amber-400`   | `border-amber-500/50`   | `bg-amber-500/20`   |
| **Info**    | Sky     | `text-sky-400`     | `border-sky-500/50`     | `bg-sky-500/20`     |
| **Neutral** | Zinc    | `text-zinc-400`    | `border-zinc-700`       | `bg-zinc-800`       |

### Highlight Combinations

```jsx
{/* Success highlight (selected/active items) */}
bg-emerald-500/20 text-emerald-400

{/* Success subtle (hover states, borders) */}
bg-emerald-500/10 border border-emerald-500/30 text-emerald-400

{/* Neutral selection */}
bg-zinc-800 text-secondary
```

---

## Usage By Element

### Headings

```jsx
<h1 className="text-primary">   {/* #D4D4D8 */}
<h2 className="text-primary">
<h3 className="text-primary">
```

### Body Text

```jsx
<p className="text-secondary">  {/* #A1A1AA */}
```

### Labels & Captions

```jsx
<span className="text-muted">   {/* #71717A */}
<div className="text-xs font-medium text-muted uppercase tracking-wider">
```
### Interactive Elements

| State | Color | Class |
|-------|-------|-------|
| **Hover (List Items)** | Zinc 900 (50% Opacity) | `hover:bg-zinc-900/50` |
| **Hover (Buttons)** | Surface (Solid) | `hover:bg-surface` |
| **Active/Selected** | Zinc 800 | `bg-zinc-800` |

> [!NOTE]
> Use `hover:bg-zinc-900/50` for list items (timeline, challenges) to maintain a subtle, premium feel. Use solid `hover:bg-surface` for distinct buttons.
### Code

```jsx
{/* Inline code */}
<code className="bg-surface text-secondary">  {/* #18181B bg, #A1A1AA text */}

{/* Code blocks */}
<pre className="bg-[#121212] border border-zinc-800">
```

### Containers

```jsx
{/* Terminal-style data container */}
<div className="bg-[#121212] border border-zinc-800">

{/* Elevated card */}
<div className="bg-surface border border-border">
```

### Left-Border Emphasis

```jsx
{/* Neutral emphasis */}
<div className="border-l-2 border-zinc-600">

{/* Success/Summary emphasis */}
<div className="border-l-2 border-emerald-400/50">

{/* Warning emphasis */}
<div className="border-l-2 border-amber-500/50">
```

---

## Callout Type Colors

| Type        | Border                    | Icon                 |
| ----------- | ------------------------- | -------------------- |
| `note`    | `border-zinc-700`       | `text-zinc-400`    |
| `tip`     | `border-zinc-700`       | `text-zinc-400`    |
| `info`    | `border-sky-500/50`     | `text-sky-400`     |
| `warning` | `border-amber-500/50`   | `text-amber-400`   |
| `success` | `border-emerald-400/50` | `text-emerald-400` |

---

## Forbidden Colors

### Never Use These

| Forbidden          | Why                            | Use Instead                          |
| ------------------ | ------------------------------ | ------------------------------------ |
| `text-white`     | Too bright, causes eye strain  | `text-primary` (#D4D4D8)           |
| `text-sky-400`   | Breaks monochrome theme (body) | `text-primary underline`           |
| `text-black`     | Not visible on dark bg         | `text-secondary` or `text-muted` |
| `bg-white`       | We're dark-mode only           | Never needed                         |
| `bg-black`       | Slightly warmer void is better | `bg-background` (#09090B)          |
| `bg-emerald-500` | Pure saturated too harsh       | `bg-emerald-500/20` (with opacity) |
| `#FFFFFF`        | Pure white                     | `#D4D4D8` max                      |
| `#000000`        | Pure black                     | `#09090B` min                      |

---

## Quick Reference Cheatsheet

```
BACKGROUNDS
  Page void:        bg-background    #09090B
  Terminal/Code:    bg-[#121212]     #121212
  Elevated:         bg-surface       #18181B
  Hover:            bg-zinc-800      #27272A

TEXT
  Headings/Bold:    text-primary     #D4D4D8
  Body:             text-secondary   #A1A1AA
  Labels/Meta:      text-muted       #71717A
  Links:            text-primary     #D4D4D8 (underline)

BORDERS
  Default:          border-border    #27272A
  Subtle:           border-zinc-800  #27272A
  Hover:            border-zinc-700  #3F3F46
  Emphasis:         border-zinc-600  #52525B

SEMANTIC COLORS
  Success:          emerald-400      #34D399
  Error:            rose-400         #FB7185
  Warning:          amber-400        #FBBF24
  Info:             sky-400          #38BDF8

OPACITY PATTERNS
  Solid bg:         bg-{color}-500/20
  Subtle bg:        bg-{color}-500/10
  Border:           border-{color}-500/50 or border-{color}-400/50
```

---

## CSS Variable Reference

Defined in `globals.css`:

```css
--color-background: #09090b; /* Zinc-950 */
--color-surface: #18181b; /* Zinc-900 */
--color-primary: #d4d4d8; /* Zinc-300 */
--color-secondary: #a1a1aa; /* Zinc-400 */
--color-muted: #71717a; /* Zinc-500 */
--color-border: #27272a; /* Zinc-800 */
--color-success: #34d399; /* Emerald-400 */
--color-error: #fb7185; /* Rose-400 */
```
