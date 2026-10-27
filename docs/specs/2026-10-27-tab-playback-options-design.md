# Tab playback options

Jeremy, 2026-10-27: "I'd like a right click menu on the playback button that
allows me to toggle on and off playback options. Option: Stop leaves cursor at
stop point. Option: Pause for 1 second (customizable duration) between loop end
and loop restart."

## The menu

A right-click (or long press, through the browser's contextmenu) on Play / Stop
opens a small menu where it was pressed, styled like the shapes' menu. Esc, a
press outside, scrolling or resizing closes it. Play's tip says
"Right-click for options".

- **Stop leaves the cursor where it stopped** (a checkbox, off by default).
  On, pressing Stop (button or Space) puts the playback line on the column the
  playhead was on, so the next Play starts there. The editing cursor and
  selection stay as they were. Off, Stop returns the playhead to the cursor as
  before.
- **Pause between loops** (a checkbox, off by default) with a seconds field
  beside it (0.5–10 s, steps of 0.5, default 1; the same number field as
  Speed: type, ↑ ↓, the arrows, or press and drag). On, when the loop reaches
  its end the playhead waits at the loop's start for that long, counted from the
  loop's end, then plays again. The button stays Stop during the rest; Stop or
  a seek ends it.

Both are saved with the other playback settings in `frets.tab.playback`.

## How

`TabPlayer.setLoopPause(seconds)`. With a pause, the synth's own looping is
off but the loop range stays set, so the synth finishes at the range end; on
`finished` the player rests and then moves to the range start and plays.
`SpeedField` became the generic `NumberField`, shared by Speed and the pause.

## Also in this change

- **Speed resets on a double-click** (Jeremy, 2026-10-27): a double-click on
  the Speed label, its number or the bpm beside it puts the speed back to
  100%. Not on the step buttons, so two quick presses still step twice. From
  the keyboard, type 100.
- **The title renames the clip** (Jeremy, 2026-10-27): a click on the page's
  title turns it into a field (`ClipTitle.tsx`); Enter or leaving it keeps
  the text, trimmed, as one undo step; Esc keeps the old title. Empty is
  "Untitled clip". The Export dialog's Name already starts on the clip's
  name, so it follows the title.
- **A press after a note moves the line past it** (Jeremy, 2026-10-27): a
  press above or below the staff puts the playback line on the note pressed
  (within a head's half width, 8 px, right of its centre), else on the first
  note after the press, not the nearest one. Past a bar's last note, the
  next bar's first; past the clip's last, the last (`columnAt`).
- **More room to press above and below** (Jeremy, 2026-10-27: "more
  clickable area above and below the tab and staff to move the cursor"):
  presses up to 16 px above and below the drawn clip, in the card's margin,
  count as presses on the column there (`columnReach` on `TabClip`, a
  transparent rect). In Both, the staff reaches one ledger line down (not
  two) and the tab 6 px up (not 10), so the gap between them moves the
  cursor or the playback line too.
- **Moving the playhead lets the selection go** (Jeremy, 2026-10-27): a
  press above or below the staff while playing jumps the playhead there and
  clears the selection, as it already did while stopped. Loop points stay.

## Transpose

Jeremy, 2026-10-27: "allows me in the playback menu to transpose playback by
a specified number of semitones", and "double click on the label or widget
should reset it".

- A third row in the menu: "Transpose" and a number field, −12 to +12
  semitones in steps of 1 (a plus sign shown above 0), starting at 0. Not a
  toggle: 0 plays as written. Saved as `transpose` in `frets.tab.playback`.
- A double-click on its label or its number puts it back to 0 (not on the
  step buttons), as Speed's does to 100% (`resetOnDoubleClick` in
  `NumberField.tsx`).
- Only what is heard moves: the tab, the staff and every export stay as
  written. It applies at once, to notes already sounding, and to notes heard
  as they are entered. It is the synthesizer's own transposition
  (`applyTranspositionPitches`) on every channel but General MIDI's drums.
