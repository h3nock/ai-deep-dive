# Component & Layout Guide

> **Philosophy**: Typography-driven, void-based layout. The void (#09090B) is the canvas.
> Components float on void. No marketing-style boxed cards. Whitespace creates hierarchy.

---

## Spacing System (4-Tier)

Always use CSS variables for consistent spacing. Never use random values.

| Tier          | Variable            | Value | Tailwind | Purpose                                 |
| ------------- | ------------------- | ----- | -------- | --------------------------------------- |
| **Atomic**    | `--space-atomic`    | 8px   | `mb-2`   | Label → Component (single visual unit)  |
| **Connected** | `--space-connected` | 16px  | `mt-4`   | Intro paragraph → Example it introduces |
| **Flow**      | `--space-flow`      | 24px  | `my-6`   | Between paragraphs, standard rhythm     |
| **Section**   | `--space-section`   | 48px  | `my-12`  | Topic changes, major breaks             |

### Usage in JSX

```jsx
style={{ marginTop: "var(--space-connected)", marginBottom: "var(--space-flow)" }}
```

---

## Core MDX Components

### `<Step>` - Major Section Container

The primary structural component. Creates section breaks with borders.

```mdx
<Step title="1. Section Title">
  <Description>Introductory paragraph...</Description>

{/* Content: containers, visualizations, etc. */}

</Step>
```

**Spacing**: Section padding top/bottom (48px), border separates from next Step.

---

### `<Description>` - The Reading Paragraph

Use for all body text. Handles typography styling automatically.

```mdx
<Description>
  Body text with **bold** and `code` formatting. Links work too.
</Description>
```

**Props**:

- `noMargin` - Remove bottom margin (when parent uses `gap`)
- `attached` - Remove bottom margin (when next element is semantically part of this paragraph)

**Spacing**: Flow gap bottom (24px) by default.

---

### `<Callout>` - Highlighted Information

Left-border pattern (not boxed). Types: `note`, `tip`, `info`, `warning`, `success`.

```mdx
<Callout type="note" title="Important Distinction">
  Content here...
</Callout>

<Callout type="success" title="Summary">
  * Point one * Point two
</Callout>
```

**Special**: `success` type with "Summary" in title gets enhanced styling with emerald bullets.

---

### `<ThinkingProcess>` - Interactive Learning Block

Collapsible hint + answer reveal. Use for "pause and think" moments.

```mdx
<ThinkingProcess
  title="Think About the Trade-off"
  hint={<div>Hint content here...</div>}
>
  Answer/explanation content...
</ThinkingProcess>
```

---

### `<ByteStream>` - Byte Array Visualization

```mdx
<ByteStream
  bytes={[72, 105, 32, 240, 159, 145, 139]}
  label="What the model sees"
/>
```

---

### `<ProjectRoadmap>` - Navigation List

Auto-generates from posts with matching prefix.

```mdx
<ProjectRoadmap courseId="build-chatgpt" prefix="p1-" />
```

---

## Container Patterns

### Pattern 1: Terminal-Style Container (Basic)

For raw data display, code output, algorithm visualizations.

```jsx
<div className="p-4 bg-[#121212] rounded-lg border border-zinc-800">
  {/* content */}
</div>
```

---

### Pattern 2: Labeled Container

**Labels go OUTSIDE the container.** The container only holds data.

```jsx
<div className="my-6">
  <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
    Label Text Here
  </div>
  <div className="p-4 bg-[#121212] rounded-lg border border-zinc-800">
    {/* actual data content */}
  </div>
</div>
```

**Key Rules**:

- Wrapper div: `my-6` (flow spacing)
- Label: `mb-2` (atomic gap to container)
- Label styling: `text-xs font-medium text-muted uppercase tracking-wider`
- Container: no top margin (label handles gap)

---

### Pattern 3: Attached Content

When a paragraph ending with ":" introduces a table/container, keep them tight.

```jsx
<Description>
  Here is an example:
</Description>

<div className="mt-2">
  {/* Table or container - notice mt-2 instead of my-6 */}
</div>
```

Or use the `attached` prop:

```mdx
<Description attached>Here is an example:</Description>

| Column | Column |
| ------ | ------ |
| Data   | Data   |
```

---

### Pattern 4: Grid Cards

For concept comparisons, feature lists. Cards on void, not boxed sections.

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 my-6">
  <div className="p-4 rounded-lg bg-[#121212] border border-zinc-800">
    <div className="text-2xl font-semibold text-primary mb-1">1 Byte</div>
    <div className="text-sm text-secondary">ASCII characters</div>
    <div className="text-xs text-muted mt-2">A-Z, a-z, 0-9</div>
  </div>
  {/* more cards... */}
</div>
```

---

### Pattern 5: Left-Border Emphasis

For important statements, quotes, key insights. No box needed.

```jsx
<div className="pl-6 border-l-2 border-zinc-600">
  <p className="text-secondary">
    Important statement that deserves visual emphasis.
  </p>
</div>
```

For success/summary variant:

```jsx
<div className="pl-6 border-l-2 border-emerald-400/50">...</div>
```

---

## Vertical Timeline

For step-by-step processes, journeys, sequential data.

```jsx
<div className="my-4 relative">
  {/* The vertical line */}
  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-zinc-800" />

  <div className="space-y-6">
    {/* Step 1 */}
    <div className="relative flex gap-4">
      <div className="w-12 h-12 rounded-full bg-surface border-2 border-border flex items-center justify-center text-primary font-bold z-0">
        1
      </div>
      <div className="flex-1 pt-2">
        <div className="font-semibold text-primary">Step Title</div>
        <div className="font-mono text-sm text-secondary mt-1">
          Optional code/data preview
        </div>
        <p className="text-sm text-muted mt-2">Description of this step.</p>
      </div>
    </div>

    {/* Step 2, 3, etc... */}
  </div>
</div>
```

**Key Elements**:

- Vertical line: `absolute left-6 w-0.5 bg-zinc-800`
- Number circle: `w-12 h-12 rounded-full bg-surface border-2 border-border`
- Title: `font-semibold text-primary`
- Code preview: `font-mono text-sm text-secondary`
- Description: `text-sm text-muted`

---

## Token & Pill Styling

### Token Pills (larger, for word tokens)

```jsx
{
  /* Neutral */
}
<span className="px-2.5 py-1 bg-zinc-800 rounded">token</span>;

{
  /* Active/Highlighted */
}
<span className="px-2.5 py-1 bg-emerald-500/20 rounded text-emerald-400">
  active
</span>;

{
  /* Muted */
}
<span className="px-2.5 py-1 bg-surface rounded text-muted">muted</span>;
```

### Byte Pills (smaller, for hex values)

```jsx
<span className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs font-mono">FF</span>
```

### Probability Pills

```jsx
{
  /* High probability (selected) */
}
<span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400">
  word (18%)
</span>;

{
  /* Low probability */
}
<span className="px-2.5 py-1 bg-surface rounded text-muted">word (3%)</span>;
```

---

## Tables

### Standard Table (in MDX)

Tables automatically styled by prose. Just write markdown:

```mdx
| Character | Code Point | Bytes |
| --------- | ---------- | ----- |
| A         | U+0041     | 65    |
```

### Labeled Table

```mdx
<div className="my-6">
  <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
    Examples of Unicode Mappings
  </div>

| Character | Code Point |
| --------- | ---------- |
| A         | U+0041     |

</div>
```

### Attached Table (follows intro text)

```mdx
<Description>Let's see how "Hello" is stored in UTF-32:</Description>

<div className="mt-2">

| Character | Hex Value   |
| --------- | ----------- |
| H         | 00 00 00 48 |

</div>
```

---

## List Patterns

### Pattern 1: Lightweight Data List (Borderless)

For simple lists showing title + metadata (like challenge lists, file lists). Minimal visual weight. **No outer border** - let the void be the container.

```jsx
<div>
  {items.map((item, idx) => (
    <button
      key={item.id}
      className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-surface rounded-lg transition-colors group"
    >
      <div className="flex items-center gap-3">
        <span className="text-muted text-sm font-mono w-6">
          {String(idx + 1).padStart(2, "0")}
        </span>
        <span className="text-secondary group-hover:text-primary transition-colors">
          {item.title}
        </span>
      </div>
      <span className="text-xs font-medium text-emerald-400">
        {item.status}
      </span>
    </button>
  ))}
</div>
```

**When to use:**

- Challenge/problem lists
- Navigation menus
- Any list where items are clickable and lead somewhere
- Lists inside panels/tabs (already contained)

**Key elements:**

- **No outer border** - void provides visual containment
- No dividers between items - hover state shows boundaries
- Monospace numbering for ordered lists
- Rounded hover state (`hover:bg-surface rounded-lg`)
- Text-only status colors (no background pills)

**Why borderless?**

- Follows void-based design philosophy
- Less visual noise = faster scanning
- Context (panel/tab) already provides containment
- Consistent with guide content style

---

### Pattern 2: Card List

For lists where each item needs more visual separation or contains multiple pieces of information.

```jsx
<div className="space-y-3">
  {items.map((item) => (
    <div
      key={item.id}
      className="p-4 rounded-lg bg-surface border border-border hover:border-zinc-600 transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-primary">{item.title}</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
          {item.status}
        </span>
      </div>
      <p className="text-sm text-muted">{item.description}</p>
    </div>
  ))}
</div>
```

**When to use:**

- Course cards on landing pages
- Project showcases
- Items with descriptions or previews
- Dashboard widgets

**Key elements:**

- Individual card borders
- Background on cards (`bg-surface`)
- Badge pills for status
- More padding and visual hierarchy

---

## Anti-Patterns

### DON'T: Heavy Cards for Simple Lists

```jsx
{
  /* ❌ WRONG - too heavy for just title + status */
}
<div className="p-4 mb-2 rounded-xl border border-border hover:border-zinc-600 hover:bg-surface">
  <span className="font-semibold">Item Title</span>
  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10">Easy</span>
</div>;
```

### DO: Lightweight Row for Simple Lists

```jsx
{
  /* ✅ CORRECT - minimal visual weight */
}
<button className="w-full px-4 py-3 flex items-center justify-between border-b border-border hover:bg-surface">
  <span className="text-secondary">Item Title</span>
  <span className="text-xs text-emerald-400">Easy</span>
</button>;
```

---

### DON'T: Boxed Feature Cards

```jsx
{
  /* ❌ WRONG - marketing style */
}
<div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 rounded-xl">
  <h3>Feature Title</h3>
</div>;
```

### DO: Typography on Void

```jsx
{/* ✅ CORRECT - typography driven */}
<h5 className="text-lg font-semibold text-primary mb-2">Concept Title</h5>
<p className="text-secondary">Explanation without a container box.</p>
```

---

### DON'T: Labels Inside Containers

```jsx
{
  /* ❌ WRONG */
}
<div className="p-4 bg-[#121212] rounded-lg border border-zinc-800">
  <div className="text-xs text-muted mb-2">Label</div>
  <div>Content</div>
</div>;
```

### DO: Labels Outside Containers

```jsx
{
  /* ✅ CORRECT */
}
<div className="my-6">
  <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
    Label
  </div>
  <div className="p-4 bg-[#121212] rounded-lg border border-zinc-800">
    <div>Content</div>
  </div>
</div>;
```

---

### DON'T: Random Spacing

```jsx
{/* ❌ WRONG */}
<div className="mt-7 mb-3">
<div className="mt-10">
<div className="my-5">
```

### DO: Semantic Spacing

```jsx
{/* ✅ CORRECT */}
<div className="my-6">                    {/* Flow gap */}
<div className="mt-4">                    {/* Connected gap */}
<div className="mb-2">                    {/* Atomic gap */}
<div style={{ marginTop: "var(--space-section)" }}>  {/* Section gap */}
```

---

## ✅ Quick Reference

```
CONTAINER PATTERNS
  Terminal box:     p-4 bg-[#121212] rounded-lg border border-zinc-800
  Labeled wrapper:  my-6 > label(mb-2) + container
  Left border:      pl-6 border-l-2 border-zinc-600

LABEL STYLING
  Standard:         text-xs font-medium text-muted uppercase tracking-wider mb-2

SPACING RULES
  Label → Container:    mb-2  (atomic)
  Intro → Example:      mt-4  (connected)
  Paragraph → Paragraph: my-6  (flow)
  Section → Section:    my-12 (section)

TIMELINE STRUCTURE
  Vertical line:    absolute left-6 w-0.5 bg-zinc-800
  Number circle:    w-12 h-12 rounded-full bg-surface border-2 border-border

TEXT HIERARCHY IN CONTAINERS
  Title:           font-semibold text-primary
  Code preview:    font-mono text-sm text-secondary
  Description:     text-sm text-muted
```
