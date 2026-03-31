# Analysis Module (analysis.ts)

Text normalization and segmentation. Converts raw text into a structured `TextAnalysis` with parallel arrays of segment texts, break kinds, and character offsets.

## Segment Break Kinds

8 variants — never collapse to boolean:

| Kind | Meaning | Example |
|---|---|---|
| `text` | Normal content | `"hello"`, `"world"` |
| `space` | Collapsible whitespace | `" "` (hangs past line edge) |
| `preserved-space` | Non-collapsible (pre-wrap) | `" "` |
| `tab` | Tab character (pre-wrap) | `"\t"` (tab-size 8) |
| `glue` | Non-breaking | NBSP `\u00A0`, NNBSP, word joiner |
| `zero-width-break` | Break opportunity | ZWSP `\u200B` |
| `soft-hyphen` | Invisible unless break chosen | `\u00AD` shows `-` at break |
| `hard-break` | Forced line break | `\n` in pre-wrap |

## 12-Step Preprocessing Pipeline

1. **Whitespace normalization** — collapse in normal mode, preserve in pre-wrap
2. **Empty check** — early return for empty text
3. **Word segmentation** — `Intl.Segmenter` with `granularity: 'word'`
4. **Break-kind splitting** — classify each segment into one of 8 kinds
5. **First-pass merge cascade** — CJK closing-quote carry, kinsoku, Myanmar medial glue, Arabic no-space clusters, repeated chars, left-sticky punctuation
6. **Escaped-quote merging** — `\"word\"` kept as single unit
7. **Forward-sticky clustering** — reverse pass for right-to-left punctuation attachment
8. **Compaction** — remove empty segments
9. **Glue-connected run merging** — merge segments connected by NBSP/NNBSP/word joiner
10. **Post-merge pipeline** — URL segmentation, query string splitting, numeric/time-range runs, ASCII punctuation runs, CJK boundary carry
11. **Arabic space-and-marks splitting** — break Arabic clusters at spaces and combining marks
12. **Chunk compilation** — single chunk in normal mode, split at hard-breaks in pre-wrap

## Kinsoku Rules (CJK Line Breaking)

Two-level implementation:
1. **Word-level** (analysis.ts): `kinsokuEnd` set prevents line-ending characters (opening brackets, etc.) from ending a line. `kinsokuStart` set prevents line-starting characters (closing brackets, periods) from starting a line. Merge adjacent segments to enforce.
2. **Grapheme-level** (layout.ts measurement phase): when CJK segments are split into per-grapheme units, kinsoku-aware merging keeps prohibited punctuation attached.

## Script-Specific Preprocessing

- **Arabic**: No-space cluster detection, punctuation attachment, space-and-marks splitting
- **CJK**: `isCJK()` covers Extensions A-G (uses `codePointAt()` for astral plane), closing-quote carry (Chromium only via engine profile)
- **Myanmar**: Medial consonant glue (U+104F), punctuation attachment
- **Hindi/Devanagari**: Danda/double-danda punctuation handling
- **Thai/Khmer**: No analysis-level rules — relies entirely on `Intl.Segmenter`
- **Emoji**: Handled at measurement phase, not analysis

## Key Functions

- `analyzeText(text, whiteSpace)` → `TextAnalysis` — main entry point
- `isCJK(char)` → boolean — covers BMP + Extensions A-G via `codePointAt()`
- `kinsokuEnd` / `kinsokuStart` — `Set<string>` of prohibited line-end/start chars
- `leftStickyPunctuation` — punctuation that attaches to following text
- `clearAnalysisCaches()` — reset word segmenter
- `setAnalysisLocale(locale)` — change segmenter locale
