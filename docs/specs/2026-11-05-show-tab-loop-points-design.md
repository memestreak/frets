# show_tab: loop points the model sets and the user drags

Builds on `docs/specs/2026-11-04-show-tab-mcp-app-design.md` (the
`show_tab` MCP App). Asked for by Jeremy, 2026-11-05: set loop points the
way the Tab page can, and let the user change them in the chat.

## What

- The model can set **loop points** in a `show_tab` call. They are set,
  not played: Play stays the user's.
- In the chat the loop points are drawn as on the Tab page: the bracket
  over the looped columns, its two ends handles the user drags a column at
  a time (`LoopHandles`, shared with the Tab page). The start never passes
  the end.
- Loop (the button, or L as on the Tab page) clears the loop points, or
  puts the bracket over the whole line, so both ends are always there to
  drag in. The chat never uses the Tab page's bracketless whole-clip loop.
- The model hears the loop points the user leaves, in words and in the
  call's own shape, a second after the last change, with the bpm.

## Settled (Jeremy, 2026-11-05, "yes to all")

1. **Input**: `loop: { start: { bar, column }, end: { bar, column } }`,
   counted from 1 like the checks' errors. `column` left out means the
   bar's first column (start) or last (end); an end left out means the
   line's start or end; `loop: {}` loops the whole line.
   Not chosen: bars only (`loop: [2, 3]`); column numbers across the line.
2. **Changing them**: the Tab page's bracket with draggable ends; Loop and
   L put it over the whole line.
   Not chosen: also pressing and dragging across the notes to draw a new
   loop; also a press on a bar number to loop that bar.
3. **What the model hears**: the points, e.g. "The user is now playing the
   line at 90 bpm, looping bar 2 to bar 3, column 4.", and
   `structuredContent` `{ bpm, loop }` with `loop` in the input's shape
   (or null). Not chosen: only "looping" or "not looping".

## How

- `mcp/tool.ts`: the `loop` field, its descriptions short (every chat pays
  for them).
- `mcp/lineJson.ts`: `loopPoints` turns the input into the clip's
  `[first, last]` columns across the line, refusing a bar or column the
  line hasn't got and a start after the end; `loopOf` turns points back
  into the input's shape (a `column` only where the end isn't the bar's
  edge); `describeLoop` words them ("the whole line", "bar 2",
  "bars 2 to 3", "bar 2 to bar 3, column 1").
- `mcp/register.ts`: the result's text adds ", loop points on bar 2", and
  the state handed to the app carries `loop` in the input's shape.
- `mcp/ChatTab.tsx`: starts from the call's points (a new call replaces
  the user's), draws `LoopHandles`, Loop and L as above.
- `mcp/TabApp.tsx`: what the call set isn't told back; the user's changes
  are.
- `usePlayback`'s `setLoopPoints` takes null to clear the points.

## Later

- The loop points in the Open in Frets link, once the Tab page's link
  carries loop points at all.

## Tests

- No `loop` sets no loop points.
- With three 4/4 bars of four quarters: `{}` is columns 0–11;
  `{ start: { bar: 2 } }` 4–11; `{ end: { bar: 2 } }` 0–7;
  `{ start: { bar: 2, column: 3 }, end: { bar: 3, column: 1 } }` 6–8.
- Refused, with these words: bar 4 of 3 ("Loop start: there is no bar 4;
  the line has 3."), column 5 of 4 ("Loop end: bar 2 has 4 columns."), a
  start after the end ("Loop: the start comes after the end."); bar 0 by
  the schema.
- `loopOf` gives `{ start: { bar: 1 }, end: { bar: 3 } }` for 0–11 and
  columns only off the bar's edge; its output goes back in unchanged.
- The words: "the whole line", "bar 2", "bars 2 to 3", "bar 2 to bar 3,
  column 1".
- The result's text names the loop points; `structuredContent` carries
  them.
- The app starts with the call's loop points on and tells the model
  nothing; L clears them and the model hears "not looping" with
  `loop: null`; L again loops the whole line and the model hears its
  points.
- L typed in the bpm field doesn't loop.
- Dragging an end moves that loop point a column at a time (checked in a
  browser, as on the Tab page).
