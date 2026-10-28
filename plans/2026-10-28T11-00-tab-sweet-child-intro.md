# Plan: Sweet Child O' Mine, round 1 (header and intro)

Spec: `docs/specs/2026-10-28-tab-sweet-child-intro-design.md`.

1. Transcribe the header and bars 1–24 to alphaTex in the project files (not the repository).
2. Render beside the PDF's first page; list the differences.
3. `notation.ts`: `tuningShift`, `writtenStrings`; use them wherever the staff turns frets into
   pitches (`barHeads`, `layout.ts`, `staffEntry.ts`, the page's staff cursor).
4. `credits.ts` (credits from the header, the tuning block); `ScoreCredits.tsx` under the title;
   the exported image's head; the reader stops listing `\artist`, `\words`, `\music` as not drawn,
   and keeps a single-quoted string's closing quote.
5. `viewOptions.ts` (saved options and parser), `ViewOptions.tsx` (the panel) and `usePopover.ts`
   (shared with the playback options); bar numbers drawn by `TabClip`, passed to exports.
6. `layout.ts`: beams by the half bar in 4/4 (`halfBars` on a placed bar), `justify` the lines.
7. Example `tuned-down`; tests in `scoreLook.test.ts` and the page test; docs (CLAUDE.md, the agent
   guide).
8. Check in a browser: the panel's three choices, Esc, a press away, the button again, a reload, the
   Export dialog's preview.
