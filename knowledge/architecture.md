# Pretext Architecture

## Two-Phase Design

1. **`prepare(text, font)`** — One-time: normalize whitespace, word-segment via `Intl.Segmenter`, apply script-specific preprocessing (kinsoku, Arabic clusters, URL segmentation, soft hyphens), measure via canvas `measureText`, cache widths. Returns opaque `PreparedText`.

2. **`layout(prepared, maxWidth, lineHeight)`** — Hot path: pure arithmetic over parallel arrays of cached widths. No DOM, no canvas, no string operations, no object allocation. ~0.0002ms per text.

The 203:1 cost ratio means prepare once, layout on every resize.

## Internal Representation (Struct of Arrays)

Prepared text is stored as parallel arrays, not an array of segment objects:

- `widths: number[]` — segment widths
- `kinds: SegmentBreakKind[]` — break behavior per segment
- `lineEndFitAdvances: number[]` — width contribution when line ends after this segment
- `lineEndPaintAdvances: number[]` — painted width when line ends after this segment
- `breakableWidths: (number[] | null)[]` — grapheme widths for overflow-wrap, null otherwise
- `breakablePrefixWidths: (number[] | null)[]` — cumulative prefix widths (Safari kerning shim)
- `chunks: PreparedLineChunk[]` — hard-break chunk boundaries (pre-wrap)

## Segment Break Kinds

8 variants, never collapsed to boolean:
- `text` — normal text content
- `space` — collapsible whitespace (hangs past line edge)
- `preserved-space` — non-collapsible space (pre-wrap)
- `tab` — tab character (pre-wrap, tab-size 8)
- `glue` — non-breaking (NBSP, NNBSP, word joiner)
- `zero-width-break` — zero-width break opportunity (ZWSP)
- `soft-hyphen` — invisible unless chosen as break point, then shows `-`
- `hard-break` — forced line break (`\n` in pre-wrap)

## End-to-End Data Flow

### prepare() internals

**Analysis phase** (`analysis.ts`): 12-step pipeline
1. Whitespace normalization
2. Empty check
3. Word segmentation (`Intl.Segmenter`)
4. Break-kind classification (8 variants)
5. First-pass merge cascade (CJK quote carry, kinsoku, Myanmar glue, Arabic clusters)
6. Escaped-quote merging
7. Forward-sticky clustering (reverse pass)
8. Compaction
9. Glue-connected run merging
10. Post-merge pipeline (URL, query, numeric, ASCII punctuation, CJK boundary carry)
11. Arabic space-and-marks splitting
12. Chunk compilation (1 chunk normal, split at hard-breaks in pre-wrap)

**Measurement phase** (`measurement.ts`):
- Set canvas font, create/get segment cache
- Detect emoji correction factor (Chrome/Firefox macOS)
- For each analysis segment: measure width, compute fit/paint advances
- CJK segments: split into per-grapheme units with kinsoku-aware merging
- Soft hyphens: width=0, advances=hyphen-width
- Compile PreparedCore with parallel arrays

### layout() internals

**Simple path** (no soft-hyphens, tabs, hard-breaks, or multi-chunk): tight for-loop over widths/kinds arrays. Line-fit tolerance: 0.005 (Chromium/Gecko) or 1/64 (Safari/WebKit).

**Full path**: walkPreparedLines handles all segment kinds, chunks, soft hyphens, tabs, overflow-wrap at grapheme boundaries.

## Key Invariants

1. `layout()` never touches DOM or canvas
2. `layout()` never performs string operations
3. `layout()` never performs measurement
4. `layout()` creates no objects (counter path)
5. Every segment has exactly one SegmentBreakKind
6. Script-specific break decisions live in analysis.ts, not line-break.ts
7. line-break.ts never inspects text content
8. Segment widths cached in `Map<font, Map<segText, SegmentMetrics>>`
9. Cache stores raw canvas widths; emoji correction applied at read time
10. Engine profile computed once, never invalidated
11. Trailing collapsible whitespace hangs past line edge (CSS behavior)
12. All layout APIs share the same line-break logic
13. `prepare()` and `prepareWithSegments()` produce identical line-break behavior
14. `simpleLineWalkFastPath` is a pure optimization flag
15. Bidi levels only on `prepareWithSegments()` path

## Performance Model

| Operation | Chrome | Safari | Notes |
|---|---|---|---|
| prepare() per text | 0.038ms | varies | Script-dependent on Safari |
| layout() per text | 0.0002ms | 0.0002ms | Pure arithmetic |
| Prepare:layout ratio | 203:1 | varies | Cache PreparedText |
| layout() vs DOM | 468x faster | 1,296x faster | Geometric mean ~779x |

Layout cost scales with segment count, not character count. Segment count correlates ~0.95 with layout cost.

## Dependency Graph

```
External APIs (Intl.Segmenter, Canvas, DOM, navigator)
         |
    analysis.ts, measurement.ts, bidi.ts
         |
    layout.ts (orchestration)
         |
    line-break.ts (pure arithmetic)
         |
    Public API surface
```

## Caching Architecture

- **Segment metrics cache**: `Map<font, Map<segment, SegmentMetrics>>` — shared across texts, cleared by `clearCache()`
- **Emoji correction cache**: per-font correction constant, cached alongside segment metrics
- **Engine profile**: computed once from `navigator.userAgent`, never invalidated
- **Canvas context**: created once, reused forever
- **Intl.Segmenter instances**: hoisted at module scope, word segmenter reset by `setLocale()`
- **Grapheme widths**: populated lazily within SegmentMetrics on first overflow-wrap need
