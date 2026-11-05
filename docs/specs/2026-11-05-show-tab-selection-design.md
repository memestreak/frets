# show_tab: select notes to loop them

Builds on `docs/specs/2026-11-05-show-tab-loop-points-design.md` (loop
points in the `show_tab` MCP App). Asked for by Jeremy, 2026-11-05: "Our
MCP app's show tab tool should allow for selection. This allows us to set
arbitrary loop points."

Read as: selection in the chat is for looping only, not editing. It works
as the Tab page's does (the Shift+press rule of
`docs/specs/2026-11-05-tab-shift-press-grows-design.md`, Loop with a
selection of PR #365), so nothing new is learned between the two.

## What

- A press on a note, a blank string, a staff head, a line or space, or a
  rest selects its column. A rest is taken in whole, as on the Tab page:
  every rest of a Whole-bar rest, every bar of a multi-bar rest.
- A Shift+press grows the selection to take in what was pressed; inside
  it, it trims the end nearer the press (`growSelection`, issue #366).
  With nothing selected, a Shift+press selects as a press does.
- The selection is drawn as on the Tab page: its notes in `--select` and
  the box round the run.
- Loop (the button, or L) with columns selected puts the loop points round
  them and lets the selection go. Selected again on the loop's own
  columns, Loop clears the loop points, as on the Tab page. With nothing
  selected, Loop does what it did: clears the points, or loops the whole
  line. Loop's tip says "Loop the selected notes (L)" while it would.
- The model hears the new loop points as it does after a drag.
- Play (and Space) starts at the selection's first column, else at the
  loop points' start, else at the line's start, as on the Tab page.
- Esc, a press off the notes, or a press anywhere outside the frame's
  controls lets the selection go (`useDeselect`); a new line lets it go
  too. A press on Play, Loop or another control keeps it.
- The model is not told about a selection, only about the loop points it
  makes.

## How

- `mcp/ChatTab.tsx`: holds a `Selection` (columns across the line, as the
  Tab page's), hands `TabClip` `onPick`, `onPickStaff`, `onPickRhythm` and
  `onMiss`, and its `highlight` with the range boxed and no cursor; Loop
  and L as above. No new module: `growSelection`, `selectedRange`,
  `indexOf` (`editing.ts`) and `isWholeBarRest` (`layout.ts`) are reused,
  so the bundle barely grows.

## Not done

- Shift+← →, Shift+drag rectangles and pressing a bar number: the Tab
  page has them, the chat can have them once asked.
- The selection in what the model hears.

## Tests

- A press selects its column; Shift+presses after and before it grow the
  selection (4 → 4–8 → 2–8); inside it, the nearer end comes to the press
  (2–8 → 2–6 → 3–6); a plain press starts over.
- Esc, a press below the tab, a press outside the drawing and a new line
  each let the selection go.
- The Loop button with columns 3–6 selected loops them, the selection
  goes, and the model hears "looping bar 1, column 3 to bar 2, column 2"
  with `loop: { start: { bar: 1, column: 3 }, end: { bar: 2, column: 2 } }`.
- L does the same; the loop's own columns selected again, L clears them;
  with nothing selected, L loops the whole line, then clears it.
- Play starts at 0 with nothing selected, at the selection's first column
  with one, and at the loop's start once Loop has taken the selection.
