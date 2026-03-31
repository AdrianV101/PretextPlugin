# Bidi Module (bidi.ts)

Simplified UAX #9 bidirectional text support. Only active on the `prepareWithSegments()` path.

## Scope

Computes per-segment embedding levels for mixed LTR/RTL text. Used for custom rendering that needs to reorder segments for visual display. **Not consumed by any layout API** — levels are metadata for the caller.

## Implementation

`computeSegmentLevels(segments, kinds)` → `Int8Array | null`

1. Scan segments for RTL characters (Arabic, Hebrew ranges via `charCodeAt()`)
2. If no RTL characters found: return `null` (pure LTR text)
3. Otherwise: assign levels based on character directionality
   - RTL characters: odd level (1)
   - LTR characters: even level (0)

## Known Limitations

### charCodeAt() vs codePointAt()

Bidi detection uses `charCodeAt()` which only sees the BMP (U+0000–U+FFFF). Supplementary-plane RTL characters (rare: ancient scripts) would be misclassified as LTR. The analysis module uses `codePointAt()` for CJK which correctly handles astral plane.

### Dead Code: Ratio Threshold

The code contains a ratio check (`len / numBidi >= threshold`) but the condition `len/numBidi >= 1 > 0.3` is always true when any bidi characters exist. The start level is always 1 (RTL) when bidi characters are present.

### segLevels Has Zero Consumers

The computed `segLevels` array is stored in `PreparedTextWithSegments` but never read by any pretext API. It exists as metadata for external custom renderers that need visual reordering.

## Practical Impact

- Pure LTR text: `segLevels = null`, zero cost
- Mixed text: levels computed but only useful for callers doing their own bidi rendering
- Pretext's line breaking works identically regardless of text direction — it operates on segment widths, not character order
