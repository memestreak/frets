# Chord arpeggio on the neck

Jeremy, 2026-10-06: the Chord library should be able to show the chord's
arpeggio on the fretboard. Of four mocked options
(https://claude.ai/artifact/8bbHSxEMmmuv43vXoV7qCE) he picked **A, the
whole neck**, with no position box for now, turned on by a toggle button.

## What it shows

Jeremy, 2026-10-06, after trying the first build (the chosen shape solid,
the rest of the arpeggio faint): the Arpeggio button is picked as if it
were one more shape.

- An **Arpeggio** button (`ToggleButton`, `aria-pressed`) sits on the neck
  card, on the same line as the ‹ › shape stepper, pushed to the right; on
  a phone it wraps below the stepper.
- Pressing it clears the chosen shape: no diagram is selected, and the
  neck shows every chord tone from the nut to fret 15 at full strength,
  with the shape's look (degree colour, interval label, square root).
- Jeremy, 2026-10-09: pressing it again, or pressing **space**, turns it
  off and brings back the shape that was chosen before, so space flips
  between the shape and its arpeggio. The chosen shape is remembered while
  the arpeggio is on. With no shape chosen (the arpeggio was on when the
  chord changed), turning it off shows the first shape.
- Space works wherever focus is on the page, including on a shape diagram
  just clicked (which is not clicked again) and on the Arpeggio button
  (which toggles once). It doesn't scroll the page, and holding it toggles
  once. Space keeps its usual job in the Root and Type menus and in the
  site's nav and footer.
- The stepper caption reads "Arpeggio · every A, C, E and G up to fret 15";
  ‹ is disabled, and › or → choose the first shape.
- Choosing a shape (tapping a diagram, ‹ ›, ← →) turns the arpeggio off.
- Every tone of the chord's spelling is shown, including tones a shape may
  leave out (the 5 of a 9 chord).
- The arpeggio stays picked when another chord is chosen. It is not saved
  and not in the URL (the library keeps no state).

Not in this slice: a position box (option D), a playing order (option C),
note-name labels, the Chord lab.

## Parts

- `positionsOnNeck(rootPc, semis, maxFret)` in `src/lib/music.ts`: every
  string and fret whose note is one of those intervals above the root. The
  Scale lab's `neckNotes` now uses it too.
- `arpeggioDots(chord, voicing, maxFret)` in `features/chords/chordDots.ts`
  turns those positions into `Fretboard` dots; it shares `toneDot` with
  `voicingDots`.
- `useSpaceKey(onPress)` in `features/chords/library/useSpaceKey.ts`:
  space anywhere but a field, the nav or the footer calls `onPress`, with
  the key's default (scroll, button click on keyup) prevented.
- `ChordLibraryPage` holds the switch (above the per-chord key, so it
  survives a chord change) and passes it to `ChordLibrary`.
