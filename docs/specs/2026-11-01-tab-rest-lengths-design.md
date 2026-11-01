# Tab: changing a rest's length

Issue #290 (Jeremy, 2026-11-01). Follows #276, which made rests selectable (PR #279), and #238's rule that bars stay full.

## What it does

With a rest picked by itself in normal mode (a press on it, or the cursor on it with no string), the length keys and the palette's Duration buttons change its length, as MuseScore's do:

- 1–7 and Shift+1–7, in every view (Jeremy, 2026-11-01). 5 is a quarter. A rest has no fret for a digit to type, so with the tab alone the plain digits set its length too.
- W / Q and + / − make it one value longer or shorter.
- . and the Dotted button cycle its dots.
- Each Duration button sets its value.

Its bar stays full:

- **Longer:** it writes over what follows, as paste does (`pasteOver`). A column it covers only in part leaves the rest of its time as rests. Past the bar line it runs on into the next bar; at the clip's end a bar of rests is added for it to run into.
- **Shorter:** the time it gives up becomes rests after it, the fewest that fill it.

The rest stays picked, and the palette lights its new length.

Jeremy chose the overwrite rule over pushing the following notes along (2026-11-01).

## What stays as before

- A run of several columns (Shift-selected), a note, a grace note or a rest in a tuplet: the length keys change each column's length and the bar may come out long or short, as before.
- In note input the keys set the next note's length (`inputLength.ts`), not a rest's.

## Picking a rest with the tab alone

The tab draws a whole or half rest on an 18-wide line under the strings. A press anywhere along that line now picks it (`TAB_BAR_REST_REACH_X` in `hitTest.ts`). Before, a press near either end missed. Other rests keep the 9-wide reach, and where two reaches overlap the nearer rest is picked.

A multi-bar rest still can't be picked in any view.
