# Tab: short texts under the chord names

Asked 2026-11-07 (Jeremy): "Some annotations need to be below the
chords/chord diagrams. Specifically, let ring. … The ones that we didn't
want were the things like text notes that could get really big."

The chord diagrams (`2026-11-06-tab-chord-diagrams-design.md`) moved every
free text (alphaTex `txt`) over the chord names, so a long note never
pushes a chord and its diagram off the music. That also moved short words
such as "let ring" or "P.M." away from the notes they are about.

The let ring mark itself (`lr`, the I key) was already drawn under the
names, just over the tab; this is about Texts.

## What

- **Short or long.** A text of 20 characters or fewer ("let ring",
  "P.M.", "slowly", "let ring throughout") is short; a longer one is long.
  Counted in characters, not by whether it wraps, so a text never moves
  between rows when the width changes.
- **Short texts under.** On a line with chord names, a short text goes in
  its own row under the names and their diagrams, right over the music
  (under it the wah's row, then the staff or the tab). Long texts stay in
  the row over the chord names.
- **No chord names, one row.** On a line with no chord names, every text
  shares the one text row, as before. Each line decides for itself.
- **Each row wraps and stacks on its own.** Short texts that touch stack
  inside their row as texts always have (issue #323), and the rows under
  move down to make room.
- **Picking and editing.** A press on a short text picks it where it is
  drawn; its field opens over it. A new text's field opens over the chord
  names' row.

## Tests

- 20 characters is short, 21 is long; "let ring" with no chord names on
  the line is not under.
- "let ring" with a chord and diagram: under the name and the diagram,
  over the staff, and no row over the names.
- A short text on a line with no chord names uses the over row; one with
  chord names on another line only still does.
- A long and a short text on one line: two rows; a press on the short one
  picks it in the under row; its box is under the diagram.
- Two touching short texts stack: two rows, the staff one line lower.
- The drawing puts the short text under the chord name.

## How

- `beatText.ts`: `SHORT_TEXT_LENGTH`, `textGoesUnder`.
- `layout.ts`: `Rows.textUnder` after `diagrams`; `PlacedColumn.textUnder`;
  `System.textUnderRows`; each row placed by `placeBeatTexts` on its own;
  `textRowOf` for the drawing, hit tests and fields.
