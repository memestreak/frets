# Range handles: drag either end of a selection

Jeremy, 2026-11-05, after the Shift+press rule
(`docs/specs/2026-11-05-tab-shift-press-grows-design.md`): "Can we also include drag handles on the
left and right side of the selection?"

## Why

A selection's ends move by Shift+arrows or a Shift+press. A handle on each end lets the pointer move
either end directly, and shows which part of the box can be moved.

## What

- A selected run drawn with its box (`docs/specs/2026-11-01-tab-selection-look-design.md`) has two
  **Range handles**: one on the left edge of its first box, one on the right edge of its last. Over a line
  break, the start handle is on the first line and the end handle on the last. A Span's run, a selected
  rest alone and a column lit with no box have none.
- A handle is dragged sideways. The dragged end follows the pointer column by column; the other end stays.
  The column under the pointer is taken in, as a Shift+press takes it in (the column whose room, bar line
  or halfway to the next note, holds the pointer). Past a line's first or last column, that column.
- A handle can be dragged onto another line of the clip: the line under the pointer, or the first or last
  line when the pointer is above or below the drawing. (A Span's Handle stays on its line.)
- Dragged past the other end, the dragged end stops there: one column stays selected. It never flips
  round the end that stays.
- The dragged end becomes the focus and the other end the anchor, so Shift+arrows and a Shift+press go on
  from it, as after a Shift+press.
- Esc while dragging puts the selection back as it was. A press on a handle that doesn't move changes
  nothing.
- A drag only selects: the music doesn't change and nothing goes on the undo list.
- A handle takes a press before anything under it, as a Span's Handle does, within 10 units across and
  up or down of its corner (`RANGE_HANDLE_REACH`), with the ↔ pointer over that reach.
- In note input and normal mode alike, whenever the box is drawn.

How it looks (Jeremy, 2026-11-05, after mocks of a knob half way down each edge, a grip bar along it and
pins at opposite corners): a **knob**, the ring a Span's Handle has, on the box's **bottom corners**: the
bottom left for the start, the bottom right for the end. Both knobs are drawn while the pointer is anywhere
over the selected run (inside its box, or within a knob's reach of it), and while one is dragged
(Jeremy, 2026-11-05: first only over the knob itself, then anywhere over the box); the rest of the time
the box shows no handles. On a touch
screen, with no hover, the knob is still there to drag, unseen.

How others do it (from their manuals and memory, not checked in the apps): Dorico, MuseScore and Guitar
Pro 8 draw no handles on a range selection; its ends move with Shift+click and Shift+arrows. The
nearest precedents are DAWs (REAPER's time selection edges drag) and selected text on phones, whose
handles also stop at each other. So this is Frets' own, added on top of the Shift+press and Shift+arrow
ways, which work as before.

## How

`rangeBox.ts` (pure) holds the box (`rangeBoxes`, `boxSpan`, moved from `TabClip.tsx`), the handles
(`rangeHandles`, `rangeHandleAt`), where a dragged end lands (`rangeEndAt`) and the new selection
(`draggedRange`). `TabClip` draws the handles and reports the drag (`onDragRange`); `useTabPicking`
applies it with `commit`, keeping the selection it started from for Esc.

## Tests

- A selected run has a handle at each end; nothing selected, none.
- The end handle dragged onto a note two columns on (a bar later) selects through it; the start stays.
- The start handle dragged to the bar line selects from the first note; the end stays.
- An end dragged inward trims the run from that end.
- Dragged past the other end, one column stays selected, both ways.
- The end handle dragged onto the next line selects across the line break; over a line break the
  handles are on the first and last lines.
- The dragged end is the focus: Shift+→ after dragging the end grows on from it; Shift+→ after dragging
  the start trims from the start.
- Esc while dragging puts the run back.
- A press on a handle that doesn't move leaves the run as it was.
- A drag is not an edit: undo after it leaves the selection.
- A picked Span's run has no Range handles, only its own Handles.
- A knob is on the bottom left corner (start) and bottom right corner (end), taken within its reach, not
  half way up the edge nor at its top.
- Both knobs show while the pointer is inside the box, away from the corners, and within a knob's reach
  outside a corner; over a note outside the box or off the drawing, neither; while one is dragged, both.
- Over a run on two lines, inside either line's box counts; past the last box's end beyond the reach
  doesn't.
- Where an end lands: the column whose room holds the pointer; before or after a line's columns, its
  first or last; above the drawing, the first line; below it, the last.
