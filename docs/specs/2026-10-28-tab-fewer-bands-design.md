# Tab: fewer highlighted bands

Jeremy, 2026-10-28: "reduce the use of highlighted regions in our staves
and tabs. Playback should never highlight a region as it's playing back.
Clicking on the staff or tab shouldn't highlight the region. We should
still be able to create regions with shift arrow."

## What changes

- **Playback** draws only the gliding playhead line (issue #167). The soft
  band that sat behind the sounding column is gone. The loop bracket and
  the playback line placed by a press above or below the staff stay.
- **The cursor** has no band behind its column. A press on the tab, or ←
  →, shows only the `--primary` box round the cursor's string; a press on
  the staff shows the staff's own cursor (the outlined head), and the tab
  boxes the string of a note at that pitch, as before.
- **The column cursor** (no string picked: a press above or below the
  staff with the playback controls hidden, or ← → ending a selection) was the band
  alone; it is now one `--primary` box, no fill, round the column's six
  strings. When the staff's cursor has the keys it already shows the
  column, so the tab draws nothing more.
- **Selections** keep their band: Shift+← →, Ctrl+A and Shift+press
  (on the tab, the staff, or above or below it) still select a run of
  columns, drawn as one unbroken band per line.
  Starting a run lets go of the note the cursor was on (Jeremy,
  2026-10-28: "the highlighted note shouldn't be hidden. It should be
  deselected"): no string stays picked and the staff's cursor goes,
  so only the band shows. Esc on a run drops it and leaves the
  tab, as a press beside the bars does, so nothing stays drawn (Jeremy,
  2026-10-28: no box round a column after Esc). Esc on a note, on the
  tab or the staff, leaves the tab the same way; it no longer stops at
  the column first (Jeremy, 2026-10-28). When ← → end the run, the
  cursor is on its column with no string, drawn as the column's box; ↑ ↓ or a press pick a string again. With the staff alone
  its cursor comes back on the middle line.
- **Moving the cursor lets go** (Jeremy, 2026-10-28: "Moving the cursor
  should deselect any selected notes or annotations"): a plain press, ← →,
  ↑ ↓ (which kept the selection before), and on the staff ↑ ↓, # and b
  drop any selection and any picked chord name, text, section, tempo, capo
  or mark. Edits that keep the cursor where it is (Alt+↑ ↓ moving a note
  to another string, Enter on the staff, the palette) leave the selection,
  so they still work on it.
- **Placing the playback line lets go of the tab** (Jeremy, 2026-10-28:
  "I selected a fret, then I placed the play cursor, and the fret remained
  selected"): a press above or below the staff takes the keys from the tab,
  as a press beside the bars does, so the string's box goes and the arrow
  keys move the line. Leaving fills the cursor's bar as usual (not while
  playing, as an edit stops playback), and a line past that bar moves on by
  the rests added, so it stays before the same note. Shift+press still
  selects from the cursor.

## Reading

"Clicking … shouldn't highlight the region" is read as the plain press,
whose cursor used to draw a band. Shift+press is kept as a way to select,
alongside Shift+arrows, since it is the same gesture as in a text editor;
dropping it is a one-line change if wanted.

## Pressing low notes in Both

The gap between the staff and the tab is left to the playback line, and a
press there reached the staff only one ledger line down, so a head drawn
lower (the open low E, on three ledger lines) couldn't be pressed (Jeremy,
2026-10-28). A drawn head is now pressed wherever it is, before that limit
is checked; the blank space round it still places the playback line.
