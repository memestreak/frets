# Tab: drag a fret number to another string

The last step of issue #238 (select and edit like MuseScore). In normal mode a fret number on the tab
can be dragged up or down to another string, as MuseScore lets a TAB note be moved from string to
string. It is Ctrl/⌘+↑ ↓ with the pointer.

## What it does

- **The pitch stays** (Jeremy, 2026-10-31, option 1 of three: keep the pitch / keep the fret / keep
  the pitch with Shift keeping the fret). The fret is worked out again for the new string: a 5 on the
  B string dragged to the G string becomes a 9. The note keeps its marks.
- **Normal mode only.** In note input a press on the tab enters a note, as before, and doesn't drag.
- **The press selects at once**, as any press on a note does; a press that doesn't move only selects.
- **The number follows the pointer**, a string for each string gap it goes up or down, and shows its
  new fret while the drag goes on. Over a string that has a note in the column, or can't play the
  pitch between the open string and the 24th fret, it goes to the nearest string back toward where it
  started that can.
- **Each new string sounds**, with Hear notes on.
- **Letting go** makes it one undo step and leaves the note selected on its new string. Letting go off
  the drawing, or the browser taking the pointer, puts the note back.
- **Only the pressed note moves**, even inside a selection or a chord: moving several notes string by
  string would collide with each other. The press clears a selection anyway, as any press on a note does.
- Shift+press on a note still extends the selection; it doesn't drag.

## Code

`staffEntry.ts`: `noteToString` (pure: a note to a given string at the same pitch, or null), which
`moveToString` (Ctrl/⌘+↑ ↓) now uses too. `hitTest.ts`: `FretDrag`. `TabClip.tsx`: `onDragFret`, the
press on a fret number and the string under the pointer. `TabPage.tsx`: `onDragFret` previews the
move while dragging and commits it on letting go; it is only passed outside note input.
