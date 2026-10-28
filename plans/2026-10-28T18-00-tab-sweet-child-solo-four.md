# Plan: Sweet Child O' Mine, round 6 (Guitar Solo 3, bars 119–130)

Spec: `docs/specs/2026-10-28-tab-sweet-child-solo-four-design.md`.

1. Transcribe bars 119–130 in the project files (not the repository), from the PDF's text layer and a
   300 dpi render; render beside the book's page 6 and list the differences.
2. `Column.wah` (`waho`, `wahc`): read in `alphatexRead.ts`, written in `alphatex.ts`, validated in
   `clip.ts`; `Rows.wah` in `layout.ts`, a row over the chord names; drawn by `WahMark` in `TabClip.tsx`.
3. The Wah palette button (`tools.ts`, `WahGlyph` in `TabPalette.tsx`, `cycleWah` in `noteEdits.ts`);
   picking and Delete (`marks.ts`, `removeMark`).
4. Every tuplet bracketed: `staffMarks.ts`, `StaffDrawing.tsx`, `TabStems.tsx`; the rhythm spec.
5. `hiddenNumber`: a let-down note that slides out keeps its number.
6. Example `solo-wah` (bars 128–130); tests in `soloLook.test.tsx` and `staffMarks.test.ts`; the agent
   guide; the Tab README.
7. Check in a browser: the example in Both, Staff and Tab, the Wah button through its three steps, a
   picked sign deleted.
