# Line-Break Module (line-break.ts)

Hot-path line walking core. Shared by all layout APIs. Operates on parallel arrays — never inspects text content, never touches DOM or canvas.

## Simple Path vs Full Path

**Simple path** (`countPreparedLines`): Tight for-loop when `simpleLineWalkFastPath` is true. Handles only `text`, `space`, and `zero-width-break` kinds. Single chunk. No soft hyphens, tabs, or hard breaks. Used by `layout()`.

**Full path** (`walkPreparedLines`): Handles all 8 segment kinds, multiple chunks (pre-wrap), soft hyphens, tabs, overflow-wrap at grapheme boundaries. Used by `layoutWithLines()`, `walkLineRanges()`, and the counter when fast path is unavailable.

Both paths produce identical line-break decisions for the same input.

## Line-Fit Tolerance System

A segment fits the current line if: `currentWidth + segmentWidth <= maxWidth + lineFitEpsilon`

- Chromium/Gecko: `lineFitEpsilon = 0.005` (higher precision floating point)
- Safari/WebKit: `lineFitEpsilon = 1/64 = 0.015625` (1/64-pixel fixed-point arithmetic)

This tolerance matches browser rendering behavior with 100% accuracy across 23,040 test cases.

## Three-Width Advance System

Each segment has three width values:
- **content width** (`widths[]`): raw measured width
- **fit advance** (`lineEndFitAdvances[]`): width contribution for line-fit decision when line ends after this segment
- **paint advance** (`lineEndPaintAdvances[]`): visual width when line ends after this segment

For most segments, all three are equal. Differences arise with:
- **Trailing spaces**: fit=0 (hang past edge), paint=0
- **Soft hyphens**: content=0 (invisible), fit=hyphenWidth (if chosen as break), paint=hyphenWidth

## Overflow-Wrap at Grapheme Boundaries

When a single segment is wider than `maxWidth`:
1. Check `breakableWidths[segIndex]` for grapheme-level widths
2. Walk grapheme widths, fitting as many as possible per line
3. Break at grapheme boundaries (not byte or codepoint boundaries)
4. Handles CJK, emoji sequences, and other multi-codepoint graphemes correctly

Safari uses `breakablePrefixWidths` for kerning-aware grapheme sizing.

## Soft Hyphen State Machine

Soft hyphens (`\u00AD`) are invisible unless chosen as a break point:
1. Accumulate width of segments following a soft hyphen
2. When line overflows, check if breaking at the soft hyphen (adding hyphen width) would have fit
3. Safari: break at first opportunity (take immediately)
4. Chromium/Other: try to fit more content before breaking

## Tab Stop Calculation

Pre-wrap tabs advance to the next tab stop: `tabStopAdvance = spaceWidth * 8`. Tab stop positions are absolute from line start. Tab width = `tabStopAdvance - (currentLineWidth % tabStopAdvance)`.

## Key Functions

- `countPreparedLines(prepared, maxWidth)` → number — fast counter (simple or full path)
- `walkPreparedLines(prepared, maxWidth, onLine)` → number — full path with line callback
- `layoutNextLineRange(prepared, start, maxWidth)` → `InternalLayoutLine | null` — single line stepper
