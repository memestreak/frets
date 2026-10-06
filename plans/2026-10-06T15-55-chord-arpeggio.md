# Chord arpeggio on the neck

Jeremy, 2026-10-06: option A (whole neck, no box), behind a toggle button.

1. `positionsOnNeck` in `src/lib/music.ts`; `neckNotes` in the Scale lab
   built on it.
2. `toneDot`, `arpeggioDots` and `ARPEGGIO_FADE` in `chordDots.ts`.
3. `ChordLibraryPage` owns the switch; `ChordLibrary` draws the
   Arpeggio `ToggleButton` next to the stepper and picks the dots.
4. Tests: `positionsOnNeck`; library toggle (34 dots for Am7, shape at full
   strength, stays on for the next chord, off again shows the shape only).
5. Lint, typecheck, test, build; screenshots in
   /mnt/project-files/chords/arpeggio/.
6. Spec, CLAUDE.md.
