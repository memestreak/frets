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
  Pressing it again changes nothing, like tapping the chosen shape.
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
- `ChordLibraryPage` holds the switch (above the per-chord key, so it
  survives a chord change) and passes it to `ChordLibrary`.
