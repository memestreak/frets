# Plan: Sweet Child O' Mine, round 2 (Verse 1 and Chorus 1)

Spec: `docs/specs/2026-10-28-tab-sweet-child-verse-design.md`.

1. Transcribe bars 25–48 in the project files (not the repository); render beside the book's page 2
   and list the differences.
2. `layout.ts`: `sectionBoxes`, `tempoParts` and `boldTextWidth` for the book's tempo and section;
   `TabClip.tsx` draws them.
3. `Bar.doubleBar` (`\db`): read, written, drawn on the tab and the staff; `toggleDoubleBar` and the
   palette's Double bar button.
4. `Clip.multiBarRests` (`\multiBarRest`): read and written; `multiRests` finds the runs; the layout
   gives each bar of a run its slice (`restRun` on a placed bar) and keeps the run on one line;
   `MultiRest` draws it on the staff, or on the tab alone.
5. In Both, hide a tied note's number within a bar (not one that bends).
6. `columnRuns` stops at the bar line; a tighter, heavier wide vibrato.
7. `justify`: the last line runs full when it has as many bars as the line before.
8. `prettyChord` for chord names.
9. Example `verse-rests` (bars 24–35); tests in `verseLook.test.tsx`; the agent guide; CLAUDE.md.
10. Check in a browser: the example in Both and Tab, the Double bar button on and off, the cursor
    stepping through the collapsed rest.
