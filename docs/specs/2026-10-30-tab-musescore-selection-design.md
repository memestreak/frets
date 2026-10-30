# Tab: selecting and editing as MuseScore does

Issue #238, step 1 (Jeremy, 2026-10-30: "Update our tab page editing behavior to be more consistent
with Musescore", picked "one umbrella issue" and then "start on step 1"). The comparison behind it
is the doc "Tab editing vs MuseScore". Step 1 adds MuseScore's selection tools that clash with no key
Frets already has. It lands in two PRs: the keys first, then picking several things at once.

## PR 1: keys

| Key | Does |
| --- | --- |
| Ctrl/⌘+← | The cursor to the start of its bar, or, already there, to the start of the bar before. |
| Ctrl/⌘+→ | The cursor to the start of the next bar; in the last bar it stays. |
| Ctrl/⌘+Home, End | The cursor to the clip's first or last column. |
| Ctrl/⌘+Shift+← → | Grows the selection (from the cursor when there is none) to its bar's start or end, then a bar at a time. |
| Ctrl/⌘+Shift+Home, End | Grows the selection to the clip's start or end. |
| Shift+Home, End | Grows the selection to the start or end of the drawn line of tab. |
| W, Q | Longer and shorter note value, as + and − do. |
| Ctrl+Y | Redo, as Ctrl/⌘+Shift+Z does. ⌘+Y is left to the browser (it opens History in some). |

- The cursor keeps its string. As with ← →, an empty bar is a place the cursor can stop, and a
  selection steps over it; leaving a short bar fills it when Settings › Tab › Editing › "Fill short
  bars with rests" is on. Moving lets any selection or picked mark go, as every cursor move does.
- Growing a selection lets go of the string, as Shift+← → do (`2026-10-28-tab-fewer-bands-design.md`).
- On the staff cursor the same keys work, and its pitch stays.
- The palette's length tips say "+ − or W Q".
- Off the tab (the playback line) these keys do nothing yet.

### Reading

- Ctrl/⌘+← from the middle of a bar goes to that bar's start first, as a word jump does in a text
  field; MuseScore's handbook doesn't say.
- On a Mac, Ctrl+← → belong to the system (they switch desktops), so ⌘ is the one that reaches the page.
- Plain Home and End, which MuseScore doesn't bind, stay unbound.
- Shift+W and Shift+Q (MuseScore's dots) are not taken: `.` steps the dots.

## PR 2: picking several things (after the modes)

Jeremy moved step 3, normal mode and note input, ahead of this
(`2026-10-30-tab-note-input-mode-design.md`).

Ctrl/⌘+click list selection of notes and marks, Shift+drag rectangle from blank space, Alt+← → through
marks and words, right-click → Select similar.

## Code

`jumps.ts` (pure): `jumpCursor`, `jumpFocus` and `jumpForKey`. `editorKeys.ts` takes them in
`jumpKeyDown`, with the drawn lines' first and last columns from `TabPage.tsx` (`drawnLines`, laid out
only when Shift+Home or End asks).
