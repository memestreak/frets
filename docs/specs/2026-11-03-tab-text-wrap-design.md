# Tab: a long Text over a column wraps (issue #323)

Text over a column (the Text group's "Text over this column", alphaTex
`txt "..."`) was drawn on one line, running right from its column. It
made no room for itself, so a long text ran into the next column's text,
or past the line's end, and the two overprinted. The test arrangements of
PR #322 dodged it with wide bars of eighths.

Jeremy picked wrapping (2026-11-03), over moving a colliding text up a line
(Dorico's and MuseScore's way) and over spreading the columns under it (the
way lyrics make room). The music's spacing stays as it is; the text grows
down instead. Wrapping alone left a text between close columns (neighbouring
eighths) one word a line, so he then picked (same day) a least width, and
moving a text that still touches the one before it up, as Dorico does.

He also asked for the Text field to take longer text: it stopped at 40
characters, as a chord name's does.

## What is drawn

- A text still starts just left of its column (`BEAT_TEXT_INSET`) and runs
  right. Its room ends 8px (`BEAT_TEXT_GAP`) before the next text on the
  same line starts, or at the drawing's right edge when no text follows it
  there (a short last line isn't run to the width, so its end is not used).
- The room is never less than 100px (`BEAT_TEXT_MIN_ROOM`), about 18
  characters.
- When it is wider than its room, it breaks at its spaces into lines, each
  as long as fits (`wrapBeatText`). A word wider than the room is never
  split: it takes a line of its own, and may still reach past its room.
  The words are drawn as typed.
- A text that, wrapped, still reaches within 8px of the start of a text
  before it on the same level moves up a level, away from the music
  (`placeBeatTexts`). Each text takes the lowest level where it clears the
  texts already there, so a later text that clears goes back down. A level
  is as tall as its tallest text; each text starts on its level's top row.
- Each text row is 13px (`BEAT_TEXT_LINE`) under the one before. The text
  row's top stays where it was, so the chord names over it don't move; the
  text rows past the first push everything under them down: the wah's row,
  the notation staff and the tab. Rows over it (tempo, section, endings,
  chord names) don't move. Only the line (system) holding them grows.
- How wide a text is stays a guess from its length (5.6px a character), as
  the layout knows no fonts, so a line may end a little short of its room.

## Picking and editing

- A press on any of a wrapped text's lines picks it; its box (the blue pick,
  the right-click menu's place) covers all its lines and is as wide as the
  widest.
- The Text field takes up to 200 characters. Other words' fields keep 40.

## Exports

- PNG and SVG are drawn by the same code, so they wrap the same way, at the
  export's width.
- ASCII tab carries no text, as before. MusicXML and Guitar Pro keep a text
  as one string; the program that opens them lays it out.

## How

- `beatText.ts`: the text's size, `beatTextWidth`, `wrapBeatText`.
- `beatText.ts`: `placeBeatTexts` wraps and stacks one line's texts.
- `layout.ts`: `layoutClip` places each line's texts once its columns are
  placed (into `PlacedColumn.textLines` and `textTop`, and
  `System.textRows`); `rowsFor` takes `textRows` and grows the text row by it.
- `layoutText.ts`: `textBox` and `textAt` use the wrapped lines.
- `TabClip.tsx`: one `<text>` per text, a `<tspan>` per line; a line keeps
  its trailing space, so the text reads and copies as typed.
- `WordField.tsx`: the Text field's `maxLength` is 200.

## Tests

`src/__tests__/tab/beatText.test.ts` and `page/editing.test.tsx`:

- A text that fits keeps one line; a long one breaks at spaces into lines no
  wider than the room, each as long as fits, and joined back is the text.
- A room narrower than any two words gives a word a line; a word wider than
  the room is never split.
- A text never wraps to less than 100px, even with the next text close.
- A text that still touches the one before it moves up a level, over all
  of that text's rows; a later text that clears goes back to level 0; a
  level is as tall as its tallest text; a line without texts takes one row.
- On neighbouring eighths, the second text goes up and the long one is
  drawn under it, and a press on each picks its own.
- In a clip, a text wraps before the next text on its line; the last text on
  a line wraps at the drawing's right edge; a column with no text has no lines.
- Rows under the text row (the wah's, the tab, the notation staff) move
  down 13px per extra text row; the text row itself doesn't; only the line with
  the long text grows.
- A press on a wrapped text's last line picks it, under it doesn't; its box
  covers every line and stops before the next text.
- The Text field's `maxLength` is 200.
