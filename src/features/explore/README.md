# Explore: Scale lab, Triads, Circle of fifths (`src/features/explore/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/features/explore/` — the Scale lab (`scales/`), Triads
  (`triads/`: `triads.ts` finds every grip of a triad on a string set,
  `Triads.tsx` draws them with `Fretboard`'s `links`), the Circle of
  fifths (`circle/`) and their client-only loaders (`ExploreLoaders.tsx`). Their music theory
  (scales, modes, diatonic chords and numerals, keys) is the shared core in
  `src/lib/theory/`; `scales/neckNotes.ts` puts a scale's or a chord's notes
  on the neck. `settings.ts` holds the saved
  settings and their parser; `ScaleLab.tsx` and `ScalePanel.tsx` draw the
  page, and `StripTip.tsx` is the tooltip naming what tapping a note on the
  scale strip gives. `DiatonicChords.tsx` is the one "Diatonic chords" card
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
  table; both built from `ChordChips.tsx`, the chord chips and titled sections
  under the wheel) and the page,
  `CircleOfFifths.tsx`. Only the view is in the URL; nothing is saved.
- `explore.css` — the CSS of all three pages, imported from `src/app/globals.css`.

## Specs

- `docs/specs/2026-10-30-music-theory-core-design.md`: all music theory moves
  into src/lib/theory/, the only tonal importer
- `docs/specs/2026-10-19-scale-lab-header-design.md`: the Scale lab's root
  picker and Scale dropdown sit in the strip's row
- `docs/specs/2026-10-18-triads-design.md`: the Triads page: every Grip of a
  triad on a string set, all inversions
- `docs/specs/2026-10-18-every-tile-shapes-design.md`: every diatonic tile
  cycles its shapes; Open in Chords from the menu
- `docs/specs/2026-10-16-steady-ladder-design.md`: selecting a chord no longer
  moves the Ladder's notes
- `docs/specs/2026-10-16-key-picker-design.md`: the root picker becomes a row
  of tiles laid out like piano keys
- `docs/specs/2026-10-16-chord-diagram-fret-label-design.md`: every small
  shape diagram labels its starting fret
- `docs/specs/2026-10-13-one-diatonic-chords-card-design.md`: one Diatonic
  chords card: Triads / Sevenths, the Arpeggio, the Position
- `docs/specs/2026-10-07-scale-lab-position-shapes-design.md`: the diatonic
  chords as shapes in one Position, each tile cycling its shapes
- `docs/specs/2026-10-07-circle-of-fifths-design.md`: the Circle of fifths:
  the Key wheel and Modes on one page
- `docs/specs/2026-10-04-scale-lab-design.md`: the Scale lab's first slice: a
  scale on the neck and its diatonic chords
- `docs/specs/2026-10-04-chord-diagrams-design.md`: the Scale lab draws a
  selected chord against the scale (Ladder, Clock)

## Decisions

- `docs/adr/2026-11-02-spec-over-prototype.md`: the spec wins; Fretwood sets
  the look
- `docs/adr/2026-11-02-one-theory-core.md`: all theory in src/lib/theory/, the
  only tonal importer
