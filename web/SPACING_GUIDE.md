# Spacing System Guide

This guide documents the 4-tier spacing system used throughout the course content. Following these patterns ensures visual consistency and proper content hierarchy.

---

## The 4-Tier Spacing System

| Tier                | CSS Variable          | Value         | Use Case                                |
| ------------------- | --------------------- | ------------- | --------------------------------------- |
| **Atomic**    | `--space-atomic`    | 8px (0.5rem)  | Label → data, tightly coupled elements |
| **Connected** | `--space-connected` | 16px (1rem)   | Intro text → component, related blocks |
| **Flow**      | `--space-flow`      | 24px (1.5rem) | Between paragraphs, reading rhythm      |
| **Section**   | `--space-section`   | 48px (3rem)   | Topic changes, major breaks             |

### Tailwind Equivalents

- `my-2` / `mt-2` / `mb-2` = Atomic (8px)
- `my-4` / `mt-4` / `mb-4` = Connected (16px)
- `my-6` / `mt-6` / `mb-6` = Flow (24px)
- `my-12` / `mt-12` / `mb-12` = Section (48px)

---

## Component Spacing Patterns

### 1. Description (Reading Paragraphs)

**Default behavior**: Adds `--space-flow` (24px) bottom margin for reading rhythm.

```mdx
<Description>This paragraph has standard flow spacing below it.</Description>
```

**With `noMargin`**: Use when parent handles spacing (e.g., flex container with gap).

```mdx
<div className="flex flex-col" style={{ gap: "var(--space-flow)" }}>
  <Description noMargin>
    First paragraph - parent's gap handles spacing.
  </Description>
  <Description noMargin>
    Second paragraph - consistent spacing via gap.
  </Description>
</div>
```

**With `attached`**: Use when the paragraph introduces content that follows (ends with `:`).

```mdx
<Description attached>Here's how UTF-8 divides the Unicode space:</Description>

<div className="content-attached">
  {/* Table or visualization that illustrates the paragraph above */}
</div>
```

---

### 2. Attached Content Pattern 

**When to use**: When a paragraph ending with `:` introduces a table, code block, or visualization. The content is semantically part of that paragraph.

**Two parts required**:

1. `<Description attached>` - removes bottom margin from the paragraph
2. `className="content-attached"` - adds only 8px top margin to the content

```mdx
<Description attached>Let's consider storing "Hello" using UTF-32:</Description>

<div className="content-attached">
  | Character | Code Point | Stored in UTF-32 | | :--- | :--- | :--- | | H |
  U+0048 | 00 00 00 48 |
</div>
```

**Result**: Only 8px between paragraph and table (tight coupling).

**Without attached pattern** (wrong):

```
Paragraph text ending with colon:
                                    ← 24px from Description
                                    ← 16px from prose table
[Table]                             = 40px total gap (looks disconnected)
```

**With attached pattern** (correct):

```
Paragraph text ending with colon:
                                    ← 8px only
[Table]                             = Content feels connected
```

---

### 3. Step Component

Steps are major structural containers with `--space-section` (48px) padding top and bottom.

```mdx
<Step title="1. Topic Name">
  <Description>Content goes here...</Description>
</Step>
```

---

### 4. Callout Component

Callouts use asymmetric "sandwich" spacing:

- **Top**: `--space-connected` (16px) - magnetizes to preceding content
- **Bottom**: `--space-section` (48px) - creates a "hard stop" before next content

```mdx
<Description>Some explanation here.</Description>

<Callout type="note" title="Important">
  This callout appears connected to the text above but creates breathing room
  before whatever comes next.
</Callout>
```

**Callout types**: `note`, `tip`, `warning`, `success` (or `summary`)

---

### 5. Subheadings (h4) Within Steps

Use this pattern for subsections within a Step:

```mdx
<h4
  className="text-lg font-semibold text-primary"
  style={{
    marginTop: "var(--space-section)",
    marginBottom: "var(--space-connected)",
  }}
>
  3.1 Subsection Title
</h4>
```

- **Top**: Section-level break (48px) to separate from previous content
- **Bottom**: Connected (16px) to magnetize to the content it introduces

---

### 6. ThinkingProcess Component

**Default behavior**: When inside a `Step`, respects parent's gap spacing (no extra margins).

```mdx
<!-- Inside Step (default - uses parent gap) -->
<ThinkingProcess title="Why does this matter?">
  {/* Expandable content */}
</ThinkingProcess>
```

**With `className="content-attached"`**: Use when the component directly follows an intro question to create tight coupling:

```mdx
<Description attached>Could we train on raw bytes? Let's think:</Description>

<ThinkingProcess className="content-attached" title="Consider the Trade-offs">
  {/* Expandable content */}
</ThinkingProcess>
```

**With `withSectionBreak`**: Use when the component is standalone (outside of Step) and needs section-level breaks:

```mdx
<!-- Standalone with section breaks (48px top/bottom) -->
<ThinkingProcess title="Why does this matter?" withSectionBreak>
  {/* Expandable content */}
</ThinkingProcess>
```

---

### 7. Standalone Visual Blocks

For visualizations NOT introduced by a colon, use standard flow spacing:

```mdx
<Description>Regular paragraph that doesn't end with a colon.</Description>

<div className="my-6">{/* Standalone visualization */}</div>
```

---

## Quick Reference: When to Use What

| Scenario                                          | Pattern                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Multiple paragraphs in chapter intro              | Wrap in flex container with `gap: var(--space-flow)`, use `<Description noMargin>` |
| Paragraph introduces table/code (ends with `:`) | `<Description attached>` + `className="content-attached"`                          |
| Standalone table/visualization                    | `className="my-6"` (flow spacing)                                                    |
| New subsection within a Step                      | `<h4>` with section top margin, connected bottom margin                              |
| Important callout after explanation               | `<Callout>` (auto-spaced)                                                            |
| Major topic change                                | New `<Step>` component                                                               |

---

## CSS Classes Reference

### In `globals.css`

```css
/* Attached content - tight coupling to intro paragraph */
.content-attached {
  margin-top: var(--space-atomic) !important; /* 8px */
  margin-bottom: var(--space-flow); /* 24px */
}

.content-attached table {
  margin-top: 0 !important; /* Remove prose table's default margin */
}

/* Standard content block */
.content-block {
  margin-top: var(--space-connected); /* 16px */
  margin-bottom: var(--space-flow); /* 24px */
}

/* Section-level break */
.section-block {
  margin-top: var(--space-section); /* 48px */
  margin-bottom: var(--space-section); /* 48px */
}
```

---

## Design Principles

### 1. Component Sandwich (Asymmetric Spacing)

Most components have **tight top** (connects to intro) and **loose bottom** (breathing room).

### 2. Gestalt Proximity

Related elements should be closer together than unrelated elements. A paragraph that introduces a table should be visually closer to that table than to the next paragraph.

### 3. Reading Rail

Maintain consistent left alignment. Avoid indentation that breaks the vertical reading line.

### 4. Colon = Attachment Signal

When a paragraph ends with `:`, the next element is semantically part of that paragraph. Use the attached pattern.

---

## Examples from Existing Content

### Chapter 1: UTF-32 Table

```mdx
<Description attached>
  However, UTF-32 is space-inefficient for most text... Let's consider storing
  **"Hello"** using UTF-32:
</Description>

<div className="content-attached">
  | Character | Code Point | Stored in UTF-32 (Hex) | | :--- | :--- | :--- | |
  **H** | `U+0048` | `00 00 00 48` | ...
</div>
```

### Chapter 2: BPE Training String

```mdx
<Description attached>
  Imagine we are training a tokenizer on this string:
</Description>

<div className="content-attached flex flex-wrap justify-center gap-2">
  {['a', 'a', 'a', 'b', 'd', ...].map((char, i) => (
    <span key={i} className="...">{char}</span>
  ))}
</div>
```

### Chapter 3: Token ID Examples

```mdx
<Description attached>
  Suppose we fed raw Token IDs directly into the model. Imagine the tokenizer
  assigned IDs like this:
</Description>

<div className="content-attached p-4 bg-surface rounded-lg border border-border">
  <div className="space-y-2 font-mono text-sm">
    <div>ID 100: "Apple"</div>
    <div>ID 500: "Banana"</div>
  </div>
</div>
```

---

## Checklist for New Content

- [ ] Does any paragraph end with `:`? → Use `<Description attached>` + `content-attached`
- [ ] Multiple intro paragraphs? → Wrap in flex container with gap, use `noMargin`
- [ ] New subsection? → Use h4 with proper margin styles
- [ ] Important note? → Use `<Callout>`
- [ ] Standalone visualization? → Use `my-6` for flow spacing
- [ ] Major topic? → Use new `<Step>` component
