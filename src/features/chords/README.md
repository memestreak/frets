# Chords page (`src/features/chords/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/features/chords/` — the Chords page (`ChordsPage.tsx`, the only
  stateful component, with its client-only loader in `ChordsLoaders.tsx`;
  `neckSettings.ts` holds the neck's saved dot labels and their parser), built on
  `src/lib/chords/` and `src/components/chords/`. The frets on the neck are
  the source of truth: picking a chord in `ChordPickers` puts its first
  shape there and keeps that chord, tapping names the notes afresh
  (`src/lib/theory/chordNames.ts`, every name for a set of notes, listed by `NameList`).
  `ChordPickers` also swaps the Type dropdown for a search box (the
  magnifier, or `/`); `src/lib/theory/chordSearch.ts` reads the name typed there.
  `ChordHeader.tsx`, `ShapeGroups.tsx`, `ShapeMover.tsx`
  are its parts (space toggles the Arpeggio, `src/hooks/useSpaceKey.ts`); it also
  uses `src/components/chords/export/`, shared with the Scale lab:
  right-click, a long press or Shift+F10 on a shape diagram (or the
  neck; `useShapeExport`, once per page) opens a menu
  (the page's own items, then Copy as PNG, Export options…) and the Export dialog, whose Name
  starts on the deduced name; with a mouse a shape diagram (not the neck)
  also drags out as that PNG, drawn on hover; the image is
  `ChordDiagram` drawn with a concrete `look` (`exportStyle.ts`, whose
  palettes a test checks against `fretwood.css`), serialized and rasterized
  in `exportImage.ts`. The chord and the frets are in the URL, not storage:
  `/chords?chord=am7b5&shape=x-0-1-0-1-x` (either may be left out); a pick
  in the menus adds a history entry, everything else replaces it; slugs in
  `src/lib/chords/chordUrls.ts`.
- `chords.css` — the page's CSS, imported from `src/app/globals.css`; the shapes' own (`.shape-btn`, the export menu and dialog) stay in `globals.css`, shared with the Scale lab and the Tab page.

## Specs

- `docs/specs/2026-10-30-music-theory-core-design.md`: all music theory moves
  into src/lib/theory/, the only tonal importer
- `docs/specs/2026-10-19-chords-header-design.md`: the Chords header follows
  the Scale lab's, labelled from the top
- `docs/specs/2026-10-18-bass-outside-chord-design.md`: a chord over a bass
  outside it gets a slash name
- `docs/specs/2026-10-17-move-shape-design.md`: ‹ › slide the shape along the
  neck; ← → still step through shapes
- `docs/specs/2026-10-17-export-size-design.md`: the Export dialog picks the
  image's size and transparency
- `docs/specs/2026-10-17-chord-neck-labels-design.md`: the Chords neck gets
  Dot labels: Interval, Note or None
- `docs/specs/2026-10-17-add11-chords-design.md`: added-eleventh chord types,
  so such shapes get a name
- `docs/specs/2026-10-16-key-picker-design.md`: the root picker becomes a row
  of tiles laid out like piano keys
- `docs/specs/2026-10-16-chord-search-design.md`: a typed or pasted chord name
  picks the chord
- `docs/specs/2026-10-16-chord-diagram-fret-label-design.md`: every small
  shape diagram labels its starting fret
- `docs/specs/2026-10-15-one-chords-page-design.md`: the Chord library and
  Chord lab become one Chords page; frets in the URL
- `docs/specs/2026-10-15-copy-chord-diagram-design.md`: a right-click menu and
  Export dialog copy a shape diagram as an image
- `docs/specs/2026-10-09-published-chord-shapes-design.md`: published shapes
  (Haus of Chords) come before searched ones
- `docs/specs/2026-10-09-chord-lab-arpeggio-design.md`: the Chord lab loses
  Build it and gains the Arpeggio toggle
- `docs/specs/2026-10-06-simpler-chord-diagrams-design.md`: small shape
  diagrams show colour without labels
- `docs/specs/2026-10-06-chord-arpeggio-design.md`: a toggle shows the chord's
  arpeggio over the whole neck
- `docs/specs/2026-10-05-chord-library-design.md`: the Chord library: pick a
  chord, see its shapes (now part of the Chords page)
- `docs/specs/2026-10-05-chord-lab-design.md`: the Chord lab: tap notes and
  get their names (now part of the Chords page)

## Decisions

- `docs/adr/2026-11-02-one-theory-core.md`: all theory in src/lib/theory/, the
  only tonal importer
