# Tab: note input mode's grid

Issue #293 (Jeremy, 2026-11-01: "a note insert grid granularity, similar to Dorico"). Dorico's
rhythmic grid is a note value kept apart from the length of the note being entered: it sets how far
the caret moves and where a note can go. Before this, note input mode's cursor stepped one column at a
time, so a half-note rest was one stop and nothing could go on its second beat without splitting it
first.

## Decisions (Jeremy, 2026-11-01)

1. **Grid through rests, notes stay one stop.** In note input mode, → and ← stop at each grid line inside
   a plain rest, and so through the empty time a bar's rests hold. Over a note (a chord, a tuplet, a
   grace note) they still go one note at a time. Holding Shift for grid-everywhere, as Dorico has it,
   may come later; Shift+← → already grow the selection, so it would need its own key.
2. **Values: quarter, eighth, sixteenth and thirty-second; a sixteenth by default.** Triplet grids
   may come later.
3. **Shown on the page and kept.** A Grid button in the palette's Duration group (first under the note values, `2026-11-09-tab-duration-row-design.md`) shows the
   grid's note over a ruler; a press opens the four values. The grid is a preference, Settings ›
   Tab › Editing › Note input grid, kept between visits.

### Round 2 (Jeremy, 2026-11-01, after comparing MuseScore)

4. **The grid follows note input mode's length by default**, as MuseScore's placement does: with a quarter
   picked, ← → and presses step through a rest by quarters. A **fixed grid** is turned on when wanted:
   the Grid panel lists Note length first, then the four values; **Alt+G** switches between Note length
   and the last fixed grid; Alt+[ ] turn the fixed grid on, then make it finer or coarser. Settings ›
   Tab › Editing has "Note input grid: Fixed | Note length" and "Fixed grid".
5. **Space always plays**, as in MuseScore. **Shift+Space** moves the cursor on by note input mode's length,
   over notes and rests alike, as Dorico's Space moves its caret: inside a rest it stops there, inside
   a note at the column after it, and past the clip's end a bar of rests is added.
6. Playing from inside a rest starts at the rest's start (fine, Jeremy).
7. **The caret follows Dorico's model** (Jeremy, 2026-11-07, issue #396). The mouse never moves
   the caret: only the keys, a press and N do, and nothing of the mouse is kept outside note input mode.
   The caret always shows in note input mode, wherever the mouse is: on the staff its line and the next
   note's ghost (over a note at another pitch only the ghost, to add to the chord; over one at its
   own pitch both, the ghost see-through), on the tab its box on a string (N picks the string last used;
   Jeremy, 2026-11-08), or a short upright line on a column with no string picked. The mouse shows its own shadow note on the staff and a box on the
   tab, fainter than the caret's ghost. A press on the staff enters the shadow's pitch and the caret
   goes on past the note by its length, as A–G and Enter do (Jeremy, 2026-11-07); a press on the tab enters a
   0 there with the caret on it, for digits to change (Dorico's tab is always in chord input). The
   Grid is drawn over the caret's bar, on the part the caret is on (in Both view, the staff or the tab;
   Jeremy, 2026-11-07), and, as Dorico draws it, over the bar under the mouse, on the part it is over,
   its beats a little stronger. Pressing Staff, Tab or Both leaves the focus on
   the editor, as the palette's buttons do, so the caret and the Grid stay. How is a preference, Settings › Tab › Editing › Grid drawn as (Jeremy, 2026-11-03):
   **Ruler over the staff** (the default), ticks on a line over that part, or **Lines across the
   bar**, faint lines from that part's top line to its bottom one. (Dots under the bar, a third mock, was
   dropped.)
   Only places a note can go are marked: each note's start and the grid lines inside rests, never one
   inside a note's length, which the same voice can't take (Jeremy, 2026-11-03). Entering inside a note,
   as Dorico does, is issue #332.

## How it works

- Grid lines are counted from the bar's start, not the rest's: on a 16th grid a rest after a dotted
  eighth stops at its start and then on the bar's 16ths.
- The cursor is drawn that far along the rest's room, the tab's box and the staff's cursor alike.
- A note entered inside a rest (a fret typed, Enter on the staff, a press) first splits the rest
  there: the time before and after each become rests written on the beat, every one the longest
  plain rest that starts on a multiple of its own length (an 8th and a 16th, then a 16th and a half).
  The note then takes note input mode's length from the rests after it, as on any rest
  (`2026-10-30-tab-note-input-mode-design.md`).
- ← back into a rest lands on its last grid line; → off a rest's last line goes to the next column,
  and past a bar's end works as before (a short bar gets a rest to type on, a full last bar a new bar).
- In note input mode a press beside the notes, on the tab or on a staff line or space, snaps to the nearest
  stop: a note's column or a grid line inside a rest. The shadow note snaps with it. A press on a note
  or a head is that note, as before.
- **Alt+[** makes the grid finer and **Alt+]** coarser, as Dorico's keys do, on the tab or off it but
  not in a text field, dialog or menu. They match by key position (`code`), so they work where Alt
  types another character. Both are listed on the `?` overlay under Note input mode.
- Normal mode is unchanged: ← → select a column at a time.

## Not in this change

- The drag-to-move and drag-to-resize work (thread "Drag notes to move and resize on staff") will snap
  to this grid; that was its open question 3.
- A note typed on a rest still leaves the fewest rests after it (`splitRest` in `editing.ts`), not
  rests on the beat; making those match is a possible follow-up.

## Code

`grid.ts` (pure: the values, the stops in a column, stepping, splitting a rest, snapping a press),
`editingPrefs.ts` (`grid`), `editorKeys.ts` (← → and entering), `TabPage.tsx` (the cursor's place in
its rest, Alt+[ ]), `TabClip.tsx` and `hitTest.ts` (drawing the cursor along a rest, snapping a
press), `TabPalette.tsx` (the Grid button), `tabSettings.tsx`, `shortcuts.ts`.
