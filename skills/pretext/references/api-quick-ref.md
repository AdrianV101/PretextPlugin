# Pretext API Quick Reference

## Core Functions (v0.0.3+, stable)

| Function | Input | Output | Cost |
|---|---|---|---|
| `prepare(text, font, opts?)` | string, CSS font | opaque `PreparedText` | ~0.038ms |
| `prepareWithSegments(text, font, opts?)` | string, CSS font | `PreparedTextWithSegments` | slightly more |
| `layout(prepared, maxWidth, lineHeight)` | handle, px, px | `{ lineCount, height }` | ~0.0002ms |
| `layoutWithLines(prepared, maxWidth, lineHeight)` | rich handle, px, px | `{ lineCount, height, lines }` | costlier |
| `walkLineRanges(prepared, maxWidth, onLine)` | rich handle, px, callback | line count | no string work |
| `layoutNextLine(prepared, start, maxWidth)` | rich handle, cursor, px | `LayoutLine \| null` | per-line |
| `clearCache()` | — | void | resets all caches |
| `setLocale(locale?)` | locale string | void | clears + resets |

## Geometry Helpers (v0.0.5+)

| Function | Input | Output | Notes |
|---|---|---|---|
| `layoutNextLineRange(prepared, start, maxWidth)` | rich handle, cursor, px | `LayoutLineRange \| null` | iterator twin of `layoutNextLine`, no `text` |
| `materializeLineRange(prepared, range)` | rich handle, range | `LayoutLine` | hydrate text on demand |
| `measureLineStats(prepared, maxWidth)` | rich handle, px | `{ lineCount, maxLineWidth }` | single-pass aggregate |
| `measureNaturalWidth(prepared)` | rich handle | `number` | widest forced-line width (intrinsic) |

## Rich-Inline Sub-Module (v0.0.5+)

`import { ... } from '@chenglou/pretext/rich-inline'` — separate from the main module.

| Function | Input | Output |
|---|---|---|
| `prepareRichInline(items)` | `RichInlineItem[]` | `PreparedRichInline` |
| `layoutNextRichInlineLineRange(prepared, maxWidth, start?)` | handle, px, cursor | `RichInlineLineRange \| null` |
| `materializeRichInlineLineRange(prepared, range)` | handle, range | `RichInlineLine` |
| `walkRichInlineLineRanges(prepared, maxWidth, onLine)` | handle, px, callback | line count |
| `measureRichInlineStats(prepared, maxWidth)` | handle, px | `{ lineCount, maxLineWidth }` |

## Options

```typescript
{
  whiteSpace?: 'normal' | 'pre-wrap'   // default: 'normal'
  wordBreak?: 'normal' | 'keep-all'    // v0.0.5+, only affects CJK/Hangul
  letterSpacing?: number               // v0.0.6+, CSS pixels (not em)
}
```

## Types

```typescript
LayoutLine        = { text: string, width: number, start: LayoutCursor, end: LayoutCursor }
LayoutLineRange   = { width: number, start: LayoutCursor, end: LayoutCursor }
LayoutCursor      = { segmentIndex: number, graphemeIndex: number }
LayoutResult      = { lineCount: number, height: number }
LayoutLinesResult = LayoutResult & { lines: LayoutLine[] }
LineStats         = { lineCount: number, maxLineWidth: number }   // v0.0.5+

// Rich-inline (v0.0.5+)
RichInlineItem      = { text, font, letterSpacing?, break?: 'normal' | 'never', extraWidth? }
RichInlineCursor    = { itemIndex, segmentIndex, graphemeIndex }
RichInlineLineRange = { fragments: RichInlineFragmentRange[], width, end }
RichInlineLine      = { fragments: RichInlineFragment[], width, end }
RichInlineStats     = { lineCount, maxLineWidth }
```

## Rules of Thumb

- `prepare()` is 203x more expensive than `layout()` — cache the handle
- `line.text` includes trailing space; `line.width` excludes it
- `line.end` is exclusive — pass directly as next `layoutNextLine()` start
- Avoid `system-ui` font on macOS
- Pre-wrap `"text\n"` → 1 line, not 2
- `wordBreak: 'keep-all'` only affects CJK/Hangul; no-op on Latin (v0.0.5+)
- `letterSpacing` is CSS pixels, not em (v0.0.6+)
- For chips/mentions/atoms, use `prepareRichInline`, not `prepareWithSegments`
