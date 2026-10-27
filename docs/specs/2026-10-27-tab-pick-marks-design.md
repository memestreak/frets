# Picking a technique mark on the tab

Issue #128. Agreed with Jeremy on 2026-10-27 (design options 3 and 1).

## What a press does

A press on a drawn technique mark picks the mark. It no longer falls
through to the nearest note or does nothing.

- The mark gets the same outline as a picked chord name or text, with a
  Delete icon to its right. There is no Edit icon: the palette changes it.
- The palette lights only the mark's own tool, so its kind can be changed
  there. Examples: Vibrato cycles to wide, a bend's panel changes its
  amount. A mark changed this way stays picked while it is still drawn.
- The cursor moves to the mark's note but is not drawn while the mark is
  picked.
- Delete or Backspace, or the Delete icon, takes the mark away. The note
  stays. A tie taken away leaves its note played at the same fret. This is
  one undo step.
- Esc lets the mark go and shows the cursor where it was. Any other key lets
  the mark go and then does what it does on the note.

## Which note a mark belongs to

- **On one note:** a bend or pre-bend (its arrow and label), slide-out,
  tap's T. The press picks that note.
- **Joins** (hammer-on or pull-off arc, slide line, tie arc): the note the
  join arrives at, which is where Frets keeps it.
- **Over a column:** vibrato, P.H., accent, staccato, stroke, tremolo. These
  pick the column with no string (the column cursor), and the tools act on
  the whole column. Delete clears the mark from every note in the column.
- **Tuplet number or bracket:** the whole group is selected. Delete makes
  the group plain notes.
- **P.M. and let ring lines:** unchanged. They pick their run, as before.

## Hit areas

- A note's number wins over a mark drawn near it: a press within 7 units of
  a number is on the note.
- Thin marks (vibrato, P.H., accents, strokes) reach 8 units above and below
  their row.
- Where boxes overlap, the smallest wins. Example: an accent over a
  staccato dot, each taking its own half.

## Code

- `marks.ts` (pure): `markBoxes` (every mark's box, following `TabClip`'s
  drawing), `markAt`, `markBox`, `markTool`.
- `removeMark` in `editing.ts`.
- `TabClip` calls `onPickMark` after runs and words, before notes.
- `TabPage` keeps the pick in `picked` beside the word picks.
