# Scale lab: chord shapes in one position

Jeremy, 2026-10-06/07, thread "Chord diagrams in the Scale lab": show
the diatonic chords as guitar shapes, all playable in the same fret range.
Mockups: round 1 (layouts)
https://claude.ai/artifact/TxWKy1hRwdux9MtzGZ8G3q, round 2 (arpeggio
styles) https://claude.ai/artifact/TU58s2u1dePsh1gsrhoyka, round 3
(cycling) https://claude.ai/artifact/VoTxA8Bcg7zTAfYEF5JsRg.

## Decisions

- **Layout (option B):** a new "In one position" card between the neck
  and "Chords in this scale". The chord cards and Ladder | Clock stay.
- **Position:** five frets, the generator's widest stretch (`MAX_SPAN`
  + 1). With five frets every diatonic chord of the major, melodic minor
  and harmonic minor families had a shape in every position checked; four
  frets lost one to four chords per position. Positions run from 1 (the
  open strings plus frets 1–5, shown "Open–5") to 11 (frets 11–15). ‹ ›
  in the card header step one fret. The neck outlines the position. Saved
  in `frets.explore.scales` as `position`, default 5.
- **Diagrams:** the Chord library's `ChordDiagram`, every one starting at
  the position's first fret, so the row reads as one hand position. Each
  tile shows the shape, the numeral and the symbol, in the chord cards'
  order (Rotate mode included). A `ToneKey` above them names the colours
  (the selected chord's tones, else the tonic chord's).
- **Which shapes:** `shapesInPosition`: the library's core shapes (open
  shapes and the best few moveable ones) that fit in the position,
  easiest first. When none fits, the easiest of every shape that does, so
  a chord shows a shape wherever it has one. A chord with none shows
  "None here". The generator finds 1 to 17 shapes per chord per position;
  core shapes are usually one to three.
- **Selection:** tapping a tile selects its chord, the same selection as
  the chord cards (← → step chords as before). The neck then shows only
  that shape's notes. Before, a selected chord showed all its tones.
- **Cycling (round 3, option 1):** a selected chord with more than one
  shape shows "‹ 2 of 3 ›" under its tile; other tiles say "3 shapes".
  ↑ and ↓ do the same. Each chord keeps its pick while the scale, chord
  size and position stay; changing any of them starts again at shape 1.
- **Arpeggio:** a toggle button in the card header, disabled with no
  chord. On, the neck shows every chord tone up to fret 15 in its degree
  colour; only the shape's notes carry labels (Jeremy's correction in
  round 3: colour on every dot, no labels on the extra ones). It stays on
  across chords and positions, goes off when the chord is cleared, and is
  not saved.
- **Library link (option 1):** under the tiles, "Am7 in the Chord library
  →" for the selected chord opens `/chords/library?chord=am7&shape=…` on
  the same shape. The library reads the new `shape` parameter (a
  `voicingKey`); a shape outside the best few opens with every shape
  listed, and an unknown one opens on the first shape. Chords the scale
  spells differently from the library (E♯m7♭5) open under the library's
  spelling (Fm7♭5). A chord with no chord type gets no link.
- **Going back to the scale:** with a chord selected, a click on anything
  that isn't a control (button, link, field, label, dialog) clears it, as
  does Esc. Tapping the selected card or tile again still clears it too.

## Not in this slice

Tapping the neck to move the position, jumping between named (CAGED)
positions, inversions, and saving the selected chord.

## Parts

- `src/lib/chords/` and `src/components/chords/`: the chord code both
  sections now use moved out of `features/chords/` (`chordTypes`,
  `voicings`, `chordUrls`; `ChordDiagram`, `ToneKey`, `chordDots`).
- `voicings.ts`: `POSITION_FRETS`, `LAST_POSITION`, `shapesInPosition`.
- `ChordDiagram`: optional `startFret`.
- `Fretboard`: optional `box` outlining a fret range.
- `features/explore/scales/positions.ts`: `chordInfoOf` (a diatonic chord
  as a `ChordInfo` via `chordFromTones`), `chordsInPosition`,
  `positionLabel`, `libraryHref`.
- `PositionShapes.tsx`: the card; `ScaleLab.tsx` owns the position,
  shape picks, arpeggio and the click-away / Esc listener.
