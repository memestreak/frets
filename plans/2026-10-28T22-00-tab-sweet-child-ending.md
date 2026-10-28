# Plan: Sweet Child O' Mine, round 10 (the ending, bars 170–181)

Spec: `docs/specs/2026-10-28-tab-sweet-child-ending-design.md`.

1. Transcribe bars 170–181 in the project files (not the repository), from the PDF's text layer and a
   300 dpi render; render beside the book's page 10 and list the differences.
2. `Bar.freeTime` (`\ft`) in `clip.ts`, validated, read and written; `startsFreeTime`.
3. Layout: a free run's first bar shows its time signature, with room for brackets; "Free time" goes in
   the tempo row; multi-bar rests stop at free bars.
4. Drawing: dashed closing lines (`BAR_DASHES`) on the staff and the tab; `TimeBrackets` round the
   numbers; "Free time" in `SystemWords`.
5. `Column.fermata` (`fermata short|medium|long`), read and written; Bravura's three glyphs added to
   `smufl.ts` (with the brackets) by `scripts/smufl-glyphs.mjs`; `FermataSign` over the staff
   (`staffMarks.ts`, room in `staffReach`) and in a `fermatas` row over the tab alone; its mark box,
   `markTool` (none) and `removeMark`.
6. Jeremy asked to fix item 5 too: `bendRoom` and `bendPeakRoom` on each placed column after `justify`;
   `bendShape` used by `BendDrawing`, `BendCarry`'s held line, `previousSpots` (a spot's `peak`) and the
   bend's mark boxes.
7. Example `song-ending` (bars 173–181); tests in `soloLook.test.tsx`; the Tab README and
   `public/tab-alphatex.txt`.
8. Check in a browser: the example in Both, Staff and Tab; pick and delete a fermata.
