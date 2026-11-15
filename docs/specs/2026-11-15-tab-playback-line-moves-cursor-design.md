# Tab: the playback line moves the cursor

Jeremy, 2026-11-15, after Insert mode (issue #482, phase 2,
`2026-11-14-tab-insert-mode-design.md`). He asked whether moving the
playhead moves the cursor. It didn't: the line stood on its own, and a
paste went to the cursor, wherever the tab had last left it. "Yes, I want
the playhead to act like, and move, the cursor. In Insert Mode, if you can
see the playhead, you should also see the blue arrow."

Words, from `GLOSSARY.md`: Playback line, Cursor, Column, Insert mode,
Insert paste.

## What the person sees

- **Wherever the playback line goes, the cursor goes with it**, to the
  Column just after the line, on the string it was on. That covers a press
  above or below the staff, ← → off the tab, Esc with a selection (the line
  after its last Column), a Delete from the line, and Play stopping at the
  playhead. The line past the clip's last Column puts the cursor on the
  last Column.
- The tab still lets the keys go when the line is placed, so the string's
  box isn't drawn. When the tab takes the keys again (a press on the tab,
  or Tab), the cursor is where the line was, and N, a digit, or a length
  act there.
- **A paste goes in at the line** while the line shows and the tab doesn't
  have the keys, in Overwrite and in Insert mode. With the line past the
  last Column, the paste goes on the end.
- **In Insert mode the line has the cursor's ▼ ▲ notches**, in the
  selection colour, one above the band and one below, so the line says
  where the next entry or paste goes, as the cursor does. Out of Insert
  mode it has none. When the tab takes the keys again, the line goes and
  the notches are back on the cursor.
- **The cursor's notches stand where the line would**: in the gap just
  before the cursor's Column, not over the middle of its note (Jeremy,
  2026-11-15). The insert point looks the same from the cursor and from
  the line.
- An open panel, menu or dialog takes Esc first: Esc closes it and leaves
  the selection and the line as they were. Before, an Esc that reached the
  page while the Tuplet panel was open could also let a selection go.

## Reading

"Act like the cursor" is read as: the line and the cursor are one place
while the line shows, so whatever the keys, a paste or Insert mode do at
the cursor, they do at the line. The cursor isn't drawn while the line
shows, so the page shows one place, not two.

## Tests

- A press above Column 2 of `5.1.4 7.1.4 5.1.4 7.1.4 |`, then the tab
  taking the keys and N 9, gives `5.1.4 7.1.4 9.1.4 7.1.4 |`.
- A press above Column 1, then →, then N 9 on the tab: the same.
- A paste of `9.1.4` with the line before Column 2: `5.1.4 7.1.4 9.1.4
  7.1.4 |`. In Insert mode: `5.1.4 7.1.4 9.1.4 5.1.4 |` then `7.1.4 r.4
  r.2 |`.
- In Insert mode, a paste of `9.1.1 |` with the line after the last
  Column adds `9.1.1 |` as bar 2.
- `line-insert-notches` (two notches) shows on the line in Insert mode,
  not out of it, and goes when the tab takes the keys again, the cursor's
  `insert-notches` back.
- The cursor's `insert-notches` are at the same x as the line put before
  its Column.
- The Tuplet panel test: Esc closes the panel and changes nothing (its
  press on the 7 now lands where the quintuplet left it, not beside it,
  which selected the bar).

## How

- `usePlayRange.ts`: `setLine` puts the line at a gap and the cursor on
  the Column after it (`placeOf`); `pickColumn`, `placeLine`,
  `editAtLine` and the stop at the playhead use it.
- `TabPage.tsx`: `putAtCursor` pastes at the line past the end as a new
  bar; the over-layer `Playhead` gets `insert` in Insert mode while the tab
  doesn't have the keys.
- `PlaybackFooter.tsx`: `Playhead` draws `line-insert-notches` when
  `insert` is set; its layer lets them overflow, since the ▲ under the
  last system's band reaches past the drawing's foot.
- `TabClip.tsx`: the cursor's notches at the Column's start (its Grid
  place when it has one).
- `editing.ts`: a cursor one bar past the end counts as a bar line for a
  paste of whole bars.
- `editorKeys.ts`: `lineKeyDown` leaves Esc to an open popup
  (`popupTakesEscape`).

Updated to match: `2026-10-28-tab-fewer-bands-design.md` (placing the line
lets go of the tab), `2026-10-27-tab-playback-options-design.md` (Esc with
a selection) and `2026-11-14-tab-insert-mode-design.md` (the notches).
