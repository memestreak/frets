# Chords: published shapes first

Jeremy, 2026-10-09, picked option D of the shape audit: build our chord
shape data from Haus of Chords. Spec:
`docs/specs/2026-10-09-published-chord-shapes-design.md`.

1. `scripts/import-haus-of-chords.py`: TOML → `src/lib/chords/data/haus-of-chords.json`
   (shapes as "x-3-2-0-1-0", source counts, commit). README with the
   licence and the changes.
2. `src/lib/chords/publishedShapes.ts`: open shapes for the root, moveable
   shapes slid from C, `dropMuteVariants`.
3. `voicings.ts`: `findVoicings` puts published shapes first and merges
   them into Show all; the search moves into `searchVoicings`, with the
   finger, doubling, best-few and open-order fixes; `shapesInPosition`
   also tries moveable shapes an octave up.
4. Credit in `AppFooter`.
5. Tests: `publishedShapes.test.ts`, new `voicings.test.ts` cases, and
   the Scale lab tests whose shapes changed (D7 and Am7 at fret 5).
6. CLAUDE.md layout; the library spec points at the new spec.
