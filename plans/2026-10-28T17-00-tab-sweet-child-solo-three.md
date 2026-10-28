# Plan: Sweet Child O' Mine, round 5 (end of Chorus 3, start of Guitar Solo 3)

Spec: `docs/specs/2026-10-28-tab-sweet-child-solo-three-design.md`.

1. Transcribe bars 101–118 in the project files (not the repository), from the PDF's text layer and a
   300 dpi render; render beside the book's page 5 and list the differences.
2. `hiddenNumber` in `TabColumn.tsx`: under a staff a tied note within a bar is named under vibrato,
   and a tied note that bends up is no longer named for that alone.
3. `staffMarks.ts` gives a tuplet a bracket where one beam doesn't join its group; `StaffDrawing.tsx`
   draws it with the number in a gap, its ends hooking toward the notes. `TabStems.tsx` stops
   counting unbeamed notes as one beam, so the tab alone brackets quarter-note triplets too.
4. Example `solo-triplets` (bars 113–118); tests in `soloLook.test.tsx`, `heldBends.test.tsx` and `staffMarks.test.ts`;
   the Tab README.
5. Check in a browser: the example and the whole song in Both, Staff and Tab.
