# Moving notes up and down on the staff

Issue #174, after staff pitch entry (`2026-10-27-tab-staff-entry-design.md`). Jeremy's answers,
2026-10-28.

## The rule

Plain arrows move a cursor; **Alt** carries the note; **Shift** counts semitones instead of lines and
spaces; **⌘** (Ctrl off the Mac) takes the whole chord. A drag of a head is the same move with the
pointer.

## Dragging a head

- Press a note head on the staff (Staff or Both) and drag up or down. The head follows the pointer a
  line or space in the bar's key at a time (E, F♯, G in G major), showing its ♯, ♭ or ♮ when the key
  doesn't give it.
- Holding Shift while dragging moves it a semitone for each line or space the pointer goes instead, so
  the head and the pointer drift apart.
- Only the head pressed moves, unless:
  - it is inside a selection: every note of the selected columns moves together;
  - ⌘ or Ctrl is held: every note of its column (the chord) moves together.
- Each new pitch sounds while dragging, alone, when "Hear notes as you enter them" is on (the note
  toggle after Loop); otherwise the drag is silent.
- Letting go makes the whole drag one undo step. The staff cursor stays on the moved note; a dragged
  selection stays selected. A press on a head that doesn't move is the press it was before: the staff
  cursor goes to that note (with Shift, the selection grows), when the pointer lets go.
- Where a note can't go (off the neck, or no free string), the drag stays at the last place that
  worked.

## Keys on the staff

- **↑ / ↓** move the staff cursor a line or space, as before; **Shift+↑ / ↓** a semitone (**#** and
  **b** still do too).
- **Alt+↑ / ↓** move the note at the staff cursor a line or space, and the cursor goes with it;
  **Alt+Shift+↑ / ↓** a semitone. Adding **⌘ / Ctrl** moves the whole chord.
- With a selection (and the staff shown), **Alt+↑ / ↓** move every selected note, with Shift a
  semitone; the selection stays. With the tab alone there is no staff to move them on, and the keys do
  nothing.
- On some Linux desktops Ctrl+Alt+↑ / ↓ switch workspaces and never reach the page.

## Keys on the tab

- **Alt+↑ / ↓** move the note at the tab cursor to the next string up or down that plays the same
  pitch, skipping strings the column uses, keeping its marks (this was Alt+↑ / ↓ on the staff).

## Which string a moved note takes

A moved note stays on its string while that string can play the new pitch (open to the 24th fret), so
a chord keeps its shape. A note off the end of its string goes to a free string, picked as staff entry
picks one, aiming at the fret it was on (the highest such note first). When any note can't be placed,
nothing moves and the line under the clip says "No free string can play that note here." Notes keep
their marks; ties, hammer-ons and slides are made true again as after any edit.

## Later

A `?` panel listing the keyboard shortcuts is issue #180.
