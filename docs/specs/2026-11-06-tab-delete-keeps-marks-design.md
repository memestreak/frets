# Tab: Delete keeps the marks of the time it leaves

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

## How

- `editing.ts`: `restOf(column)`, the rest a Column becomes, and
  `hasTimeMarks(column)`, over one list of the time's marks.
- `clearNote` and `clearToRests` (`noteEdits.ts`) make an emptied Column
  with `restOf`; `clearToRests` builds a bar emptied whole with
  `barOfRests`, cutting it where a marked rest starts. The rewrite by the
  meter (`writeVoice`) already keeps a Column's marks where they start.
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
