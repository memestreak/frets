# Scale lab: one Diatonic chords card

Jeremy, 2026-10-13, thread "Scale lab chord views": "the guitar chords and
diatonic chord visualizations seem clunky together. Maybe we can make them
2 different views of the diatonic chords."

## Problem

The Scale lab had two chord cards. "Diatonic chords" drew every chord's
guitar shape in one position; "Chords in this scale" listed the same seven
chords again as cards, with the Ladder | Clock diagram under them. Both rows
selected the same chord, and Triads / Sevenths sat on the lower card while
changing the upper one.

## Options shown

Mocked up in the app (light and dark, desktop and phone):

- **A, two views:** one card with a Shapes | Ladder | Clock switch. The
  shortest page, but shapes and theory are never on screen together and
  the chord row changes form with the view.
- **B, one row, both visible:** the seven shapes are the only chord row;
  the ladder or clock sits under them in the same card. **Chosen.**
- **C, chord on the top strip:** no lower card; the scale strip under the
  title becomes the selected chord's ladder. Drops the Clock.

## Design

One card, "Diatonic chords", after "On the neck":

1. **Header:** the title, Triads / Sevenths, Arpeggio and the position's
   ‹ Frets 5–9 ›. A scale without seven notes shows only the title and the
   line saying why it has no chords.
2. **Shapes:** the seven tiles, each with its numeral above the shape and
   its name under it (`2026-10-07-scale-lab-position-shapes-design.md`).
   They are now the only chord row: the chord cards are gone. A tile's quality (minor 7,
   dominant 7) is in its accessible name and beside the heading below.
3. **Library line** (now always the hint; the link moved to the shapes'
   menu, `2026-10-18-every-tile-shapes-design.md`): "Bm7 in the Chord library →" while a chord is
   selected, otherwise "Tap a chord to see it on the neck." It replaces the
   paragraph that explained the keys under the old lower card.
4. **Over the scale:** under a hairline, a heading ("Over the scale", or
   "Bm7 over the scale" with its quality and, beside it, the tone key: the
   chord's spelling in its dots' colours, shown only while a chord is
   selected), Ladder | Clock, From the root |
   Between tones, and the diagram (`2026-10-04-chord-diagrams-design.md`).

Nothing moves when a chord is selected: the Intervals switch is always
there, switched off until a chord is picked; the library line always holds
one line; the space under a tile is as tall as its ‹ n of m › stepper; and
below desktop width the heading and key have a line to themselves (on a
phone, two lines, the key's kept empty with no chord). (The ladder still grows
upward for its brackets; it is the last thing in the card.)

2026-10-19, Jeremy: "put the chord type above the chords with the chord
name below them": the numeral moved above each shape. The tone key moved
onto the title line, then, on review, "let's just remove the chord
spelling", then "move the chord spelling to the bottom section where we
have those details (when the chord is selected)": it is beside the "Bm7
over the scale" heading.

Selection, ← → (chords), ↑ ↓ (shapes), Esc and the saved settings are
unchanged.

## Code

`DiatonicChords.tsx` is the card: the header, the ← → keys, and its two
halves, `PositionShapes.tsx` (tiles, library line; exports
`PositionStepper`) and `ChordOverScale.tsx` (was `ChordStrip.tsx`).
`Segmented` gains `disabled`.
