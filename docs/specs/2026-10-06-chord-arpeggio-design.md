# Chord arpeggio on the neck

Jeremy, 2026-10-06: the Chord library should be able to show the chord's
arpeggio on the fretboard. Of four mocked options
(https://claude.ai/artifact/8bbHSxEMmmuv43vXoV7qCE) he picked **A, the
whole neck**, with no position box for now, turned on by a toggle button.

## What it shows

- An **Arpeggio** toggle button (`ToggleButton`, `aria-pressed`) sits on
  the neck card, on the same line as the ‹ › shape stepper, pushed to the
  right; on a phone it wraps below the stepper.
- Off (the default): the neck shows only the chosen shape, as before.
- On: every chord tone from the nut to fret 15. The chosen shape's notes
  are at full strength and drawn last, so they sit on top; every other
  chord tone is drawn faint (`ARPEGGIO_FADE`, 0.32 opacity). Dots keep the
  shape's look: degree colour, interval label, square root.
- Every tone of the chord's spelling is shown, including tones a shape may
  leave out (the 5 of a 9 chord). With no playable shape, every tone is at
  full strength.
- Stepping or tapping shapes moves the full-strength notes; the faint map
  stays the same.
- The switch stays on when another chord is picked. It is not saved and
  not in the URL (the library keeps no state).

Not in this slice: a position box around the shape (option D), a playing
order (option C), note-name labels, the Chord lab.

## Parts

- `positionsOnNeck(rootPc, semis, maxFret)` in `src/lib/music.ts`: every
  string and fret whose note is one of those intervals above the root. The
  Scale lab's `neckNotes` now uses it too.
- `arpeggioDots(chord, voicing, maxFret)` in `features/chords/chordDots.ts`
  turns those positions into `Fretboard` dots; it shares `toneDot` with
  `voicingDots`.
- `ChordLibraryPage` holds the switch (above the per-chord key, so it
  survives a chord change) and passes it to `ChordLibrary`.
