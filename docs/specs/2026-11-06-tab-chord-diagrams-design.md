# Tab: chord diagrams in the drawn clip

Issue [#242](https://github.com/memestreak/frets/issues/242), step 3 of the
chords-in-Tab build order (planning doc
https://claude.ai/artifact/R4ffGZLV63TiViD2Hj3mr5). After the Chord set
(#367) and the Chords panel (#251), the shapes a clip stores are drawn.

Picked 2026-11-06 from mocks (Jeremy): upright diagrams as books print
them, and a diagram under every chord name, or none.

## What

- **Chord chart.** Under the score head, every chord the music names that
  has a shape, once, its name over its diagram, as guitar books print a
  song's chords before its first line. Every track's chords together
  (Q2): the shown track's first, then the others', each in the order first
  named. Two tracks' chords of one name and shape are one. Rows centred,
  wrapping onto another row when the width runs out.
- **Diagrams over the names.** Under every chord name over the music, a
  small diagram (0.7 of the chart's size), the name over it as books print
  them. Free text goes over the chord names, so a chord and its diagram sit
  right over the music (Jeremy, 2026-11-06). The rows under (wah, the
  staff) move down to make room, only on a line that draws one.
- **Picked with its name.** A press on a diagram picks its chord name: both
  drawn in the selection's blue. A chord belongs to its time, not to the
  notes there (Jeremy, 2026-11-06, as Dorico has it): no notes are
  tinted, and its dashed Attachment line runs from under the diagram (or
  the name) to the top staff's top line at its time, over notes or a
  rest alike. Its only link to notes is the Chords panel's Insert. A double-click opens the chord editor
  in the Chords panel, as a double-click on the name or in the list does;
  so do Edit and Enter.
- **Which chords.** A chord whose `\chord` definition has a shape. A name
  with no definition ("E" typed, "N.C."), a definition with no strings or
  none played, and `showdiagram false` draw the name only.
- **Look.** Upright: strings up and down, low E on the left, the nut on
  top. Plain ink (Q9): no degree colours, roots not marked, no finger
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
  MusicXML writes each shaped chord's `harmony` with its diagram as a
  `frame` (six strings, its frets, `first-fret` past fret 1, a
  `frame-note` per string played, string 1 the high e), whatever the View
  options: it is data, and the reading program decides what to show.
  Guitar Pro already carried each track's `\chord` shapes as its diagrams
  (alphaTab's exporter), now tested.
- **ASCII chord chart.** ASCII Tab's View option Chord chart (on by
  default, `frets.tab.ascii` `chords`, and in Settings › Tab › ASCII Tab)
  writes the chart after the head, one chord a line, its name and then its
  frets low E first, x for a string not played ("C  x32010"); a fret of 10
  or more joins them with dashes ("x-x-12-14-15-14"). The reader skips
  these lines. Copy and Export's ASCII follow it.

## Not yet

- The per-track chart (Q2's option): the chart shows every track's chords.
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
- Every shaped name draws its diagram, a chord used twice on a line twice.
- A press on a diagram picks its chord name; the name's box takes in the
  diagram, and its Attachment line starts under it.
- A picked chord tints no notes and no rest; its line ends on the top
  staff's top line (the staff in Both, the top string in Tab) at its
  column's x, over notes or a rest.
- Free text is over the chord names.
- The diagrams' row is there only when they are on; the tab moves down.
- The drawing draws a diagram under each shaped name and none when off.
- MusicXML: A at 5 5 6 7 7 5 has frame-strings 6, frame-frets 4,
  first-fret 5 and notes 1:5 … 6:5; C has no first-fret and no note on
  string 6; E (no shape) has no frame. Every built-in stays valid
  MusicXML 4.0.
- Guitar Pro read back keeps A 5 5 6 7 7 5 and Gtr II's D.
- ASCII: "A  577655", dashes past fret 9, off by default in `writeAscii`,
  and a file with the chart reads back with its bars.
