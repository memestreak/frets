# Tab: Delete bar and an Insert submenu in the right-click menu (issue #191)

The tab's right-click menu (on no picked word or mark) offered Insert bar
before, Insert bar after and Insert paste, but no way to take a bar away.
Ctrl/⌘+Delete on a selection covering whole bars did it, but only by
taking the time away, and it doesn't reach a bar the selection covers in
part. Jeremy asked (2026-11-09) for a right-click Delete of the selected
bar or bars, and for the two bar insertions under an Insert submenu that
comes first in the menu. This is the first item from issue #191's
candidate list.

Dorico has Edit › Delete Bars (and the system track's trash icon, and
the Bars popover with a negative count, Shift+B then `-2`), with no
default key. Frets' key for it stays Ctrl/⌘+Delete on a selection of
whole bars.

## The menu

On the tab, with nothing picked, the menu's first items are:

1. **Insert ›**, a submenu with **Bar before** and **Bar after**. They do
   what Insert bar before and after did (Ctrl+Shift+Enter, Ctrl+Enter,
   the Bars group's first two buttons): a bar of rests before or after
   the pressed bar.
2. **Delete bar**: with a selection, every bar it touches, in part or
   whole; with none, the bar under the right-click (the press puts the
   cursor there). With more than one bar the label counts them: "Delete
   2 bars".

The items after them are as before: Move to voice ›, Select only
voice ›, Insert paste, and the beam tools. Insert paste stays a top-level
item for now.

## Deleting bars

- The bars go whole: their notes in every Voice, their Text, chord names
  and marks, and their bar settings (repeats, endings, sections).
- The music after them is unchanged. The bar that follows takes the time
  signature (with its Beat groups), key and tempo that were in force at
  the end of the deleted bars, unless it sets its own; a value that
  repeats the one in force before the deleted bars is not written.
  Deleting from the first bar makes the time in force the clip's own.
- With every bar deleted, one bar of rests in the time in force is left.
- The cursor goes to the first column of the bar after the deleted ones,
  else of the last bar. Nothing stays selected.
- One undo step brings the bars back.
- In an arrangement with several tracks, the other tracks lose the same
  bars, as with Ctrl/⌘+Delete (`withPart` keeps bars by `origin`).

## How

- `deleteBars(clip, first, last)` in `editing.ts`.
- `TabPage.tsx`: the menu's Insert submenu and Delete bar, the bars from
  the selection's ends, else the cursor's bar.
- Test arrangement `editing_tests/delete-bars-menu.atex`.

## Tests

- The menu's first two items are Insert › and Delete bar; Insert bar
  before and Insert bar after are no longer top-level items.
- Insert › Bar before and Bar after add a bar of rests before and after
  the pressed bar.
- Delete bar takes away the pressed bar; undo brings it back.
- A selection from one bar into the next: "Delete 2 bars" takes both away,
  and afterwards the label is "Delete bar" again (nothing selected).
- Select everything: "Delete 3 bars" leaves one whole rest.
- `deleteBars`: the cursor goes to the bar after the span, else the last
  bar.
- `deleteBars`: deleting a bar that changed the time keeps the following
  bars in it; a following bar's own change is kept; deleting from the
  first bar makes it the clip's time.
- `deleteBars`: the key and tempo in force carry to the next bar; a tempo
  equal to the one before the span is not written.
- `deleteBars`: deleting every bar of a 3/4 clip leaves one dotted half
  rest in 3/4.
