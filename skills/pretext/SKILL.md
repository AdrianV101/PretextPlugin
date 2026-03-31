---
name: pretext
description: >-
  Use when the user asks about pretext, @chenglou/pretext, DOM-free text measurement,
  canvas text layout, multiline text wrapping, or needs to write code using the pretext
  library. Provides the mental model, API guidance, common patterns, and critical pitfalls
  for pretext v0.0.3.
---

# Pretext — DOM-Free Text Measurement & Layout

Pretext (`@chenglou/pretext`) is a pure TypeScript library for multiline text measurement
and layout without DOM reflow. It uses canvas `measureText` for shaping and `Intl.Segmenter`
for word/grapheme boundaries, then does pure arithmetic line breaking.

**Environment:** Browser-only. No SSR support.
**Version:** v0.0.3 (March 2026).

## Mental Model: Two Phases

1. **`prepare(text, font)`** — One-time expensive operation. Segments text, measures via
   canvas, caches widths. Returns an opaque handle. Call when text first appears or changes.
   Cost: ~0.038ms per text (Chrome).

2. **`layout(prepared, maxWidth, lineHeight)`** — Hot-path arithmetic. Walks cached widths
   to count lines and compute height. Call on every resize. Cost: ~0.0002ms per text.
   No DOM, no canvas, no strings, no allocations.

The 203:1 cost ratio is the key insight: **cache the prepared handle, only re-layout on resize.**

## API Decision Tree

Choose the right API pair:

| Need | Prepare | Layout |
|---|---|---|
| Height/line count only | `prepare()` | `layout()` |
| Line text and widths | `prepareWithSegments()` | `layoutWithLines()` |
| Geometry without text | `prepareWithSegments()` | `walkLineRanges()` |
| Variable width per line | `prepareWithSegments()` | `layoutNextLine()` |

`prepare()` returns opaque `PreparedText` — use with `layout()` only.
`prepareWithSegments()` returns `PreparedTextWithSegments` — use with any rich API.

## Core API Signatures

```typescript
// One-time preparation
prepare(text: string, font: string, options?: { whiteSpace?: 'normal' | 'pre-wrap' }): PreparedText
prepareWithSegments(text: string, font: string, options?: { whiteSpace?: 'normal' | 'pre-wrap' }): PreparedTextWithSegments

// Layout (hot path)
layout(prepared: PreparedText, maxWidth: number, lineHeight: number): { lineCount: number, height: number }

// Rich layout
layoutWithLines(prepared: PreparedTextWithSegments, maxWidth: number, lineHeight: number): { lineCount: number, height: number, lines: LayoutLine[] }
walkLineRanges(prepared: PreparedTextWithSegments, maxWidth: number, onLine: (line: LayoutLineRange) => void): number
layoutNextLine(prepared: PreparedTextWithSegments, start: LayoutCursor, maxWidth: number): LayoutLine | null

// Cache management
clearCache(): void
setLocale(locale?: string): void
```

Where:
```typescript
type LayoutLine = { text: string, width: number, start: LayoutCursor, end: LayoutCursor }
type LayoutLineRange = { width: number, start: LayoutCursor, end: LayoutCursor }
type LayoutCursor = { segmentIndex: number, graphemeIndex: number }
```

- `LayoutLine.text`: includes trailing space. `LayoutLine.width`: excludes trailing space.
- `LayoutCursor.end` is exclusive — pass directly as next `start` for `layoutNextLine()`.

## Common Patterns

### Resize Handler (height-only)
```typescript
const prepared = prepare(text, '16px Inter')
// On resize:
const { height } = layout(prepared, containerWidth, 24)
element.style.height = `${height}px`
```

### Virtualized List
```typescript
const prepared = prepareWithSegments(text, font)
const { lines } = layoutWithLines(prepared, width, lineHeight)
// Render only visible lines
for (const line of lines.slice(startIdx, endIdx)) {
  renderLine(line.text, line.width)
}
```

### Canvas Rendering
```typescript
const prepared = prepareWithSegments(text, font)
const { lines } = layoutWithLines(prepared, canvasWidth, lineHeight)
lines.forEach((line, i) => {
  ctx.fillText(line.text, 0, (i + 1) * lineHeight)
})
```

### Non-Rectangular Layout (text around image)
```typescript
const prepared = prepareWithSegments(text, font)
let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
let y = 0
let line: LayoutLine | null
while ((line = layoutNextLine(prepared, cursor, getWidthAtY(y))) !== null) {
  renderLine(line, y)
  cursor = line.end
  y += lineHeight
}
```

### Pre-Wrap (code blocks, logs)
```typescript
const prepared = prepare(code, '14px monospace', { whiteSpace: 'pre-wrap' })
const { height } = layout(prepared, editorWidth, 20)
```

## Critical Pitfalls

1. **Never use `system-ui` font** — canvas resolves differently from DOM on macOS. Use named fonts: `'16px Inter'`, `'16px Helvetica'`, `'16px -apple-system, Helvetica'`.

2. **Never call `prepare()` on resize** — it's 203x more expensive than `layout()`. Cache the PreparedText handle and only call `layout()` when width changes.

3. **Don't inline `prepare()` in `layout()`** — `layout(prepare(text, font), width, lh)` pays full prepare cost every time. Always store the handle.

4. **Don't access PreparedText internals** — the handle is intentionally opaque. Internal representation may change. Use `prepareWithSegments()` for segment access.

5. **`LayoutLine.text` includes trailing space, `.width` excludes it** — this matches CSS behavior where trailing whitespace hangs past the line edge.

6. **Pre-wrap trailing newline** — `"text\n"` produces 1 line, not 2. A trailing newline does not create an additional empty line.

7. **`clearCache()` is expensive** — only call when fonts change dramatically or to free memory. Never call in render loops.

## Known Limitations

- **Browser-only** — requires `OffscreenCanvas` and `Intl.Segmenter`. No SSR/Node.js support.
- **Whitespace modes** — only `'normal'` and `'pre-wrap'`. No `pre`, `nowrap`, `pre-line`, `break-spaces`.
- **Bidi metadata only** — `segLevels` computed on rich path but not consumed by layout APIs. Visual reordering is caller's responsibility.
- **v0.0.3 maturity** — library released March 2026. API may evolve.
- **system-ui unsafe** — documented above. No fix planned.
