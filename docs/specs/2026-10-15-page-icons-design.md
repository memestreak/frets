# Page icons

Jeremy, 2026-10-15: the home page should have small graphics for the
tools. Of three mocks (cropped screenshots, small live drawings made with
the app's own fretboard, circle and chord diagram, and icon tiles) he
asked for the art much smaller and preferred the icon tiles. He also asked
for the quizzes at the bottom.

## The icons

Each page's card carries a 56px icon left of its title and summary: a
pictogram on the rosewood tile of the brand mark (`BrandMark`), drawn from
the board and degree tokens, so it follows the theme like the mark does.

- Interval trainer: a square root dot and a quiz dot, joined by a dashed
  line, on a few strings and frets.
- Note trainer: one quiz dot with a "?".
- Scale lab: A minor pentatonic in two frets per string, its dots in the
  degree colours.
- Circle of fifths: twelve dots round a ring, the key at the top in the
  root colour and its neighbours in the fifth colour.
- Chords: an upright chart of open Am7 (x 0 2 0 1 0), the mark's layout,
  with a square ring for the open root.

The icons are decoration (`aria-hidden`): the card's title and summary
already name the page. They appear wherever `PageList` draws the cards,
so on the Practice and Explore index pages as well as the home page.

Screenshots and live drawings were turned down: at this size neither
reads, screenshots go stale whenever a page changes, and the live
drawings pulled the chord library into the home page.

## Order

The sections run Explore, Chords, Practice. `SECTIONS` sets the order
for the home page and the menu alike, so the two stay the same.

## How

- `src/components/PageIcon.tsx`: `PAGE_GLYPHS` maps each card's href to
  its pictogram in the tile's 96-unit viewBox; `PageIcon` draws the tile,
  or nothing for an href with no pictogram.
- `PageList` puts `PageIcon` beside each card's text.
- A test checks every card the home page draws has a pictogram, so a new
  page can't ship without one.
