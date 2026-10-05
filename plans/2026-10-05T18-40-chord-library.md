# Chord library

Spec: `docs/specs/2026-10-05-chord-library-design.md`.

1. Move `prettyNote` to `src/lib/notation.ts` and `DEGREES` to
   `components/fretboard/theme.ts`; update the Scale lab's imports.
2. `src/features/chords/chordTypes.ts`: roots, tonal's chord types with
   groups and symbols, `chordOf`. Tests in `src/__tests__/chords/`.
3. `src/features/chords/voicings.ts`: the search, port of the mock's
   `chordTheory.js` with per-string pruning (only chord tones in the
   window) so a chord takes milliseconds. Tests.
4. Components: `ChordDiagram`, `VoicingGroups`, `chordDots`, then
   `library/ChordPickers`, `VoicingStepper`, `settings`, `ChordLibrary`.
5. Routes `/chords`, `/chords/library`, the loader, the `CHORDS` section;
   update `sections.test.ts`.
6. CSS for the diagram grid in `globals.css`.
7. CLAUDE.md: layout, storage key.
8. `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`;
   screenshots at 390 and 1280px in both themes.
