# Common Mistakes

Detectable anti-patterns in pretext usage. Each pattern has a detection heuristic, explanation, and fix.

## Using system-ui Font

**Pattern:** Font string contains `system-ui`
**Detection:** `/system-ui/i` in font parameter
**Severity:** Warning

Canvas resolves `system-ui` to different optical variants than DOM on macOS. Use named fonts (`'16px Inter'`, `'16px Helvetica'`, `'16px -apple-system, Helvetica'`) for guaranteed accuracy.

**Fix:** Replace `system-ui` with a specific font name.

## Calling prepare() on Resize

**Pattern:** `prepare()` called inside resize handler, animation frame, or layout effect
**Detection:** `prepare(` inside `resize`, `onResize`, `ResizeObserver`, `requestAnimationFrame`, `useLayoutEffect`
**Severity:** Error

`prepare()` is ~203x more expensive than `layout()`. Cache the `PreparedText` handle and call only `layout()` on resize.

**Fix:** Move `prepare()` to initialization/text-change and call `layout(prepared, newWidth, lineHeight)` on resize.

## Not Caching PreparedText

**Pattern:** `prepare()` and `layout()` called together without storing the handle
**Detection:** `layout(prepare(` or `layout(prepareWithSegments(`
**Severity:** Error

The entire value of the two-phase design is caching the prepared handle. Inlining `prepare()` inside `layout()` pays the full prepare cost every time.

**Fix:** Store the result of `prepare()` and reuse it across `layout()` calls.

## Using layout() When Line Data Is Needed

**Pattern:** Using `layout()` then separately computing line content
**Detection:** `layout(` followed by manual text splitting or DOM-based line detection
**Severity:** Warning

`layout()` only returns `{ lineCount, height }`. Use `layoutWithLines()` for line text/widths, `walkLineRanges()` for geometry-only, or `layoutNextLine()` for streaming.

**Fix:** Switch to the appropriate rich API.

## Using prepareWithSegments() Unnecessarily

**Pattern:** `prepareWithSegments()` used with `layout()` only
**Detection:** `prepareWithSegments(` without any call to `layoutWithLines`, `walkLineRanges`, or `layoutNextLine`
**Severity:** Info

`prepareWithSegments()` computes extra segment data and bidi levels. If only `layout()` is needed, `prepare()` is sufficient and slightly cheaper.

**Fix:** Use `prepare()` unless you need rich layout APIs.

## DOM Measurement Alongside Pretext

**Pattern:** Using `getBoundingClientRect`, `offsetHeight`, `clientHeight` for text layout
**Detection:** `getBoundingClientRect`, `offsetHeight`, `offsetWidth`, `clientHeight`, `clientWidth` near pretext API calls
**Severity:** Warning

The purpose of pretext is to avoid DOM-based text measurement. Mixing DOM measurement with pretext defeats the performance benefit and can cause layout thrashing.

**Fix:** Use pretext's layout APIs exclusively for text dimensions.

## Calling clearCache() Too Frequently

**Pattern:** `clearCache()` in render loop or layout handler
**Detection:** `clearCache()` inside render/layout/resize handlers
**Severity:** Error

Clearing the segment metrics cache forces full re-measurement on next `prepare()`. Only call when fonts change dramatically or to free memory.

**Fix:** Remove from hot paths. Call only on font-family changes or memory pressure.

## Missing whiteSpace Option for Pre-wrap Content

**Pattern:** Text with preserved whitespace but no `whiteSpace: 'pre-wrap'` option
**Detection:** Text contains `\t` or multiple consecutive `\n` without `whiteSpace: 'pre-wrap'`
**Severity:** Warning

Default `'normal'` mode collapses whitespace. Pre-formatted content (code blocks, logs) needs `{ whiteSpace: 'pre-wrap' }` to preserve spaces, tabs, and newlines.

**Fix:** Pass `{ whiteSpace: 'pre-wrap' }` to `prepare()`.

## Accessing PreparedText Internals

**Pattern:** Accessing internal properties of opaque PreparedText handle
**Detection:** Property access on prepared handle (`.widths`, `.kinds`, `.segments`, etc.)
**Severity:** Error

`PreparedText` is intentionally opaque. Internal representation may change. Use `prepareWithSegments()` for segment access.

**Fix:** Use the public API surface only.
