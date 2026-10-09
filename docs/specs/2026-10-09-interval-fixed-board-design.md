# Interval trainer: the board keeps its size

Changing the fret range (Lowest fret, Highest fret) used to redraw the board
with only those frets. The board fills the card's width, so a narrower range
made every fret wider and the board taller.

Now the Interval trainer always draws frets 0 to 15, like the Note trainer,
the Scale lab and the Chords pages. The fret range only decides which frets
are in play:

- Frets outside the range stay drawn but are washed with the page surface
  colour at 60% (`BOARD.shade`), clipped to the board's rounded fill; their
  fret numbers are faded.
- They take no taps and keyboard focus does not reach them. Hint dots,
  questions and answers stay inside the range, as before.
- The range itself is now 0 to 15 (it was 0 to 24), at least three frets
  wide as before. A saved range above 15 is clamped by the parser.

`Fretboard` gains an `inPlay` prop (`{ from, to }`) for this. Without it,
every drawn fret is in play.

The Note trainer is unchanged: it already draws 0 to 15 whatever its range,
and by its own spec never draws the range.

This amends `2026-10-01-interval-ranges-design.md`, where the window was
0 to 24 and the board drew only the window.
