# Plan: Sweet Child O' Mine, round 4 (end of Chorus 2, Guitar Solo 2, start of Chorus 3)

Spec: `docs/specs/2026-10-28-tab-sweet-child-solo-two-design.md`.

1. Transcribe bars 77–100 in the project files (not the repository), from the PDF's text layer and a
   300 dpi render; render beside the book's page 4 and list the differences.
2. `Note.mordent` (`umordent`, `lmordent`): read, written, validated in storage; `columnMordent`.
3. Bravura's ornamentShortTrill and ornamentMordent in `smufl.ts` (`scripts/smufl-glyphs.mjs`);
   `mordentSign` in `marks.ts`, drawn by `StaffDrawing.tsx` (placed in `staffMarks.ts` with the
   vibrato waves) and by `TabClip.tsx` in the vibrato's row, which `rowsFor` now opens for a mordent.
4. Palette: Mordent and Lower mordent (`tools.ts`, icons in `TabPalette.tsx`); picking and Delete
   (`marks.ts`, `editing.ts`).
5. `hiddenNumber`: a let-down note named where a bar starts; a tied note named when a legato leaves
   it or under a mordent.
6. Example `solo-ornaments` (bars 86–93); tests in `soloLook.test.tsx`; the agent guide; the Tab README.
7. Check in a browser: the example in Both and Tab, the palette buttons on and off, picking a mordent.
