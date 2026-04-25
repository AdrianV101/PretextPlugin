---
name: pretext
description: >-
  Use when the user asks about pretext, @chenglou/pretext, DOM-free text measurement,
  canvas text layout, multiline text wrapping, mention/chip/atom inline UIs, or needs
  to write code using the pretext library. Provides the mental model, API guidance,
  common patterns, and critical pitfalls for pretext v0.0.6 (bundled), with notes on
  v0.0.5+ and v0.0.6+ additions for users on the latest releases.
---

# Pretext — DOM-Free Text Measurement & Layout

Pretext (`@chenglou/pretext`) is a pure TypeScript library for multiline text measurement
and layout without DOM reflow. It uses canvas `measureText` for shaping and `Intl.Segmenter`
for word/grapheme boundaries, then does pure arithmetic line breaking.

**Environment:** Browser-only. No SSR support.
**Version:** v0.0.6 bundled. Stable core API since v0.0.3 — features tagged `(v0.0.5+)` or `(v0.0.6+)` only work if the user's installed pretext is at least that version.

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
| Geometry without text | `prepareWithSegments()` | `walkLineRanges()` or `measureLineStats()` *(v0.0.5+)* |
| Variable width per line | `prepareWithSegments()` | `layoutNextLine()` (or `layoutNextLineRange` + `materializeLineRange` *(v0.0.5+)*) |
| Intrinsic/shrinkwrap width | `prepareWithSegments()` | `measureNaturalWidth()` *(v0.0.5+)* |
| Mentions, chips, mixed-font inline | `prepareRichInline()` *(v0.0.5+)* | `walkRichInlineLineRanges` / `measureRichInlineStats` |

`prepare()` returns opaque `PreparedText` — use with `layout()` only.
`prepareWithSegments()` returns `PreparedTextWithSegments` — use with any rich API.
`prepareRichInline()` is from a separate sub-module: `import { prepareRichInline } from '@chenglou/pretext/rich-inline'`.

> Terminology note: the segmented variant (`prepareWithSegments`) is the **"rich" path** in this codebase — that's about exposing segment data, *not* about chips/mentions. The v0.0.5+ `rich-inline` sub-module is a different API for chip/mention/atom UIs. When in doubt: one font and flat string → `prepare`/`prepareWithSegments`; per-item fonts or atomic chips → `prepareRichInline`.

## Core API Signatures

```typescript
type PrepareOptions = {
  whiteSpace?: 'normal' | 'pre-wrap'
  wordBreak?: 'normal' | 'keep-all'   // v0.0.5+ (CJK/Hangul only)
  letterSpacing?: number              // v0.0.6+ (CSS pixels)
}

// One-time preparation
prepare(text: string, font: string, options?: PrepareOptions): PreparedText
prepareWithSegments(text: string, font: string, options?: PrepareOptions): PreparedTextWithSegments

// Layout (hot path)
layout(prepared: PreparedText, maxWidth: number, lineHeight: number): { lineCount: number, height: number }

// Rich layout
layoutWithLines(prepared: PreparedTextWithSegments, maxWidth: number, lineHeight: number): { lineCount: number, height: number, lines: LayoutLine[] }
walkLineRanges(prepared: PreparedTextWithSegments, maxWidth: number, onLine: (line: LayoutLineRange) => void): number
layoutNextLine(prepared: PreparedTextWithSegments, start: LayoutCursor, maxWidth: number): LayoutLine | null

// Geometry helpers — v0.0.5+
layoutNextLineRange(prepared: PreparedTextWithSegments, start: LayoutCursor, maxWidth: number): LayoutLineRange | null
materializeLineRange(prepared: PreparedTextWithSegments, range: LayoutLineRange): LayoutLine
measureLineStats(prepared: PreparedTextWithSegments, maxWidth: number): { lineCount: number, maxLineWidth: number }
measureNaturalWidth(prepared: PreparedTextWithSegments): number

// Cache management
clearCache(): void
setLocale(locale?: string): void
```

The rich-inline sub-module exports `prepareRichInline`, `layoutNextRichInlineLineRange`, `walkRichInlineLineRanges`, `materializeRichInlineLineRange`, `measureRichInlineStats`. See `knowledge/modules/rich-inline.md` for the model.

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

### Mentions and Chips (v0.0.5+)
```typescript
import { prepareRichInline, measureRichInlineStats } from '@chenglou/pretext/rich-inline'

const items = [
  { text: 'Hi ', font: '16px Inter' },
  { text: '@alice', font: '16px Inter', break: 'never' },
  { text: ', see ', font: '16px Inter' },
  { text: '#design', font: '16px Inter', break: 'never' },
]
const prepared = prepareRichInline(items)
const { lineCount, maxLineWidth } = measureRichInlineStats(prepared, containerWidth)
```

### Korean / Japanese / Chinese with Atomic Words (v0.0.5+)
```typescript
const prepared = prepare(koreanText, '16px Inter', { wordBreak: 'keep-all' })
// keep-all is a no-op on Latin/Cyrillic/Arabic — only affects CJK and Hangul.
```

### Tracked Letterspacing (v0.0.6+)
```typescript
const prepared = prepare(label, '14px Inter', { letterSpacing: 0.5 }) // CSS px, not em
```

## Critical Pitfalls

1. **Never use `system-ui` font** — canvas resolves differently from DOM on macOS. Use named fonts: `'16px Inter'`, `'16px Helvetica'`, `'16px -apple-system, Helvetica'`.

2. **Never call `prepare()` on resize** — it's 203x more expensive than `layout()`. Cache the PreparedText handle and only call `layout()` when width changes.

3. **Don't inline `prepare()` in `layout()`** — `layout(prepare(text, font), width, lh)` pays full prepare cost every time. Always store the handle.

4. **Don't access PreparedText internals** — the handle is intentionally opaque. Internal representation may change. Use `prepareWithSegments()` for segment access.

5. **`LayoutLine.text` includes trailing space, `.width` excludes it** — this matches CSS behavior where trailing whitespace hangs past the line edge.

6. **Pre-wrap trailing newline** — `"text\n"` produces 1 line, not 2. A trailing newline does not create an additional empty line.

7. **`clearCache()` is expensive** — only call when fonts change dramatically or to free memory. Never call in render loops.

8. **`wordBreak: 'keep-all'` only affects CJK/Hangul** — *(v0.0.5+)* using it on Latin-only text is a no-op that misleads readers. Default to `'normal'` and switch only for Korean/Japanese/Chinese where atomic word grouping matters.

9. **`letterSpacing` is CSS pixels** — *(v0.0.6+)* not em, not %. Sub-pixel through low-single-digit values are the realistic range. Two-digit values almost always indicate unit confusion.

10. **Don't conflate `prepareWithSegments` with `prepareRichInline`** — *(v0.0.5+)* the former is "rich" only in the sense of exposing segment data on a single-font string. For chip/mention/atom UIs (per-item fonts, atomic items via `break: 'never'`) reach for `prepareRichInline` from `@chenglou/pretext/rich-inline`. They are different APIs with different caching boundaries.

## Known Limitations

- **Browser-only** — requires `OffscreenCanvas` and `Intl.Segmenter`. No SSR/Node.js support yet (upstream notes "Soon, server-side").
- **Whitespace modes** — only `'normal'` and `'pre-wrap'`. No `pre`, `nowrap`, `pre-line`, `break-spaces`.
- **Bidi metadata only** — `segLevels` computed on rich path but not consumed by layout APIs. Visual reordering is caller's responsibility.
- **v0.0.6 maturity** — library released March 2026, latest April 2026. Core API is stable since v0.0.3; `rich-inline`, `wordBreak`, geometry helpers, and `letterSpacing` are newer.
- **system-ui unsafe** — documented above. No fix planned.
