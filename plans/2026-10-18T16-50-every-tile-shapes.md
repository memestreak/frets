# Every tile's shapes, and Open in Chords

Jeremy, 2026-10-18. Spec: `docs/specs/2026-10-18-every-tile-shapes-design.md`.

1. Mocks A–D behind `?mock=` on a branch preview; Jeremy picked D (menu
   only). Drop the mock code and its CSS.
2. `git mv src/features/chords/export src/components/chords/export`;
   repoint `ChordsPage`, `VoicingGroups` and `export.test.tsx`.
3. `useShapeExport`: `triggerProps` takes `items`, shown above the export
   items; the menu is named "Shape".
4. `ScaleLab.pickShape(chordIndex, index)`; `DiatonicChords` passes it on.
5. `PositionShapes`: the stepper on every tile, named for its chord; the
   menu on each shape with Open in Chords; the library line becomes the
   hint.
6. `ScaleLab.test.tsx`: mock `next/navigation`; stepping an unselected
   tile; the menu's items and the URL it pushes.
7. Update the two older specs' lines and CLAUDE.md; check in the browser
   that nothing shifts.
