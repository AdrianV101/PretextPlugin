---
name: pretext-debugging
description: >-
  Use when debugging pretext issues — wrong line counts, incorrect heights, measurement
  mismatches between pretext and DOM/browser, unexpected wrapping behavior, performance
  problems with prepare(), or environment setup issues with OffscreenCanvas.
---

# Pretext Debugging Guide

Systematic approach to diagnosing pretext issues. Start with the diagnostic flowchart,
then drill into the relevant section.

## Diagnostic Flowchart

```
Issue reported
├── Wrong height/lineCount?
│   ├── Compare with browser: is browser also "wrong"? → pretext matches CSS, not your expectation
│   ├── Using system-ui font? → switch to named font (macOS mismatch)
│   ├── Off by exactly 1 line? → check trailing newline in pre-wrap (trailing \n = no extra line)
│   └── Off by many lines? → check maxWidth units (must be px), check lineHeight
├── Measurement mismatch (pretext vs DOM)?
│   ├── Which script? → check script-matrix accuracy rates
│   ├── Arabic/Urdu? → likely fine-width edge-fit or ligature (inherent)
│   ├── Chinese? → font-dependent, check installed CJK fonts
│   ├── Emoji? → check if correction is applied (Chrome/Firefox macOS)
│   └── All scripts? → likely font issue (system-ui, font loading race)
├── Performance problem?
│   ├── prepare() slow? → expected for complex scripts on Safari; cache result
│   ├── layout() slow? → should be ~0.0002ms; check you're not calling prepare() on resize
│   └── Memory growing? → segment cache grows with unique (font, segment) pairs; clearCache() resets
├── Crash or error?
│   ├── OffscreenCanvas not defined? → browser too old or SSR environment
│   ├── Intl.Segmenter not defined? → browser too old (pre-2022)
│   └── Other error? → check input types (text must be string, font must be string)
└── Unexpected wrapping?
    ├── Word not breaking? → might be NBSP or zero-width joiner preventing break
    ├── Breaking mid-word? → overflow-wrap at grapheme boundary (word wider than maxWidth)
    ├── CJK punctuation orphaned? → kinsoku rules should prevent; check character ranges
    │                                 v0.0.6 fixed CJK + opening-bracket annotations specifically
    ├── CJK keep-all not grouping correctly? → see "wordBreak: keep-all debugging" below
    ├── letterSpacing producing wrong widths? → see "letterSpacing debugging" below
    └── Soft hyphen not showing? → only visible when chosen as break point
```

## wordBreak: keep-all Debugging *(v0.0.5+)*

If `{ wordBreak: 'keep-all' }` doesn't seem to do anything:
- Confirm the text is CJK or Hangul. `keep-all` is a no-op on Latin/Cyrillic/Arabic.
- Confirm pretext is at least v0.0.5. Earlier versions silently ignore the option.
- For mixed Latin/numeric/CJK runs (e.g. `"하루 100개"`), v0.0.6 fixed grouping; on v0.0.5 the boundary may behave differently.

If keep-all is wrapping where you expect a no-break:
- `keep-all` is *atomic-grouping*, not *no-wrap-ever*. A run wider than `maxWidth` still falls back to grapheme overflow.
- Check whether a punctuation character is breaking the run. v0.0.6 specifically fixed CJK + `（〔《【` opening-bracket annotation breaking.

## letterSpacing Debugging *(v0.0.6+)*

If widths look way off when `letterSpacing` is set:
- Confirm the value is in CSS pixels, not em or %. `letterSpacing: 8` at 16px font is roughly equivalent to CSS `letter-spacing: 0.5em`. If you intended em, multiply by font-size.
- letterSpacing is added between *every* grapheme, including inside CJK runs. Native CSS adds it differently in some engines.
- Total width adds `(graphemeCount - 1) * letterSpacing` per segment. Use `pretext_measure` to compare per-segment widths with and without letterSpacing.

If only some text is affected:
- In `prepareRichInline`, `letterSpacing` is per-item, not global. A mixed-font run can have one item with letterSpacing and another without.

## Browser-Specific Issues

### Chrome/Chromium
- Emoji measured wider in canvas than DOM at small sizes (<24px) on macOS → auto-corrected
- CJK closing-quote carry enabled (punctuation stays with CJK character after closing quote)
- Soft-hyphen: defers break (tries to fit more content)

### Safari/WebKit
- Line-fit tolerance: 1/64px (vs 0.005px on Chrome) — fixed-point arithmetic
- prepare() significantly slower for Arabic (3.4x), Hindi (3.6x), Urdu (8.4x)
- Soft-hyphen: breaks at first opportunity
- Grapheme widths use prefix strategy (more accurate for kerning)
- No emoji correction needed

### Firefox/Gecko
- Similar to Chrome for most behaviors
- Emoji correction active on macOS
- CJK closing-quote carry disabled (like Safari)

## Line-Fit Tolerance Debugging

If a line breaks differently than expected by exactly 1 segment:

1. Measure the segment width: `pretext_measure` tool in structural mode
2. Check if width + current line width is within tolerance of maxWidth
3. Chrome tolerance: 0.005px, Safari: 0.015625px (1/64)
4. The segment may fit on Chrome but overflow on Safari, or vice versa

## Edge-Case Behavior Reference

| Input | Expected |
|---|---|
| Empty string | 0 lines, height 0 |
| maxWidth=0 | 1 grapheme per line |
| 10K-char word | Grapheme-level overflow-wrap |
| Tab in pre-wrap | Advances to next tab stop (tab-size 8) |
| Trailing space | Hangs past line edge (CSS behavior) |
| NBSP | Non-breaking, visible, part of line width |
| ZWSP | Zero-width break opportunity |

## Performance Debugging Checklist

1. **Are you calling prepare() on resize?** → Move to init/text-change
2. **Are you inlining prepare() in layout()?** → Store the handle
3. **Which browser?** Safari prepare() is slower for complex scripts
4. **How many unique fonts?** Each font creates a separate cache bucket
5. **How many unique segments?** Cache grows with unique (font, segment) pairs
6. **Are you calling clearCache() in a loop?** → Remove from hot path
