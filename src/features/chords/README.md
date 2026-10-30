# Chords page (`src/features/chords/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/features/chords/` — the Chords page (`ChordsPage.tsx`, the only
  stateful component, with its client-only loader), built on
  `src/lib/chords/` and `src/components/chords/`. The frets on the neck are
  the source of truth: picking a chord in `ChordPickers` puts its first
  shape there and keeps that chord, tapping names the notes afresh
  (`src/lib/theory/chordNames.ts`, every name for a set of notes, listed by `NameList`).
  `ChordPickers` also swaps the Type dropdown for a search box (the
  magnifier, or `/`); `src/lib/theory/chordSearch.ts` reads the name typed there.
  `ChordHeader.tsx`, `VoicingGroups.tsx`, `VoicingStepper.tsx`
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
