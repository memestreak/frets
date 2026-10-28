# Plan: Sweet Child O' Mine, round 8 (Guitar Solo 3 to the Outro, bars 141–153)

Spec: `docs/specs/2026-10-28-tab-sweet-child-solo-six-design.md`.

1. Transcribe bars 141–153 in the project files (not the repository), from the PDF's text layer and a
   300 dpi render; render beside the book's page 8 and list the differences.
2. `Bend.from` in `clip.ts` (validated: a pre-bend's start, lower than its peak), read in
   `alphatexRead.ts` and written in `alphatex.ts`; `bendRaises` counts each held bend's raises.
3. Draw the raise in `BendCarry` (`TabColumn.tsx`), its room in `layout.ts`, its box in `marks.ts`,
   and leave it out of `carriedBend` in `staffMarks.ts`.
4. Example `solo-bend-rise` (bars 143–146); tests in `soloLook.test.tsx`; the Tab README and
   `public/tab-alphatex.txt`.
5. Check in a browser: the example in Both, Staff and Tab, bar 144's "1½".
