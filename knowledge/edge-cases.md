# Edge Cases and Adversarial Inputs

Tested with 20 adversarial inputs. Zero crashes, zero NaN results, zero infinite loops, zero memory explosions.

## Empty and Degenerate Input

| Input | Behavior |
|---|---|
| Empty string `""` | Returns `{ lineCount: 0, height: 0 }` |
| Whitespace only `"   "` | Normal mode: collapsed to nothing, 0 lines. Pre-wrap: 1 line of spaces. |
| Single character `"a"` | 1 line, width = character width |
| Single space `" "` | Normal: 0 lines. Pre-wrap: 1 line. |
| Only newlines `"\n\n\n"` | Normal: collapsed, 0 lines. Pre-wrap: 3 hard breaks. |
| Null/undefined | Not handled — caller must validate input types |

## Extreme Dimensions

| Scenario | Behavior |
|---|---|
| `maxWidth = 0` | Every segment overflows. Overflow-wrap breaks at grapheme level. 1 grapheme per line. |
| `maxWidth = -1` | Same as 0 — every segment overflows |
| `maxWidth = Infinity` | All text on one line |
| `maxWidth = 0.001` | Grapheme-level breaking |
| `lineHeight = 0` | Returns `height: 0` regardless of line count |
| `lineHeight < 0` | Returns negative height (line count is still correct) |

## Extreme Content

| Input | Behavior |
|---|---|
| 10,000-char single word | Overflow-wrap breaks at grapheme boundaries. Works correctly. |
| 100,000 words | Processes successfully. Linear time in segment count. |
| Very long line (no spaces) | Grapheme-level breaking via `breakableWidths` |
| Only punctuation `"...!!!"` | Treated as text segments, wrapped normally |
| Only emoji `"😀😁😂🤣"` | Each emoji is one grapheme, overflow-wrap works |
| ZWJ sequences `"👨‍👩‍👧‍👦"` | Treated as single grapheme by `Intl.Segmenter` |

## Whitespace Edge Cases

| Input | Normal Mode | Pre-Wrap Mode |
|---|---|---|
| Trailing newline `"a\n"` | 1 line | 1 line (not 2) |
| Leading spaces `"   hello"` | Collapsed, `"hello"` | Preserved, 3 spaces + "hello" |
| Tab characters | Collapsed to space | Tab-stop advancement (tab-size 8) |
| Mixed whitespace `" \t \n "` | All collapsed | Each preserved per kind |
| Trailing spaces on line | Hang past edge (CSS behavior) | Hang past edge |
| NBSP `\u00A0` | Non-breaking, visible | Non-breaking, visible |

## Font Edge Cases

| Scenario | Behavior |
|---|---|
| Empty font string `""` | Canvas uses default font. Measurements may be inconsistent. |
| Invalid font string | Canvas falls back to default. No error thrown. |
| `system-ui` | Works but accuracy degrades on macOS (canvas/DOM mismatch) |
| Very small font `"1px sans-serif"` | Works. Emoji correction may be larger relative to text. |
| Very large font `"200px sans-serif"` | Works. No emoji correction needed at large sizes. |

## Soft Hyphen Behavior

- Invisible in output unless chosen as break point
- At break: `line.text` includes trailing `-`, `line.width` includes hyphen width
- Multiple soft hyphens in same word: browser-dependent break preference (Safari: first opportunity; Chromium: fit more content)
