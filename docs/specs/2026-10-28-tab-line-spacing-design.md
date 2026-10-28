# Tab: each line only as tall as what it draws

Jeremy, 2026-10-28, with only the tab shown: "There's way too much vertical
white space between the tab and annotations above it."

## Why

Every line of a clip had the same rows: the rows any line used (chord names,
text, a section, a tempo, the wah, P.M., vibrato...) and the room for bend
arrows were left over every line. A solo with a bend in its second line left
54 units of blank space over its first, between the chord names and the tab.
The notation staff did the same with its room for high notes and ledger lines.

## What changes

- Each line (system) works out its own rows from its own bars (`rowsFor` on
  `lineClip`), and its own staff reach. A line with no bends has no bend room;
  a line with no chord names has no chord row. The capo's row is on the first
  line only.
- Lines stack one under another: `System.rows` and `System.top`; the layout's
  height is their sum. `lineAt(layout, y)` finds the line under a press, for
  every hit test.
- A bend's label is treated as a row of its own: its baseline sits one
  `ROW_GAP` under the row before it (where a first row would sit when there is
  none), with the arrow's rise under it. That trims 4 units from every line with
  bends.
- Exports, the playhead, the loop bracket, word fields and panels follow, as
  they read the same layout.

Lines of one clip no longer line up row for row; printed guitar books and
Guitar Pro space each line by what it carries, too. This replaces "every line
of tab in a clip has the same rows" in the note marks spec.
