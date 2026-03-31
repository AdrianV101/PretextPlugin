---
name: pretext-i18n
description: >-
  Use when working with pretext and non-Latin scripts — CJK (Chinese, Japanese, Korean),
  Arabic, Hebrew, Thai, Hindi, Myanmar, Khmer, Urdu, emoji, or mixed-script/bidirectional
  text. Provides per-script guidance, accuracy expectations, and known limitations.
---

# Pretext Internationalization Guide

Script-specific guidance for pretext v0.0.3. Each script has different accuracy profiles,
preprocessing rules, and known limitations.

## Script Accuracy Summary

| Script | Accuracy | Verdict |
|---|---|---|
| Latin | Perfect | Production-ready |
| Korean | Perfect | Production-ready |
| Hebrew | Perfect | Production-ready |
| Hindi | Perfect | Production-ready |
| Khmer | Perfect | Production-ready |
| Arabic | ~98.8% | Production-ready (minor edge-fit mismatches) |
| Thai | ~98% | Production-ready (segmenter-dependent) |
| Japanese | ~90-92% | Usable (font-sensitive kana) |
| Myanmar | ~93% | Usable (frontier, medial glue) |
| Chinese | 69-89% | Caution (highly font-dependent) |
| Urdu | ~51% | Limited (Nastaliq ligature wall) |
| Emoji | Corrected | Production-ready after auto-correction |

## CJK (Chinese, Japanese, Korean)

### How It Works
1. `isCJK()` detects CJK characters (BMP + Extensions A-G via `codePointAt()`)
2. CJK segments split into per-grapheme units during measurement
3. Kinsoku rules prevent prohibited punctuation at line boundaries
4. Each CJK character is a potential line break point

### Kinsoku Rules
- **Opening brackets** (`「`, `（`, `【`, etc.): cannot end a line → merged with following content
- **Closing punctuation** (`。`, `、`, `」`, etc.): cannot start a line → merged with preceding content
- **Chromium only**: CJK character carries after closing quote (engine profile flag)

### Known Issues
- Chinese accuracy is font-dependent (42-54/61 in test corpus). Ensure CJK fonts are installed.
- Extension H (newest Unicode block) not covered by `isCJK()`
- Japanese katakana/hiragana treated as CJK for line breaking purposes

## Arabic

### How It Works
1. No-space cluster detection in preprocessing — Arabic words often lack spaces
2. Punctuation attachment to word clusters
3. Space-and-marks splitting in post-merge pipeline
4. Standard word-level line wrapping

### Known Issues
- 3-7 fine-width edge-fit mismatches per test sweep — connected Arabic forms measure slightly differently in canvas vs DOM
- Performance on Safari: 3.4x slower prepare() than Chrome

## Urdu (Nastaliq Script)

### Fundamental Limitation
Urdu uses the Nastaliq script where ligature formation dramatically changes word widths. Canvas `measureText` cannot access the browser's Nastaliq ligature engine. This produces up to 76px total mismatch in test corpus.

**Recommendation:** For Urdu-heavy applications, consider DOM-based measurement as a fallback, or accept approximate layout.

## Hebrew

Works perfectly. No special preprocessing. Bidi levels correctly assign RTL. No known issues.

## Thai

### How It Works
Thai has no spaces between words. Relies entirely on `Intl.Segmenter` for word boundary detection.

### Known Issues
- `Intl.Segmenter` dictionary varies between browser versions — occasional boundary disagreements
- Use `setLocale('th')` for best Thai segmentation

## Hindi / Devanagari

Works perfectly. Danda (।) and double-danda (॥) handled as punctuation. No known issues.

## Myanmar

Frontier script with most complex preprocessing:
- Medial consonant glue (U+104F)
- Punctuation attachment rules
- 6 anchor widths exact; wider widths show small deviations

## Khmer

Works perfectly. Relies on `Intl.Segmenter` (same as Thai). No known issues.

## Emoji

### How It Works
1. `Intl.Segmenter` with grapheme granularity handles ZWJ sequences, skin tones, flags
2. Chrome/Firefox macOS: emoji measured wider in canvas at small sizes → auto-corrected
3. Safari: no correction needed (canvas and DOM agree)
4. Each emoji grapheme is one breakable unit for overflow-wrap

### Tips
- Emoji correction is automatic — no developer action needed
- Works with ZWJ sequences (`👨‍👩‍👧‍👦`), skin tone modifiers, flag sequences
- Variable-width emoji (flags vs faces) may have different correction characteristics

## Mixed Script / Bidirectional Text

- Each script's preprocessing rules fire independently
- Bidi levels computed on `prepareWithSegments()` path only
- Levels are metadata — pretext does not reorder segments for display
- Visual reordering is the caller's responsibility
- Line breaking is script-independent (operates on widths, not characters)

### Bidi Limitations
- `charCodeAt()` used for RTL detection (BMP only) — supplementary RTL chars misclassified
- segLevels not consumed by any layout API — metadata for custom renderers
- Simplified UAX #9 — no bracket pair resolution (N0 rule)

## Locale Configuration

`setLocale(locale)` changes the `Intl.Segmenter` locale. Useful for:
- Thai: `setLocale('th')` for Thai-specific word boundaries
- Khmer: `setLocale('km')`
- Other dictionary-based scripts

Note: `setLocale()` calls `clearCache()` internally — all cached measurements are invalidated.
