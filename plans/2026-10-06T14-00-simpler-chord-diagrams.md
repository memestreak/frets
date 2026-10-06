# Simpler chord diagrams

Jeremy, 2026-10-06: option B of the mockups (colour, no labels), fret
number further from the frets. Spec:
`docs/specs/2026-10-06-simpler-chord-diagrams-design.md`.

1. `voicings.ts`: export `DIAGRAM_FRETS` (4) from the span rules.
2. `ChordDiagram.tsx`: plain lines, four frets, ink nut, fret number only
   above fret 1 with a wider bottom margin, grey ×, open-string rings,
   unlabelled dots without rings.
3. `ToneKey.tsx` and its CSS; `VoicingGroups` shows it when `showKey`
   (library yes, lab no).
4. Tests: every shape fits `DIAGRAM_FRETS`; the library shows the key.
5. Update the library spec's Diagrams section and CLAUDE.md.
6. Screenshot both pages at 390px light/dark and desktop.

Follow-up (Jeremy, 2026-10-06): allow five-fret stretches.

7. `MAX_SPAN` 4; the search window follows it (it was hard-coded to four
   frets). One window per lowest fret, bass-is-root pruning while
   enumerating, and `dropDoublings` works out each shape's facts once, so
   all 106 types still search well inside the test's time limit.
8. Diagrams draw five frets (`DIAGRAM_FRETS`), cells 24 wide.
