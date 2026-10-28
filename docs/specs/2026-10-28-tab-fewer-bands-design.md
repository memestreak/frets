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
- **The column cursor** (no string picked: Esc on a string, or a press
  above or below the staff with the playback controls hidden) was the band
  alone; it is now one `--primary` box, no fill, round the column's six
  strings. When the staff's cursor has the keys it already shows the
  column, so the tab draws nothing more.
- **Selections** keep their band: Shift+← →, Ctrl+A and Shift+press
  (on the tab, the staff, or above or below it) still select a run of
  columns, drawn as one unbroken band per line.
- **Moving the cursor lets go** (Jeremy, 2026-10-28: "Moving the cursor
  should deselect any selected notes or annotations"): a plain press, ← →,
  ↑ ↓ (which kept the selection before), and on the staff ↑ ↓, # and b
  drop any selection and any picked chord name, text, section, tempo, capo
  or mark. Edits that keep the cursor where it is (Alt+↑ ↓ moving a note
  to another string, Enter on the staff, the palette) leave the selection,
  so they still work on it.

## Reading

"Clicking … shouldn't highlight the region" is read as the plain press,
whose cursor used to draw a band. Shift+press is kept as a way to select,
alongside Shift+arrows, since it is the same gesture as in a text editor;
dropping it is a one-line change if wanted.
