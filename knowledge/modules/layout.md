# Layout Module (layout.ts)

Public API surface and orchestration layer. Coordinates analysis, measurement, and line-breaking.

## Orchestration Flow

### prepare(text, font, options?)

1. `analyzeText(text, profile, whiteSpace?)` → `TextAnalysis` with normalized text, segments, break kinds
2. `measureAnalysis(analysis, font, includeSegments)`:
   a. `getEngineProfile()` — browser classification (cached)
   b. `getFontMeasurementState(font, mayHaveEmoji)` — font cache + emoji correction
   c. For each analysis segment:
      - Soft hyphen: width=0, fit/paint=hyphenWidth
      - Hard break/tab: width=0, all advances=0
      - CJK text: iterate graphemes, emit per-grapheme segments with kinsoku-aware merging
      - All other: measure via canvas, apply emoji correction, compute advances
   d. Compile PreparedCore (parallel arrays)
3. For `prepareWithSegments()`: additionally compute bidi levels via `computeSegmentLevels()`

### layout(prepared, maxWidth, lineHeight)

1. Cast to InternalPreparedText
2. `countPreparedLines(prepared, maxWidth)` — simple or full path
3. Return `{ lineCount, height: lineCount * lineHeight }`

### layoutWithLines(prepared, maxWidth, lineHeight)

1. `walkPreparedLines(prepared, maxWidth, onLine)` — full path
2. Materialize each `InternalLayoutLine` into `LayoutLine` with text, width, cursors
3. Return `{ lineCount, height, lines }`

## CJK Grapheme Splitting During Measurement

CJK segments are split into per-grapheme units during the measurement phase (not analysis):
1. `Intl.Segmenter` with `granularity: 'grapheme'` iterates the segment
2. Adjacent graphemes merged when kinsoku rules apply:
   - Current unit ends with `kinsokuEnd` character
   - Next grapheme is in `kinsokuStart` set
   - Next grapheme is `leftStickyPunctuation`
   - Chromium: CJK follows closing quote (engine profile flag)
3. Each resulting unit becomes its own segment in the prepared arrays

This enables CJK per-character line breaking while respecting punctuation attachment rules.

## Line Text Materialization

`buildLineTextFromRange()` reconstructs line text from segment data:
- Joins segments from `start.segmentIndex` to `end.segmentIndex`
- Handles partial segments via grapheme slicing
- Trailing soft-hyphen break adds `-` to line text
- Trailing space included in `line.text` but excluded from `line.width`
- Results cached per-line in a `WeakMap` to avoid recomputation

## API Invariants

- `layout()` and `layoutWithLines()` produce identical line breaks for the same input
- `walkLineRanges()` produces identical geometry to `layoutWithLines()` without string materialization
- `layoutNextLine()` produces identical lines when called sequentially with `line.end` as next `start`
- Soft hyphen in line text: visible `-` only appears when the soft hyphen is the chosen break point
