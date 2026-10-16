# Scale lab: the ladder's notes stay put

In the Diatonic chords card's "Over the scale" Ladder, selecting a chord
used to push the scale's notes down to make room for its interval
brackets, by up to 144 px for a seventh from the root, and the card grew
with them. Switching between "From the root" and "Between tones" moved
them again. Now nothing moves.

| | Before | After |
|---|---|---|
| Room above the notes | only while a chord is selected, as tall as its brackets | always, for three levels (the most a chord stacks: a seventh's three from the root) |
| Room under the notes | grew by a row for the chord roles | always holds the chord-role row |
| Bracket level | 22 units | 14 units |
| Interval tag | 34 × 18, 12 px text | 24 × 13, 9.5 px text |
| Bracket line | 2 units | 1.5 units |

With no chord the reserved band above the notes is empty. The ladder is
the same size whatever is selected, so the card below it holds its place
too.

Unchanged: the brackets stay above the notes (drawing them below was mocked
and not picked), the Clock and its tags, and the one-octave strip under the
Scale lab's title, which never shows a chord and keeps its height. This
supersedes the layout implied by the bracket rules in
`2026-10-04-chord-diagrams-design.md`; the rules themselves (which brackets,
their colours and stacking) are the same.

## Plan

1. `ChordLadder`: for two octaves, fix `top` at three 14-unit levels plus
   the tag's margin and the height under the tiles at the chord-role row;
   draw brackets 1.5 units wide with small tags.
2. `IntervalTag` takes `small` for the ladder; the Clock keeps the large tag.
3. Test: the ladder's viewBox and every tile's top are the same with no
   chord, with Am7 from the root and with Am7 between tones.
