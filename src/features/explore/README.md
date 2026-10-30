# Explore: Scale lab, Triads, Circle of fifths (`src/features/explore/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/features/explore/` — the Scale lab (`scales/`), Triads
  (`triads/`: `triads.ts` finds every grip of a triad on a string set,
  `Triads.tsx` draws them with `Fretboard`'s `links`), the Circle of
  fifths (`circle/`) and their client-only loaders. Their music theory
  (scales, modes, diatonic chords and numerals, keys) is the shared core in
  `src/lib/theory/`; `scales/neckNotes.ts` puts a scale's or a chord's notes
  on the neck. `settings.ts` holds the saved
  settings and their parser; `ScaleLab.tsx` and `ScalePanel.tsx` draw the
  page. `DiatonicChords.tsx` is the one "Diatonic chords" card
  (`docs/specs/2026-10-13-one-diatonic-chords-card-design.md`): Triads /
  Sevenths, the Arpeggio toggle, the position's ‹ › and its two halves.
  `PositionShapes.tsx` (logic in `positions.ts`) draws every diatonic
  chord's shape in the same five frets, the only chord row, with ‹ n of m ›
  under every tile to cycle its chord's shapes, selected or not, and the
  shapes' export menu with Open in Chords on top.
  `ChordOverScale.tsx` places `ChordLadder.tsx` / `ChordClock.tsx`
  (shared parts in `chordDiagram.tsx`), which draw a selected chord against
  the scale (`docs/specs/2026-10-04-chord-diagrams-design.md`). Selecting a
  chord must move nothing. With a chord selected, a click on anything but a
  control, or Esc, goes back to the scale.
  `circle/` is the Circle of fifths, its Circle (keys) and Advanced (modes)
  views on one wheel:
  `circle.ts` (pure: spokes, cells, and the
  `keyWheel` / `modeWheel` models saying what every cell, ring note, chip
  and tip shows; keys, modes, numerals and spelling from `src/lib/theory/`,
  where a mode is spelled from its parent key, `parentKey`), `CircleWheel.tsx` (draws a model, with the
  ring of notes round it; knows no theory), `KeyPanel.tsx` / `ModePanel.tsx` (the Parallel modes chord
  table) and the page,
  `CircleOfFifths.tsx`. Only the view is in the URL; nothing is saved.
