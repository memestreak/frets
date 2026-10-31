# Tab: bars stay full

Issue #238, step 2 (Jeremy, 2026-10-31: "Yes, please", to starting it after #262). In MuseScore,
taking notes away or pasting never makes a bar longer or shorter: notes become rests, and a paste
writes over the time it lands on. Frets did the opposite (Delete took columns away, paste pushed the
rest of the bar on). This step makes Frets work as MuseScore does, and keeps the old ways behind a
modifier.

## Behaviour

| Action | Now | Before |
| --- | --- | --- |
| Delete / Backspace on a selection | Its columns become rests of the same lengths; the selection stays. | Took the columns away. |
| Delete on a note | Clears the note (the column becomes a rest when it was the last). | Same. |
| Delete on a column with no string picked | The column becomes a rest. | Same. |
| Delete on a rest or an empty bar | Nothing. | Took the rest, or the bar, away. |
| Ctrl/⌘+Delete (or Backspace) | Takes the selection, the cursor's column, or an empty bar away: the old Delete. | — |
| Cut (Ctrl/⌘+X) | Copies, then leaves rests, as MuseScore's cut does. | Took the columns away. |
| Paste (Ctrl/⌘+V) | Writes over the time from the cursor's column, or the selection's start. | Put the columns in before the cursor, over the selection. |
| Insert paste (right-click menu, Ctrl/⌘+Shift+V) | Puts the columns in before the cursor's column: the old paste. | — |

What is left is selected, as MuseScore leaves it (Jeremy, 2026-10-31: a staff note deleted left its
head lit; then, of keeping nothing selected or MuseScore's way, he chose MuseScore's): in normal mode, after Delete of a note the column it was in (its rest, or the chord's other
notes) is selected and lit, with no note or staff head kept picked; after Ctrl/⌘+Delete, the column
the cursor lands on; a cut keeps its rests selected; a paste or Insert paste selects what it put in.
Note input keeps the cursor where it is, to type on.

In normal mode a column with no note picked (a rest the arrows land on, or a chord with no string
picked) is lit as a one-column selection is, never boxed (Jeremy, 2026-10-31: the box came back after a
Delete and the arrows).

Off the tab, with the playback line, Delete and Backspace follow the same rules
(`deleteAtLine`): the column before the line becomes a rest, a rest stays, and Ctrl/⌘ takes it away.

### Paste over (`pasteOver` in `editing.ts`)

- The pasted columns go over the clip's time from the cursor's column on, across bar lines; the
  pasted bar lines are not kept, so the clip's bars keep their lengths.
- A column the paste covers only in part leaves the rest of its time as rests (the fewest that fill it).
- A pasted note that would cross a bar line is split there and tied over (its marks stay on the first
  part). A tuplet is not split: its bar runs over, as note input's long notes do.
- A short bar's missing time is room too, before the paste goes on to the next bar.
- Past the clip's end, bars of rests are added in the last bar's time.
- Into an empty clip the pasted clip comes whole, with its name, time and tuning, as before.
- The cursor ends on the last pasted column.

## Reading

- "Insert paste" is the right-click menu's name for it, beside Insert bar before and after. The menu
  reads the clipboard with `navigator.clipboard.readText`, which the browser may ask permission for;
  Ctrl/⌘+Shift+V needs none.
- MuseScore keeps a whole-bar rest whole when a paste covers part of it; Frets splits it into the fewest
  rests, as note input does.
