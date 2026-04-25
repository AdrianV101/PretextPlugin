# Rich-Inline Module (rich-inline.ts)

Inline-only rich text layout for chat lines, markdown lines, and mention/chip/atom UIs. Added in pretext v0.0.5 as a separate public sub-module at `@chenglou/pretext/rich-inline`.

Distinct from `prepareWithSegments` (the "rich" path). That API takes a single `string` + single `font`. Rich-inline takes an array of `RichInlineItem`s where each item has its own font, optional `letterSpacing`, atomicity flag, and chrome `extraWidth`. Use rich-inline when an inline run mixes fonts/styles or contains pill-shaped atoms that must never split mid-word.

> Scope: rich-inline is **inline-only** — there is no notion of paragraph breaks, soft-hyphens, kinsoku, or vertical layout in this module. For multi-line rich documents, use rich-inline per logical line, or stick with `prepareWithSegments` + `layoutWithLines`.

## Item Model

```typescript
type RichInlineItem = {
  text: string                    // raw content; boundary spaces collapse across items
  font: string                    // CSS font shorthand for this item
  letterSpacing?: number          // CSS pixels (v0.0.6+); per-item, not global
  break?: 'normal' | 'never'      // 'never' makes the whole item atomic
  extraWidth?: number             // extra px reserved for chrome (border/padding)
}
```

Conceptually each item is a styled inline run. The collection of items is a single logical line that may wrap onto multiple visual lines depending on `maxWidth`.

## Whitespace Collapse Behavior

Rich-inline collapses whitespace at item boundaries the way browsers collapse it across inline elements:
- Trailing space at the end of one item plus leading space on the next collapses to one space.
- Leading whitespace at the start of the first item is dropped.
- Trailing whitespace at the end of the last item hangs past line edge without triggering a break.
- Whitespace internal to an item is governed by its own segmentation, not collapse.

This matches CSS inline formatting context for non-`pre-wrap` content. There is no `whiteSpace: 'pre-wrap'` mode in rich-inline — supply already-formatted runs if you need it.

## Atomic Items (chips/mentions)

Setting `break: 'never'` on an item makes the whole item atomic — it never splits mid-word. If it doesn't fit on the current line it moves intact to the next line. Use this for:
- Username chips (`@alice`)
- Hashtags (`#design`)
- Inline pills (`[draft]`)
- Code spans that must stay together
- Any atom with surrounding chrome/padding (`extraWidth`)

If an atomic item is wider than `maxWidth`, it is placed alone on its line and overflows by design — there is no fallback to character-level wrapping.

## Per-Item letterSpacing

`letterSpacing` is a per-item option, not a global option, in rich-inline (unlike `prepare()` where it lives on `PrepareOptions`). This lets a chip with kerning-tight font sit next to body text with default spacing. Pretext v0.0.6+ required.

## Fragments and Cursors

Each visual line is a `RichInlineLine` (or `RichInlineLineRange` if not yet materialized) containing `fragments[]`. A fragment is one item's slice on that line:

```typescript
type RichInlineFragment = {
  itemIndex: number       // which item this fragment came from
  text: string            // the slice of item.text on this line (after collapse)
  gapBefore: number       // CSS px gap inserted before this fragment (e.g. collapsed boundary)
  occupiedWidth: number   // px the fragment plus its gapBefore actually occupy
  start: LayoutCursor
  end: LayoutCursor
}
```

The cursor type is `RichInlineCursor = { itemIndex; segmentIndex; graphemeIndex }` — adds `itemIndex` over the plain `LayoutCursor` so callers can resume mid-item.

`RichInlineLineRange` is identical but with `RichInlineFragmentRange` (no `text`) — used to defer string allocation when only widths and cursors are needed.

## Caching Model

Rich-inline reuses the same per-font segment metrics cache as the core path (`measurement.ts`). `clearCache()` from the main module clears both. There is no rich-inline-specific cache to flush.

## Key Functions

- `prepareRichInline(items)` → `PreparedRichInline` — opaque handle. Equivalent of `prepareWithSegments` for rich-inline.
- `layoutNextRichInlineLineRange(prepared, maxWidth, start?)` → `RichInlineLineRange | null` — single-line stepper, no string allocation.
- `materializeRichInlineLineRange(prepared, range)` → `RichInlineLine` — hydrates fragment text on demand.
- `walkRichInlineLineRanges(prepared, maxWidth, onLine)` → line count — batch geometry pass without materialization.
- `measureRichInlineStats(prepared, maxWidth)` → `{ lineCount, maxLineWidth }` — single-pass aggregate; cheaper than walking when only totals are needed.

## When To Reach For Rich-Inline vs Plain prepare()

Rule of thumb: if the inline content has more than one font, or contains atoms that must never split, use rich-inline. Otherwise plain `prepare()` is simpler and slightly cheaper. See `knowledge/api-reference.md` "API Decision Tree" for the full matrix.
