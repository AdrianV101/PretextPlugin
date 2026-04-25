# Pretext API Reference (v0.0.6)

The plugin bundles `@chenglou/pretext@0.0.6` and prefers any user-installed version. The core surface (`prepare`, `layout`, `prepareWithSegments`, `layoutWithLines`, `walkLineRanges`, `layoutNextLine`, `clearCache`, `setLocale`) has been stable since v0.0.3. Items below tagged `(v0.0.5+)` or `(v0.0.6+)` require the user's installed version to be at least that release.

## prepare() — One-Time Text Preparation

```typescript
function prepare(text: string, font: string, options?: PrepareOptions): PreparedText
```

Segments text via `Intl.Segmenter`, measures via canvas `measureText`, caches widths. Call once when text first appears. Returns an opaque handle — do not inspect internals.

**Parameters:**
- `text` — Input string. Whitespace normalized per `whiteSpace` mode.
- `font` — CSS font string (e.g. `'16px Inter'`). **Avoid `system-ui`** — canvas resolves differently from DOM on macOS.
- `options.whiteSpace` — `'normal'` (default): collapse runs of whitespace. `'pre-wrap'`: preserve spaces, tabs (`tab-size: 8`), and newlines.
- `options.wordBreak` *(v0.0.5+)* — `'normal'` (default) or `'keep-all'`. `'keep-all'` only affects CJK/Hangul: it disables breaking inside runs of CJK characters or Hangul jamo, treating them as atomic words. No-op on Latin/Cyrillic/Arabic/etc.
- `options.letterSpacing` *(v0.0.6+)* — Number in CSS pixels. Adds the given gap between every grapheme. Plain px, not em or %. Reasonable values are sub-pixel to single digits.

**Cost:** ~0.038ms per text (Chrome). Safari higher for complex scripts: Arabic 3.4x, Hindi 3.6x, Urdu 8.4x.

## prepareWithSegments() — Rich Preparation

```typescript
function prepareWithSegments(text: string, font: string, options?: PrepareOptions): PreparedTextWithSegments
```

Like `prepare()` but exposes `segments: string[]` and bidi levels (`Int8Array | null`). Required for `layoutWithLines()`, `walkLineRanges()`, `layoutNextLine()`, and the geometry helpers below.

> Terminology: this codebase calls the segmented variant the **"rich" path**. That is unrelated to the v0.0.5+ `@chenglou/pretext/rich-inline` sub-module described later in this file, which is for chip/mention/atom UIs.

## layout() — Hot-Path Line Counting

```typescript
function layout(prepared: PreparedText, maxWidth: number, lineHeight: number): LayoutResult
```

Pure arithmetic over cached widths. No DOM, no canvas, no string work, no allocations. Call on every resize.

**Returns:** `{ lineCount: number, height: number }` where `height = lineCount * lineHeight`.

**Cost:** ~0.0002ms per text. Scales with segment count, not character count.

## layoutWithLines() — Materialized Line Layout

```typescript
function layoutWithLines(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
  lineHeight: number
): LayoutLinesResult
```

Returns per-line text, width, and cursor positions. For rendering, canvas drawing, virtualized lists.

**Returns:** `{ lineCount, height, lines: LayoutLine[] }`.

## walkLineRanges() — Batch Geometry Pass

```typescript
function walkLineRanges(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
  onLine: (line: LayoutLineRange) => void
): number
```

Non-materializing geometry API — widths and cursors only, no string work. Prefer for shrinkwrap/aggregate width calculations. Returns line count.

## layoutNextLine() — Streaming Variable-Width Layout

```typescript
function layoutNextLine(
  prepared: PreparedTextWithSegments,
  start: LayoutCursor,
  maxWidth: number
): LayoutLine | null
```

One line at a time with variable `maxWidth` per line. For non-rectangular layouts (text wrapping around images, etc.). Returns `null` when exhausted.

```typescript
let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
let line: LayoutLine | null
while ((line = layoutNextLine(prepared, cursor, getWidthForLine(lineIndex))) !== null) {
  renderLine(line)
  cursor = line.end
  lineIndex++
}
```

## layoutNextLineRange() *(v0.0.5+)* — Streaming Geometry, No Materialization

```typescript
function layoutNextLineRange(
  prepared: PreparedTextWithSegments,
  start: LayoutCursor,
  maxWidth: number
): LayoutLineRange | null
```

Iterator twin of `layoutNextLine` that omits the `text` field. Use when you need per-line cursors and width but not the materialized line text — common for variable-width layout that only needs to size frames. Pair with `materializeLineRange` to recover the text on demand.

## materializeLineRange() *(v0.0.5+)*

```typescript
function materializeLineRange(prepared: PreparedTextWithSegments, line: LayoutLineRange): LayoutLine
```

Hydrates a `LayoutLineRange` (returned by `layoutNextLineRange` or `walkLineRanges`) into a `LayoutLine` with `text`. Useful for lazy line text — defer string allocation to the lines that actually get rendered.

## measureLineStats() *(v0.0.5+)*

```typescript
function measureLineStats(
  prepared: PreparedTextWithSegments,
  maxWidth: number
): { lineCount: number; maxLineWidth: number }
```

Single-pass aggregate over the geometry walker. Returns line count plus the widest line width. Cheaper than `walkLineRanges` when you only need totals.

## measureNaturalWidth() *(v0.0.5+)*

```typescript
function measureNaturalWidth(prepared: PreparedTextWithSegments): number
```

Width of the widest forced line — i.e., the layout's natural (unwrapped, intrinsic) width. Use for shrinkwrap sizing: pass this width back into `layout` to render at intrinsic size.

## clearCache() — Reset All Caches

```typescript
function clearCache(): void
```

Clears segment metrics cache, analysis caches, grapheme segmenter. Call when fonts change dramatically or to free memory.

## setLocale() — Change Segmentation Locale

```typescript
function setLocale(locale?: string): void
```

Changes `Intl.Segmenter` locale for word segmentation. Implicitly calls `clearCache()`.

## rich-inline Module *(v0.0.5+)*

A separate public sub-module at `@chenglou/pretext/rich-inline` for inline-only rich text — chats, markdown lines, mentions/chips/atoms. Crucially distinct from `prepareWithSegments` ("rich" path), which is plain text with segment exposure. Rich-inline takes structured input where each item has its own font/style.

```typescript
import {
  prepareRichInline,
  layoutNextRichInlineLineRange,
  walkRichInlineLineRanges,
  materializeRichInlineLineRange,
  measureRichInlineStats,
} from '@chenglou/pretext/rich-inline'

const items: RichInlineItem[] = [
  { text: 'Hi ', font: '16px Inter' },
  { text: '@alice', font: '16px Inter', break: 'never' },     // atomic chip
  { text: ', see ', font: '16px Inter' },
  { text: '#design', font: '16px Inter', break: 'never' },    // atomic tag
]
const prepared = prepareRichInline(items)
const stats = measureRichInlineStats(prepared, 320) // { lineCount, maxLineWidth }
```

Per-item options:
- `text` — Item content. Boundary spaces collapse across items, browser-style.
- `font` — CSS font shorthand for this item only.
- `letterSpacing?` *(v0.0.6+)* — Per-item CSS px gap between graphemes.
- `break?` — `'normal'` (default) or `'never'`. `'never'` makes the item atomic — chips/mentions never split mid-word.
- `extraWidth?` — Extra px to reserve for chrome (border, padding) when computing fit.

The line walkers return `RichInlineLineRange` objects with `fragments[]` (per-item slices for the line), `width`, and `end` cursor. Materialize to get fragment text. See `knowledge/modules/rich-inline.md` for the model in detail.

## Types

```typescript
type PrepareOptions = {
  whiteSpace?: 'normal' | 'pre-wrap'
  wordBreak?: 'normal' | 'keep-all'   // v0.0.5+
  letterSpacing?: number              // v0.0.6+, CSS pixels
}

type LayoutResult = { lineCount: number; height: number }

type LayoutLine = {
  text: string        // Line text content (trailing space included in text)
  width: number       // Line width in pixels (trailing space excluded from width)
  start: LayoutCursor // Inclusive start cursor
  end: LayoutCursor   // Exclusive end cursor
}

type LayoutLineRange = {
  width: number       // Line width (trailing space excluded)
  start: LayoutCursor
  end: LayoutCursor
}

type LayoutLinesResult = LayoutResult & { lines: LayoutLine[] }

type LineStats = { lineCount: number; maxLineWidth: number }  // v0.0.5+

type LayoutCursor = {
  segmentIndex: number  // Index into segments array
  graphemeIndex: number // Grapheme offset within segment (0 at segment boundaries)
}

// rich-inline (v0.0.5+) — separate brand from PreparedText
type RichInlineItem = {
  text: string
  font: string
  letterSpacing?: number
  break?: 'normal' | 'never'
  extraWidth?: number
}
type RichInlineCursor = { itemIndex: number; segmentIndex: number; graphemeIndex: number }
type RichInlineLineRange = { fragments: RichInlineFragmentRange[]; width: number; end: RichInlineCursor }
type RichInlineLine = { fragments: RichInlineFragment[]; width: number; end: RichInlineCursor }
type RichInlineStats = { lineCount: number; maxLineWidth: number }
```

`PreparedText`, `PreparedTextWithSegments`, and `PreparedRichInline` are opaque handles. Do not inspect internals.

## API Decision Tree

- **Height/line count only** → `prepare()` + `layout()`
- **Line text and widths for rendering** → `prepareWithSegments()` + `layoutWithLines()`
- **Geometry without string materialization** → `prepareWithSegments()` + `walkLineRanges()` (or `measureLineStats()` for just totals)
- **Variable width per line (non-rectangular)** → `prepareWithSegments()` + `layoutNextLine()` (use `layoutNextLineRange` + `materializeLineRange` to defer string work)
- **Intrinsic/shrinkwrap width** → `prepareWithSegments()` + `measureNaturalWidth()`
- **Mentions, chips, mixed-font inline (chat, markdown line)** → `prepareRichInline()` + `walkRichInlineLineRanges()` (or `measureRichInlineStats()` for just totals)
- **CJK or Hangul where multi-character runs must stay together** → add `wordBreak: 'keep-all'` to options *(v0.0.5+)*

## Prepare-to-Layout Cost Ratio

`prepare()` is ~203x more expensive than `layout()`. Cache `PreparedText` and re-run only `layout()` on resize. Never call `prepare()` in a resize handler. The same caching model applies to `prepareRichInline()`.
