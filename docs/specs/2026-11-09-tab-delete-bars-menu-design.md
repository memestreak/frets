# Tab: the bar menu and the note menu (issue #191)

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

## Two menus

Later the same day Jeremy asked for a right-click on a bar and a
right-click on a note to open different menus. With nothing picked (no
word, signature, bar line or mark), what was under the press decides:

- **On a note** (a fret on the tab or a head on the staff, of any
  Voice; what a left press would pick as a note): the **note menu**,
  named "Note": Move to voice › and Select only voice › (when they
  apply), Insert paste, and the beam tools (when they apply).
- **Beside the notes** (blank space in a bar, a rest, an empty bar): the
  **bar menu**, named "Bar":
  1. **Insert ›**, a submenu with **Bar before** and **Bar after**. They
     do what Insert bar before and after did (Ctrl+Shift+Enter,
     Ctrl+Enter, the Bars group's first two buttons).
  2. **Delete bar**: with a selection, every bar it touches, in part or
     whole; with none, the bar pressed (the press selects it, as a left
     press beside the notes does). With more than one bar the label
     counts them: "Delete 2 bars".
  3. **Insert paste**, in both menus: it puts the clipboard in before the
     cursor, which is as useful on an empty bar as on a note.
- A right-click inside a selection keeps it, on a note or beside one.
- **Shift+F10** (no pointer): the note menu when a note is picked or the
  selection isn't whole bars; otherwise the bar menu.
- A long press on a touch screen counts as a right-click where it was
  pressed.
- In note input mode, a right-click beside the notes moves the caret
  there and enters nothing (a left press there enters an open string or
  a staff note).

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
- `TabClip.tsx`: `onMenuPress(onNote)` on a right-click or touch; a
  right-click's press tells `onPick` / `onPickStaff` it is one (`menu`),
  so note input mode enters nothing.
- `TabPage.tsx`: the two menus, the bars from the selection's ends, else
  the cursor's bar; `coversWholeBars` (`editing.ts`) for Shift+F10.
- Test arrangement `editing_tests/delete-bars-menu.atex`.

## Tests

- Beside the notes: the menu is "Bar", with Insert ›, Delete bar and
  Insert paste in that order, and no Move to voice.
- On a note: the menu is "Note", with Move to voice and Insert paste, and
  no Insert › or Delete item.
- A right-click on a note off any word or mark opens the note menu, not a
  picked thing's.
- Shift+F10 with no note picked: the bar menu; with a note picked: the
  note menu.
- Insert › Bar before and Bar after add a bar of rests before and after
  the pressed bar.
- Delete bar takes away the pressed bar; undo brings it back.
- A selection from one bar into the next, right-clicked beside a note:
  "Delete 2 bars" takes both away, and afterwards the label is "Delete
  bar" again (nothing selected).
- Select everything, Shift+F10: "Delete 3 bars" leaves one whole rest.
- In note input mode, a right-click beside the notes leaves the clip
  unchanged, and its Delete bar takes the bar pressed.
- `deleteBars`: the cursor goes to the bar after the span, else the last
  bar.
- `deleteBars`: deleting a bar that changed the time keeps the following
  bars in it; a following bar's own change is kept; deleting from the
  first bar makes it the clip's time.
- `deleteBars`: the key and tempo in force carry to the next bar; a tempo
  equal to the one before the span is not written.
- `deleteBars`: deleting every bar of a 3/4 clip leaves one dotted half
  rest in 3/4.
