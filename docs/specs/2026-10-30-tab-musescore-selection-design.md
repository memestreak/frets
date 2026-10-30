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

## PR 2: the rectangle and stepping through marks

Jeremy moved step 3, normal mode and note input, ahead of this
(`2026-10-30-tab-note-input-mode-design.md`), and on 2026-10-30 moved Ctrl/⌘+click list selection and
right-click → Select similar to their own issue (#260).

- **Shift+drag from blank space** (not on a note, mark or word; a staff line or space, a string with no
  note there, or the band round the lines) draws a dashed rectangle, filled `--primary-soft`. On letting
  go, the columns drawn inside it, on any line whose staff or tab it crosses, become the selection, from
  the first to the last, as Shift+arrows select. A rectangle that takes in no column changes nothing.
  A Shift+press there that moves less than 4 pixels extends the selection as before.
- **Alt+← →** step through everything a press can pick, in reading order: in each column, its bar's
  words when it opens the bar (capo, section, tempo, ending), its chord name and text, its notes from the
  high string down (or the rest), then its marks. Each is picked as a press picks it: a note selected
  (on the staff when the staff had the keys), a rest's column alone, a mark or word outlined with its
  Delete (and Edit). From a column with no string picked, → goes to its first note. Nothing is past
  either end. P.M. and let ring lines are runs, picked by a press only.
- Holding a modifier key down on its own no longer lets a picked mark or word go.
- **A selection lights its notes, with no band** (Jeremy, 2026-10-30: "only the notes (annotations)
  highlighted"): every selection, made any way (Shift+arrows, Ctrl+A, Shift+press, the rectangle), draws
  its columns' fret numbers, marks, staff heads, signs, stems and rests in `--primary`, as MuseScore
  colours selected notes. This replaces the band of `2026-10-28-tab-fewer-bands-design.md`, which the
  selections had kept.

### Reading

- MuseScore's rectangle selects the notes inside it; Frets selects runs of columns, so the rectangle
  selects the run from the first column inside to the last, as #238 says.
- The order inside a column (words, notes, marks) is my choice; MuseScore's next-element order varies
  with the element.

## Code

`jumps.ts` (pure): `jumpCursor`, `jumpFocus` and `jumpForKey`. `editorKeys.ts` takes them in
`jumpKeyDown`, with the drawn lines' first and last columns from `TabPage.tsx` (`drawnLines`, laid out
only when Shift+Home or End asks). `rectangle.ts` (pure: `columnsInRectangle`) and `TabClip.tsx`'s
`onPickRect` draw and read the rectangle; `elements.ts` (pure: `elementsOf`, `stepElement`) lists what
Alt+← → step through, and `TabPage.tsx`'s `stepToElement` picks it.
