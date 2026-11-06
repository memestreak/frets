# Tab: chord diagrams in the drawn clip

Issue [#242](https://github.com/memestreak/frets/issues/242), step 3 of the
chords-in-Tab build order (planning doc
https://claude.ai/artifact/R4ffGZLV63TiViD2Hj3mr5). After the Chord set
(#367) and the Chords panel (#251), the shapes a clip stores are drawn.

Status: **mocks**. The look is being picked behind `?diagram=` and
`?repeat=`; this spec is rewritten to what ships once Jeremy picks, and the
MusicXML, Guitar Pro and ASCII exports follow in the same PR.

## What

- **Chord chart.** Under the score head, every chord the music names that
  has a shape, once, its name over its diagram, as guitar books print a
  song's chords before its first line. Every track's chords together
  (Q2): the shown track's first, then the others', each in the order first
  named. Two tracks' chords of one name and shape are one. Rows centred,
  wrapping onto another row when the width runs out.
- **Diagrams over the names.** Under each chord name over the music, a
  small diagram (0.7 of the chart's size), the name over it as books print
  them. The rows under (text, wah, the staff) move down to make room, only
  on a line that draws one.
- **Which chords.** A chord whose `\chord` definition has a shape. A name
  with no definition ("E" typed, "N.C."), a definition with no strings or
  none played, and `showdiagram false` draw the name only.
- **Look.** Plain ink (Q9): no degree colours, roots not marked, no finger
  numbers (#368). A thick nut at fret 1; elsewhere the first fret named
  beside it ("5fr"), from `firstfret` when the definition gives one, else
  the shape's lowest fret. × over a string not played, ○ over an open one.
  Four frets, more for a shape that reaches further.
- **View options.** Notation's Chord chart and Chord diagrams, each on by
  default, saved in `frets.tab.notation` (`chordChart`, `chordDiagrams`)
  and listed in Settings › Tab › Notation. A clip without shapes shows
  nothing either way.
- **Exports.** The PNG and SVG image draws the chart under its head and
  the diagrams over the names, as the page does, in the export's colours.

## Mocks

- `?diagram=upright` (a): strings up and down, nut on top, as books print
  them. `?diagram=lying` (b): strings across, nut on the left, as the
  Chords page draws them.
- `?repeat=every` (a): every chord name gets its diagram.
  `?repeat=line` (b): only the first of each chord on a line (issue open
  question 2).

## Not yet

- The per-track chart (Q2's option), MusicXML `<harmony>` with `<frame>`,
  Guitar Pro diagrams, and the ASCII chord chart: after the pick.
- A column does not widen for its diagram, so two chords an eighth apart
  can touch (open question 1, with #153).

## Tests

- A definition with a shape draws, low string first, starting at its
  lowest fret (5 for A at 5 5 6 7 7 5); fret 1 for an open shape.
- No diagram for a name with no definition, "N.C.", a definition with no
  strings or none played, or `showdiagram false`.
- The chart lists every named chord with a shape once, in order first
  named, then the other tracks'; an unused definition is not in it.
- The chart wraps onto more rows when narrow.
- `repeat: every` draws every shaped name; `line` only the first of each
  chord on a line.
- The diagrams' row is there only when they are on; the tab moves down.
- The drawing draws a diagram under each shaped name and none when off.
