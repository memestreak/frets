# Plan: Sweet Child O' Mine, round 7 (Guitar Solo 3, bars 131–140)

Spec: `docs/specs/2026-10-28-tab-sweet-child-solo-five-design.md`.

1. Transcribe bars 131–140 in the project files (not the repository), from the PDF's text layer and a
   300 dpi render; render beside the book's page 7 and list the differences.
2. `bendLabelLines` in `staffMarks.ts` (pure): which line each bend's label goes on in a column. The
   tab (`BendDrawing` in `TabColumn.tsx`) and the staff alone (`StaffDrawing.tsx`) draw by it;
   `layout.ts` keeps `BEND_LABEL_STEP` more room over the tab when a column bends two strings.
3. Example `solo-double-bends` (bars 131–134); tests in `soloLook.test.tsx`; the Tab README.
4. Check in a browser: the example in Both, Staff and Tab, bar 132's "full" over "½".
