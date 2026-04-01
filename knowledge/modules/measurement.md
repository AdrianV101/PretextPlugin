# Measurement Module (measurement.ts)

Canvas-based text measurement with two-level caching, emoji width correction, and browser engine profiling.

## Segment Metrics Cache

Two-level `Map<font, Map<segText, SegmentMetrics>>`:
- Outer key: CSS font string (e.g. `'16px Inter'`)
- Inner key: segment text string
- Value: `SegmentMetrics` containing width, containsCJK flag, and lazy grapheme widths

Shared across all texts. Cleared by `clearCache()`. Width stored is raw canvas measurement — emoji correction applied at read time via `getCorrectedSegmentWidth()`.

## Emoji Width Correction Algorithm

Chrome/Firefox on macOS measure emoji wider in canvas than DOM at small font sizes. The correction is:
1. One-time per font: measure a reference emoji in canvas and DOM
2. Compute `correction = domWidth - canvasWidth` (negative = canvas inflated)
3. Correction is constant per emoji grapheme at a given font — font-independent
4. Applied at read time: `getCorrectedSegmentWidth(text, metrics, correction)`
5. Safari: canvas and DOM agree, so correction = 0

Detection: `textMayContainEmoji()` scans for emoji-range codepoints to skip DOM calibration when no emoji present.

## Engine Profile Detection

`getEngineProfile()` classifies the browser and returns 4 tuning parameters:

| Parameter | Safari/WebKit | Chromium | Other |
|---|---|---|---|
| `lineFitEpsilon` | 1/64 (0.015625) | 0.005 | 0.005 |
| `carryCJKAfterClosingQuote` | false | true | false |
| `preferEarlySoftHyphenBreak` | true | false | false |
| `preferPrefixWidthsForBreakableRuns` | true | false | false |

Computed once from `navigator.userAgent`, never invalidated. `lineFitEpsilon` is the tolerance for deciding whether a segment fits on the current line.

## Grapheme Width Strategies

Two strategies for computing per-grapheme widths (used in overflow-wrap):

1. **Sum of parts** (Chromium/Other): Measure each grapheme individually, sum widths. Faster but misses inter-grapheme kerning.

2. **Prefix widths** (Safari): Measure "a", "ab", "abc"... and difference adjacent values. Captures kerning effects. More expensive but more accurate.

Selected by `preferPrefixWidthsForBreakableRuns` in engine profile.

## Canvas Context Management

- Single `OffscreenCanvas` instance created on first use
- `getContext('2d')` returns a persistent context
- Font set via `ctx.font = fontString` before measurement
- Only `measureText(text).width` is used — no other canvas APIs

## Key Functions

- `getEngineProfile()` → engine profile with 4 parameters
- `getFontMeasurementState(font, needsEmojiCorrection)` → `{ cache, fontSize, emojiCorrection }`
- `getSegmentMetrics(text, cache)` → `SegmentMetrics` with width
- `getCorrectedSegmentWidth(text, metrics, correction)` → corrected width
- `getSegmentGraphemeWidths(text, metrics, cache, correction)` → `number[]`
- `getSegmentGraphemePrefixWidths(text, metrics, cache, correction)` → `number[]`
- `clearMeasurementCaches()` — reset segment cache and canvas context
