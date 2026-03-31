# Pretext API Reference (v0.0.3)

## prepare() — One-Time Text Preparation

```typescript
function prepare(text: string, font: string, options?: PrepareOptions): PreparedText
```

Segments text via `Intl.Segmenter`, measures via canvas `measureText`, caches widths. Call once when text first appears. Returns an opaque handle — do not inspect internals.

**Parameters:**
- `text` — Input string. Whitespace normalized per `whiteSpace` mode.
- `font` — CSS font string (e.g. `'16px Inter'`). **Avoid `system-ui`** — canvas resolves differently from DOM on macOS.
- `options.whiteSpace` — `'normal'` (default): collapse runs of whitespace. `'pre-wrap'`: preserve spaces, tabs (`tab-size: 8`), and newlines.

**Cost:** ~0.038ms per text (Chrome). Safari higher for complex scripts: Arabic 3.4x, Hindi 3.6x, Urdu 8.4x.

## prepareWithSegments() — Rich Preparation

```typescript
function prepareWithSegments(text: string, font: string, options?: PrepareOptions): PreparedTextWithSegments
```

Like `prepare()` but exposes `segments: string[]` and bidi levels (`Int8Array | null`). Required for `layoutWithLines()`, `walkLineRanges()`, `layoutNextLine()`.

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

## Types

```typescript
type PrepareOptions = { whiteSpace?: 'normal' | 'pre-wrap' }

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

type LayoutCursor = {
  segmentIndex: number  // Index into segments array
  graphemeIndex: number // Grapheme offset within segment (0 at segment boundaries)
}
```

`PreparedText` and `PreparedTextWithSegments` are opaque handles. Do not inspect internals.

## API Decision Tree

- **Height/line count only** → `prepare()` + `layout()`
- **Line text and widths for rendering** → `prepareWithSegments()` + `layoutWithLines()`
- **Geometry without string materialization** → `prepareWithSegments()` + `walkLineRanges()`
- **Variable width per line (non-rectangular)** → `prepareWithSegments()` + `layoutNextLine()`

## Prepare-to-Layout Cost Ratio

`prepare()` is ~203x more expensive than `layout()`. Cache `PreparedText` and re-run only `layout()` on resize. Never call `prepare()` in a resize handler.
