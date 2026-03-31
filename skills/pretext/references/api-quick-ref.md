# Pretext API Quick Reference

## Functions

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

## Options

```typescript
{ whiteSpace?: 'normal' | 'pre-wrap' }  // default: 'normal'
```

## Types

```typescript
LayoutLine     = { text: string, width: number, start: LayoutCursor, end: LayoutCursor }
LayoutLineRange = { width: number, start: LayoutCursor, end: LayoutCursor }
LayoutCursor   = { segmentIndex: number, graphemeIndex: number }
LayoutResult   = { lineCount: number, height: number }
LayoutLinesResult = LayoutResult & { lines: LayoutLine[] }
```

## Rules of Thumb

- `prepare()` is 203x more expensive than `layout()` — cache the handle
- `line.text` includes trailing space; `line.width` excludes it
- `line.end` is exclusive — pass directly as next `layoutNextLine()` start
- Avoid `system-ui` font on macOS
- Pre-wrap `"text\n"` → 1 line, not 2
