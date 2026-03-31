# Browser Measurement Mismatch Taxonomy

Pretext uses canvas `measureText` for shaping. Browsers render text via their layout engine. These two systems can disagree. This taxonomy classifies the disagreement types.

## Rounding Mismatches

Sub-pixel differences from floating-point arithmetic. Compensated by line-fit tolerance: 0.005px (Chromium/Gecko) or 1/64px (Safari/WebKit). These are inherent and handled automatically.

## Emoji Width Inflation

Chrome/Firefox on macOS measure emoji wider in canvas than DOM at small font sizes (<24px). Pretext auto-detects and corrects this per-font via a one-time DOM calibration read. Safari has no discrepancy. **Status: auto-corrected.**

## Fine-Width Edge-Fit

A segment barely fits the canvas measurement but overflows in DOM rendering, or vice versa. Common with Arabic connected forms. The line-fit tolerance handles most cases. Inherent — cannot be eliminated without matching the browser's exact shaping engine.

## Grapheme Kerning Differences

Canvas `measureText` returns the total width of a string. When pretext splits a word into graphemes (for overflow-wrap), it sums individual grapheme widths. Browsers apply inter-grapheme kerning that the sum misses. Safari's prefix-width strategy (measuring "a", "ab", "abc" and differencing) captures kerning. **Partially fixable; Safari path is more accurate.**

## Arabic/Urdu Ligature Width

Connected Arabic script forms can have significantly different widths than the sum of their parts. Urdu Nastaliq has the worst case: up to 76px total mismatch in test corpus. **Inherent — ligature formation in the layout engine is not accessible via canvas.**

## Font Resolution Mismatch

`system-ui` resolves to different optical variants in canvas vs DOM on macOS. Other font fallback chains can also diverge. **Fixable: use specific font names instead of `system-ui`.**

## CJK Font Sensitivity

CJK accuracy varies by installed font. Chrome on Linux/Windows may use different CJK fonts than macOS. Test corpus shows 42-54/61 accuracy depending on font availability. **Environment-dependent, not fixable by pretext.**

## Script Segmentation

Thai, Khmer, Myanmar: word boundaries depend on dictionary-based `Intl.Segmenter` which may differ between browser versions. Myanmar medial consonant glue rules add complexity. **Inherent — segmenter behavior varies across engines.**

## Inherent vs Fixable Summary

| Category | Status | Action |
|---|---|---|
| Rounding | Handled | Tolerance system compensates |
| Emoji inflation | Auto-corrected | Per-font calibration |
| Fine-width edge-fit | Inherent | Tolerance helps, not eliminated |
| Grapheme kerning | Partially fixable | Safari prefix-width path |
| Arabic/Urdu ligature | Inherent | Cannot access layout engine ligatures |
| Font resolution | Fixable | Use named fonts, avoid system-ui |
| CJK font sensitivity | Environment | Depends on installed fonts |
| Script segmentation | Inherent | Segmenter varies across engines |
