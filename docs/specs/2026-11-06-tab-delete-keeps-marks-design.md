# Tab: a column's marks follow its time

Issue #393. Jeremy, 2026-11-06, on the Chords panel: "Does it logically
make sense that the text would be deleted if the note or rest were
deleted? Is that what we want? … I'm wondering if it should not." Then
yes to fixing it as a bug.

## What it does

- Deleting notes leaves rests (bars stay full,
  `docs/specs/2026-11-03-tab-rests-are-gaps-design.md`). A rest left where
  a Column's notes went keeps the marks of that Column's **time**: its
  text, chord name, fermata, wah, hairpin, octave line and any alphaTex
  Frets keeps as written. Dorico ties text, chord symbols, fermatas and
  lines to a rhythmic position, not a note; MuseScore moves them onto the
  rest that replaces the note.
- The marks of the **notes** go with them: a pick stroke, tremolo picking,
  the whammy bar and a Beam override.
- This holds for every way of deleting notes: Delete (or `,`) on a picked
  note, its Tie chain, a chord from an empty string of its column, a
  selection, cut, and Delete or Backspace off the tab at the playback line.
- A bar emptied whole still starts again as the fewest rests that fill it
  (issue #290), except that a rest carrying marks still starts where it
  did: a text on beat 1 leaves one Whole-bar rest carrying it, a text on
  beat 2 of 4/4 leaves a quarter rest, the marked quarter rest and a half
  rest. Such a bar is still drawn as one Whole-bar rest, its marks over
  their own beats, as Dorico draws a bar rest under a text on beat 2.
- Only taking the time away removes them: Ctrl/⌘+Delete, Ctrl/⌘+Delete
  on an empty bar, or Ctrl/⌘+Delete off the tab.
- A tempo and a section are marks of the bar, and stay with it as before.
- When something is written over a column (a longer note, a paste, a note
  typed in note input mode over its time), its text, chord name, fermata and wah
  move to the column now sounding at its start, usually the note that
  covers it (Jeremy, 2026-11-06, option 1 of: that note, the bar's start,
  the next column). A text joins one already there, `"a / b"`; a chord
  name, fermata or wah already there stays and the moved one goes. The
  same text twice is not joined (a note lengthened keeps its own once).
  Marks that last the whole column (tremolo, hairpin, octave line) and
  kept alphaTex stay with their own column, as before.

- A picked text or chord name on a rest draws its Attachment line to the
  rest (Jeremy, 2026-11-06), as one on a note goes to its number
  (`docs/specs/2026-11-04-tab-pick-every-mark-design.md`):
  - with the staff drawn and the word over it, to just above the rest on
    the staff, centred on it, the rest tinted as a picked Mark's note
    head is;
  - in a bar drawn as one Whole-bar rest, to the staff's top line at the
    word's own beat, the whole rest tinted;
  - in the tab alone, to the top string at the column's place; nothing is
    tinted (the rest the tab's rhythm draws under the strings is not).

## How

- `editing.ts`: `restOf(column)`, the rest a Column becomes, and
  `hasTimeMarks(column)`, over one list of the time's marks.
- `clearNote` and `clearToRests` (`noteEdits.ts`) make an emptied Column
  with `restOf`; `clearToRests` builds a bar emptied whole with
  `barOfRests`, cutting it where a marked rest starts. The rewrite by the
  meter (`writeVoice`) already keeps a Column's marks where they start.
- `timeline.ts`: `overStream`, which every write-over goes through, moves
  the covered columns' marks onto the placed column at each one's start
  (`keepCoveredMarks`).
- `staffGeometry.ts`: `staffRest`, where a rest is drawn on the staff and
  its box (with `RESTS` and `restShift`, moved from `StaffDrawing.tsx`,
  which draws from it); `attachment.ts` draws the line and the tint from it.
- Test arrangement `editing_tests/delete-keeps-text.atex`.

## Tests

- Delete on one picked note keeps its Column's text and chord name on the
  rest: `3.6.4 r.4{ch "Am" txt "slowly"} 7.6.4 8.6.4 |`.
- A selection over the Column, or over it and the next, keeps them; so
  does a chord deleted from an empty string of its Column.
- A bar emptied whole with a text on beat 2 is `r.4 r.4{…} r.2`; on
  beat 1 `r.1{txt …}`; on beat 3 `r.2 r.2{txt …}`; with no marks, `r.1`.
- A fermata, wah, hairpin and octave line stay too.
- No pick stroke or tremolo is left on the rest.
- Delete off the tab at the playback line keeps them.
- Ctrl/⌘+Delete, and Ctrl/⌘+Delete off the tab, take them with the time.
- A tempo and a section stay with a bar emptied whole.
- On the page: Delete on the note keeps them and Ctrl+Delete then takes
  them; cut on a selection keeps them.
- A half note over a rest with a text and chord name takes both; over a
  rest when the note has its own: text `"a / b"`, its own chord name kept.
- A whole note over two marked notes joins both texts.
- A paste over a marked rest: the pasted note's text joined with it, and
  the fermata moved.
- Lengthening a note with a text keeps that text once.
- A picked text on a quarter rest with the staff drawn: one line, ending
  above the rest and centred on it; one tinted rest; no note tinted. A
  chord name the same.
- Over a Whole-bar rest: the line at the word's column to the staff's top
  line; the tinted rest in the middle of the bar.
- In the tab alone: the line to the top string at the column; no tint.
- A text on a note tints no rest.
