# Scale lab: chord shapes in one position

Spec: docs/specs/2026-10-07-scale-lab-position-shapes-design.md.

1. Move the chord code the Scale lab needs into `src/lib/chords/`
   (chordTypes, voicings, chordUrls) and `src/components/chords/`
   (ChordDiagram, ToneKey, chordDots); fix imports.
2. `voicings.ts`: `POSITION_FRETS`, `LAST_POSITION`, `shapesInPosition`.
3. `ChordDiagram` `startFret`; `Fretboard` `box`; `ToggleButton` `disabled`.
4. `chordHref(choice, shape)` and `SHAPE_PARAM`; the library opens on a
   linked shape, listing every shape when it is outside the best few.
5. Scale lab: `position` setting; `positions.ts`; `PositionShapes` card
   (tiles, ‹ › position, ‹ n of m ›, ↑ ↓, Arpeggio, library link); neck
   dots (shape only, or arpeggio with labels on the shape); click-away and
   Esc clear the chord.
6. Tests: settings, `shapesInPosition`, chord URLs, library shape link,
   Scale lab card, cycling, arpeggio, click-away.
7. Lint, typecheck, test, build; screenshots in
   /mnt/project-files/scale-lab/position-shapes/.
8. CLAUDE.md.
