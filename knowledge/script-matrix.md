# Script Support Matrix

Per-script accuracy, preprocessing, and known issues for pretext. Numbers below come from the v0.0.3 validation sweep; v0.0.5 and v0.0.6 added improvements that haven't been re-benchmarked but are noted inline.

## Latin

- **Accuracy:** Perfect across all browsers
- **Preprocessing:** Standard word segmentation, punctuation merging
- **Line breaking:** Word-level wrap, overflow-wrap at grapheme boundaries
- **Known issues:** None

## CJK (Chinese, Japanese, Korean)

- **Accuracy:** Korean perfect; Japanese 55-56/61; Chinese 42-54/61 (font-sensitive)
- **Preprocessing:** `isCJK()` covers BMP + Extensions A-G via `codePointAt()`. Kinsoku rules for punctuation attachment. CJK closing-quote carry (Chromium only).
- **Line breaking:** Per-grapheme units. Each CJK character is a potential break point, except kinsoku-prohibited positions.
- **Known issues:** Extension H gap (newest Unicode block). Chinese accuracy highly font-dependent — varies by installed CJK fonts.
- **v0.0.5+:** Bidi metadata and CJK detection now correctly handle astral Unicode ranges; analysis is more resilient on long mixed-script and repeated-punctuation inputs. `wordBreak: 'keep-all'` available for atomic CJK/Hangul grouping.
- **v0.0.6+:** CJK text preceding opening-bracket annotations (e.g. `（〔《【`) now breaks like browsers instead of orphaning the bracket. `keep-all` improvements for mixed Latin/numeric/CJK runs without spaces.

## Arabic

- **Accuracy:** 594-598/601 (~98.8%)
- **Preprocessing:** No-space cluster detection, punctuation attachment, space-and-marks splitting in post-merge pipeline
- **Line breaking:** Standard word-level wrap
- **Known issues:** Fine-width edge-fit mismatches — connected Arabic forms measure slightly differently in canvas vs DOM. 3-7 mismatches per test sweep.

## Urdu (Nastaliq)

- **Accuracy:** 31/61 — worst performing script
- **Preprocessing:** Same as Arabic
- **Line breaking:** Standard word-level wrap
- **Known issues:** Nastaliq ligature wall — up to 76px total mismatch in test corpus. Canvas cannot access the layout engine's ligature formation. Inherent limitation.

## Hebrew

- **Accuracy:** Perfect (61/61)
- **Preprocessing:** No Hebrew-specific rules. Standard word segmentation.
- **Line breaking:** Standard word-level wrap. Bidi levels correctly assign odd (RTL) level.
- **Known issues:** None

## Thai

- **Accuracy:** 59-60/61
- **Preprocessing:** Relies entirely on `Intl.Segmenter` for word boundaries (Thai has no spaces between words)
- **Line breaking:** Word-level wrap per segmenter boundaries
- **Known issues:** `Intl.Segmenter` dictionary may differ between browser versions, causing occasional boundary disagreements.

## Khmer

- **Accuracy:** Perfect (61/61)
- **Preprocessing:** Same as Thai — `Intl.Segmenter` dependency
- **Line breaking:** Word-level wrap per segmenter
- **Known issues:** Same segmenter dependency as Thai (accuracy may vary with engine updates)

## Hindi / Devanagari

- **Accuracy:** Perfect (61/61)
- **Preprocessing:** Danda (।) and double-danda (॥) punctuation handling
- **Line breaking:** Standard word-level wrap
- **Known issues:** None

## Myanmar

- **Accuracy:** ~56-57/61 — frontier script
- **Preprocessing:** Medial consonant glue (U+104F), punctuation attachment
- **Line breaking:** Word-level wrap with glue-connected runs
- **Known issues:** Most complex preprocessing. 6 anchor widths have exact agreement; wider widths show small deviations.

## Emoji

- **Accuracy:** Correct after emoji correction (Chrome/Firefox macOS)
- **Preprocessing:** `Intl.Segmenter` with `granularity: 'grapheme'` handles ZWJ sequences, skin tone modifiers, flag sequences
- **Line breaking:** Each emoji grapheme (including ZWJ sequences) is one breakable unit
- **Known issues:** No emoji-specific tests in layout.test.ts. Emoji correction factor is font-size dependent. Variable-width emoji (flags vs faces) may have different correction characteristics.

## Mixed Script / Bidi Text

- **Preprocessing:** Each script's rules fire independently on the relevant segments
- **Bidi:** Simplified UAX #9 on `prepareWithSegments()` path only. Levels computed but not consumed by layout APIs.
- **Line breaking:** Script-independent — operates on segment widths regardless of script
- **Known issues:** Bidi uses `charCodeAt()` (BMP only) while analysis uses `codePointAt()`. Supplementary RTL characters would be misclassified.
