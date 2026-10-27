# Entering notes from the staff

Issue #136, the follow-up to the notation staff (`2026-10-27-tab-notation-design.md`). Jeremy's
answers, 2026-10-27.

## The staff cursor

- The staff has a cursor of its own: an outlined head, in the primary colour, on the tab cursor's
  column, with ledger lines and, when the key doesn't give it, its sharp, flat or natural. It stands for
  a pitch, not a note: the pitch Enter would put on the column.
- A press on the staff, as far as two ledger lines past it, puts the cursor there: on a head, at that
  note's pitch; anywhere else, on the key's note on the nearest line or space of the nearest column. It
  adds nothing. Shift with the press selects, as on the tab.
- The keys drive whichever part was pressed last. A press on the staff hands them to the staff cursor;
  a press on the tab hands them back, and the staff cursor goes.
- With the staff alone, the staff cursor is the only one: it shows as soon as the clip has the focus,
  on the note under the tab cursor or the middle line. Staff alone is no longer read-only.

## Keys

- **Left / Right** move between columns, as on the tab; the pitch stays.
- **Up / Down** move one line or space, onto the key's note there (F♯ on the top line in G major).
- **#** raises the cursor a semitone, **b** lowers it. The pitch is spelled in the key as any note is,
  so B with # in C major is C, one step up. (+ and − change a note's length on the tab.)
- **Enter** adds a note at the cursor's pitch, or takes away the column's note at that pitch. Several
  Enters in one column build a chord. On a rest the note takes the last note's length and the rest
  keeps what is left, as typing a fret there does.
- **Alt+Up / Alt+Down** move the note at the cursor's pitch to the next higher or lower string that
  can play it, skipping strings the column already uses. The pitch never changes; the note keeps its
  marks.
- Every other key does what it does on the tab: the palette's keys, lengths, undo, copy and paste.

## The string and fret Frets picks

A string with no note in the column yet. With other fretted notes in the column, or else in the
nearest column before with any, the fret nearest their average; an open string counts as near while
that average is at the 5th fret or lower. With nothing around, the lowest fret. Ties go to the lower
fret. A pitch no free string can play does nothing, and the line under the clip says "No free string can
play that note here."

## Code

`staffEntry.ts` (pure): a step's pitch in the key, stepping, `choosePlace`, `toggleStaffNote`,
`moveToString` and where the cursor is drawn. `layout.ts`'s `staffAt` says where a press on the staff
lands; `hitTest` is now the tab's alone. `StaffCursor` in `StaffDrawing.tsx` draws the cursor.
`TabPage.tsx` keeps the cursor's pitch (`staffPitch`) and its keys.
