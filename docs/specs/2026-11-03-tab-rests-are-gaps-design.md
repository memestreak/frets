# Tab: Rests are Gaps, written by the meter

Step 3 of the build order in the Tab editing principles
(https://claude.ai/artifact/T5JHs64SqQcS6iqLhYfqs7, choice A3, refined
here). Jeremy settled the questions below on 2026-11-03 (Q1–Q13 in the
thread "Plan rests as gaps (step 3)", run with /grill-with-docs). The
rests are spelled by the tables in
`docs/specs/2026-11-03-tab-sounding-notes-design.md`; why edits work on
Sounding notes while the Clip stores Columns:
`docs/adr/2026-11-03-edit-sounding-notes-store-columns.md`.

A rest is no longer a thing you set. It is a Gap: the time in a Voice
with no note, written as the rests the meter calls for. After every edit
that changes a bar's rhythm, Frets writes that bar's Gaps again by the
meter. An empty bar is drawn as one Whole-bar rest.

## What changes

- **Rests follow the meter.** In 4/4, an eighth on beat 1 and nothing
  else is `e re rq rh`, no longer an eighth and a double-dotted half
  rest. In 3/4 a quarter on beat 1 is `q rq rq`. Every rest table in the step 1 spec applies.
- **Which bars are rewritten (Q2).** Every edit goes through one step
  that reads the Voice as Sounding notes, makes the change and writes it
  back. A bar is written again only when its rhythm changed: a note
  added or removed, a note's start or length changed, or its time
  signature changed. Frets, strings, techniques and marks leave the bar's
  rests as they are, so an imported or linked bar keeps its own rests
  until its rhythm is edited (A3).
- **Tie chains (Q8).** A rhythm edit to a Tie chain rewrites every bar
  the chain touches, and no other bar.
- **Short and overfull bars (Q9).** A bar that doesn't add up (from an
  import, Ctrl/⌘+Delete, Insert, a run's length change, a tuplet or a
  note typed past a bar line) is written back exactly as it was, as the
  step 1 writer does: it keeps today's rests and its ⚠. Step 4 stops
  these bars arising. A bar emptied by Ctrl/⌘+Delete is one of them.

## The Whole-bar rest (Q5, Q13)

- An empty bar, one with no note in its Voice, is drawn as one
  Whole-bar rest centred in the bar, whatever the meter: on the staff,
  in the rhythm under the tab, and in PNG and SVG.
- It stores the rests the step 1 spec gives an empty bar: `rw` in 4/4,
  `rh.` in 3/4 and 6/8, `rh` in 2/4, one rest per Beat group where no
  single rest fits (5/8 `rq. rq`, 7/8 `rq rq rq.`). alphaTex and Guitar
  Pro write those stored rests. MusicXML writes one measure rest
  (`<rest measure="yes"/>`). ASCII draws no rests, so it is unchanged.
- A press on a Whole-bar rest picks the bar's rests together as one
  thing, even where the bar stores two. A fret typed on it puts the note
  on beat 1.
- Multi-bar rests are unchanged: a run of empty bars still draws as one.

## The rest-length keys go (Q3)

PR #294's rest lengths (`docs/specs/2026-11-01-tab-rest-lengths-design.md`)
go. With a rest picked:

- 1–7, Shift+1–7, W/Q, +/−, . and the Duration buttons do nothing.
- The Duration group lights nothing.
- A rest can still be picked, so a fret can be typed on it. Delete on a
  rest still does nothing.

A picked note or chord keeps #294's length keys as they are: longer
writes over what follows, shorter leaves a Gap, now written by the meter.

## Cursor and selection after a rewrite (Q6, Q7)

Rewriting a bar can change how many Columns it has, so both follow time,
not the Column's number:

- The cursor stays at the same time on the same string. If that time now
  falls inside a rest, it goes to the start of that rest.
- A selection keeps the same stretch of time, widened to whole written
  notes and rests.

## Not in this step

- The "Fill short bars with rests" setting stays until step 4 (Q1), with
  the rest of bars always full (A10).
- A fret typed on a rest in normal mode keeps taking the last note's
  length, splitting the rest, until step 4 (A12). The rests left after it
  are written by the meter.
- R keeps turning the column into a rest until step 6 (Q10, A13); the
  rests it leaves are written by the meter.
- PR #299 (the note input grid) is rebased onto this step before step 4
  starts (Q4).

## How

- `src/features/tab/rewrite.ts` (pure, new): `rewrite(before, after)`
  reads both Parts' Voice (`readVoice`), finds the bars whose rhythm
  differs (Sounding notes' strings, starts and lengths; grace notes and
  tuplet blocks; the bar's time), adds every bar a changed Tie chain
  touches, and returns `writeVoice(after, read, { bars })`. Bars that
  don't add up are left to `writeVoice`, which hands them back unchanged.
- One place calls it: the editor's `commit` in `useEditorState.ts`, so
  every edit (keys, the Rail, the right-click menu, paste, drag) goes
  through it. Edits that build rests themselves (`clearToRests`,
  `splitRest`, `changeLength`, `pasteOver`, `insertBar`, the new bar from
  →) keep building them; the rewrite spells the result by the meter.
  `fewestRests` stays only where a short bar is filled (`fillBar`,
  `restToTypeOn`) until step 4 removes those.
- Cursor and selection: `rewrite` also maps a Cursor and a Selection
  from `before` to the result by time (`placeAtTime`).
- The rest-length keys: `changeLength` in `noteEdits.ts` and the length
  keys in `editorKeys.ts` skip a target that is only rests; the palette
  lights no Duration for a picked rest (`tools.ts`).
- The Whole-bar rest: `StaffDrawing.tsx` and `TabStems.tsx` draw a bar
  whose Columns are all plain rests, with no note, as one whole rest
  centred between the bar lines; `hitTest.ts` picks all its Columns
  (the selection over them). `musicxml.ts` writes such a bar as one
  measure rest, as it already does for a bar with no Columns.
- Update `editing_tests/` with a rests test arrangement
  (`.claude/skills/test-arrangement/`).

## Tests

`src/__tests__/tab/rewrite.test.ts` and page tests:

- Deleting the second, third and fourth of four quarters in 4/4 leaves
  `q rq rh`; deleting every note but an eighth on beat 1 leaves
  `e re rq rh`.
- In 3/4, a quarter on beat 1 with the rest deleted is `q rq rq`, never
  a half rest.
- Deleting every note of a 4/4 bar stores `rw`; of a 3/4 bar `rh.`; of a
  5/8 bar `rq. rq`.
- Adding a palm mute, changing a fret or moving a note to another string
  in an imported bar written `q` and a dotted half rest leaves its rests as written.
- A rhythm edit in a bar leaves every other bar's Columns as they were,
  except the bars a changed Tie chain crosses into.
- A short bar and an overfull bar come back exactly after an edit in
  them, with their ⚠.
- With a rest picked: 1–7, Shift+1–7, W, Q, +, −, . and each Duration
  button leave the Clip unchanged, and no Duration button is lit.
- A picked note's length change still writes over and leaves a Gap,
  written by the meter (`q` made an eighth on beat 1 of `q q q q` gives
  `e re q q q`).
- After a rewrite the cursor is at the same time and string; on a time
  inside a rest, at that rest's start. A selection over beats 2–3 still
  covers beats 2–3.
- An empty bar draws one whole rest centred in the bar on the staff and
  under the tab, in 4/4, 3/4 and 5/8 (one `staff-rest` in 5/8, not two).
- A press on a 5/8 Whole-bar rest selects both of its Columns; a fret
  typed on it goes on beat 1.
- MusicXML writes an empty 3/4 bar as one `<rest measure="yes"/>`;
  alphaTex writes it `r.2{d}`, unchanged.
- A run of empty bars still draws as one multi-bar rest.
