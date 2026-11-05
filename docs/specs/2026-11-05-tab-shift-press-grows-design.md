# A Shift+press grows the selection

Issue [#366](https://github.com/memestreak/frets/issues/366). Jeremy, 2026-11-05: "If I have a selection,
a shift click outside of that selection should only ever grow the selection to include up to the new
content I've clicked on", and "shift click in the selection should trim the selection from the end
closest to where the click came from."

## Why

A Shift+press made the selection run from its anchor (where Shift+arrows started, or a picked bar's
first column) to the column pressed. When the anchor was the far end, a press past the near end dropped
part of the selection, so a Shift+press seemed to shrink or move it at random.

## What

- **Outside the selection**, a Shift+press grows it to take in what was pressed: a press before it moves
  its start there, a press after it moves its end there. The other end stays, whichever way the
  selection was made.
- **Inside the selection**, it is trimmed from the end nearer the press, which comes to the column
  pressed. Halfway between the ends, the end last grown (the focus) moves. A press on an end changes
  nothing.
- **With only the cursor**, it selects from the cursor's column to the press, as before.
- The end that moved becomes the focus, so Shift+arrows go on from it.
- The same rule holds wherever the press lands: a tab note or a blank string, a staff head or a line or
  space, a rest or a stem under the tab, and the gap above or below the drawing (the column beside the
  gap: the one before it when the gap is after the selection). A rest is taken in whole: every rest of a
  Whole-bar rest, every bar of a multi-bar rest.
- A selection covers whole columns of the Active voice, so the string pressed and the line it is on
  make no difference.
- Unchanged: a Shift+press from the playback line still selects from the line; a Shift+drag from blank
  space still draws a rectangle.

How others do it (not checked in the apps; their manuals don't say): MuseScore grows a range selection
to a Shift+click outside it, as remembered from its source (`Score::selectRange`); Dorico's manual and
forum describe Shift+click as selecting from the first item selected to the one clicked, which can
shrink; Guitar Pro 8's manual doesn't describe Shift+click.

## How

`growSelection` in `editing.ts` (pure) gives the new selection from the old one, the cursor's column and
the columns pressed. `useTabPicking` calls it for a press on the tab, the staff and a rest; `TabPage`'s
`pickColumn` for a gap.

## Tests

- After a selection made leftwards (2–4, anchor on 4), a Shift+press on 6 selects 2–6, not 4–6; then
  Shift+→ selects 2–7.
- Before a selection made rightwards (10–12), a Shift+press on 2 selects 2–12, not 2–10.
- A bar picked by a press beside its notes grows to a Shift+press in the bar before (1–8) and after.
- Grown after, then before, then after again: nothing selected is lost.
- A Shift+press on another string, a note or a blank one, grows the same.
- Across lines of the clip, both ways.
- Inside 2–8, a Shift+press on 6 selects 2–6 (nearer the end); then on 3, 3–6 (nearer the start).
- Halfway, the focus moves: grown rightwards, the end; grown leftwards, the start.
- On a press on an end of the selection, nothing changes.
- With only the cursor on 7, a Shift+press on 3 selects 3–7.
- On the staff, the same as on the tab.
- A Shift+press on a Whole-bar rest takes in its bar; on a rest in an earlier bar, it and everything to
  the selection.
- A Shift+press above the drawing, at the gap after 7, grows 2–4 (made leftwards) to 2–7.
- In Voice 2, a Shift+press on a Voice 2 note grows the selection in Voice 2.
- With a pressed span reaching past both ends, the selection takes it all in.
