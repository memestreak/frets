# Tab: chord names, sections, tempo and capo

This is the second of the three "Next" PRs from the alphaTex triage
(https://claude.ai/artifact/FkNzi3PhjegeM4Aev5RsBL). The first is
`2026-10-26-tab-note-marks-design.md`. It covers what goes over the tab. These
were kept as written but not drawn; now they are drawn and can be set. Jeremy
said "proceed" on 2026-10-26. Chord names are free text, as recommended. Where
they are set is option 1 of the choice put to him: a palette group plus a field
at the spot each is drawn, and the capo beside the time signature.

## What is drawn

| Word | alphaTex | Drawn |
| --- | --- | --- |
| Chord name | `ch "Am7"` on a beat | bold, centred over its column |
| Section | `\section "Verse"`, `\section ("A" "Chorus")` on a bar | its name in a box at the bar's start; a rehearsal mark in a filled box before it |
| Tempo | `\tempo 90`, `\tempo (90 "Slowly")` on a bar | a quarter note, "= 90", then the word, at the bar's start |
| Capo | `\capo 3` | "Capo 3" over the start of the first line, its own row (changed in `2026-10-26-tab-rhythm-design.md`) |

Each gets its own row over the staff, only when the clip uses it (`rowsFor`).
From the top, the rows are: tempo, section, endings, chord names, then the note
marks' rows.

A chord name's column is at least as wide as the name. A section's box and a
tempo's hit area are sized by guessing the text's width from its length, since
the layout knows no fonts. That is why a tempo's word comes after its number:
nothing then has to be placed after text whose width is unknown.

## Setting them

- **The Text palette group:**
  - **Chord name** (key C) and **Section** belong to the cursor's column and
    bar. **Tempo** applies from the cursor's bar on.
  - Each opens a small field over the spot its word is drawn, already
    holding what is there.
  - Enter, or leaving the field, sets what was typed. An empty field clears
    it. Esc leaves it as it was.
  - After Enter or Esc, the keys go back to the tab.
- **Click to edit:** a press on a drawn chord name, section or tempo moves the
  cursor to its column or bar and opens its field. This follows his P.M. ask:
  a press on a drawn mark selects what it belongs to.
- **Tempo:** bpm, a whole number from 20 to 400, clamped, then an optional
  label: the field shows and takes "100 A little faster" (Jeremy, 2026-10-27;
  before, the label could be set only in the text), and a press on the label
  opens it too. Just a number drops the label; text that doesn't start with a
  number leaves the tempo as it was; empty clears it. The field's caption is
  "Tempo in bpm, then a label". A section's rehearsal mark is kept when its
  name changes; it is set only in the text, for now.
- **Capo:** first a raised button beside the time signature. Jeremy found it
  "very weird" (2026-10-26) and picked option 1 of three: a **Capo** tool in
  the Text group opening the same field as a tempo (1 to 12; empty or 0 takes
  it off), with "Capo 3" drawn over the first line, which a press also edits.
- Each change is one undo step.

## Reading

- `\section`, `\tempo` and `\capo` are read from alphaTab's model, but only
  where the text has the tag. alphaTab gives every score a tempo of its own,
  and that one is not read.
- A tempo outside 20 to 400, or a capo above 12, is read as the nearest value
  Frets offers, with a warning.
- Only the first tempo in a bar is read, also with a warning.
- A chord name comes from the beat's chord in alphaTab, so a `\chord`
  definition in the header names it too. The definition itself is kept as
  written.

## Free text over a beat (later, 2026-10-26)

Jeremy asked for alphaTex's `txt "..."` after chord names. It is
`Column.text`, drawn in italics, 11px, in a row of its own under the chord
names (there only when a column has text), starting just left of its
column and running right; it does not widen the column. The Text group's
"Text over this column" button (no key; T is tap) opens the same field as
a chord name, and a press on drawn text opens it there. Empty clears it.
The song-form example has one.
