# Simpler chord diagrams

Jeremy, 2026-10-06: the Chords section's small shape diagrams carried too
much detail. Of four mocked options he picked **B, colour without labels**
(mockups: https://claude.ai/artifact/W2Ko6uRSJBw6S6hxuDd63L), with the fret
number moved further from the frets.

## What changes

| Element | Before | After |
|---|---|---|
| Board | wood fill, strings of different thickness | plain lines in `--line-strong`, like a printed chord chart |
| Frets drawn | 5 | 5 (`DIAGRAM_FRETS`, from the span rule), a little narrower each |
| Nut | cream bar on the wood | `--ink` bar |
| Fret number | always, close under the board | only when the shape starts above fret 1 (the nut says fret 1), with a clear gap under the low E |
| Muted string | red × | × in `--ink-muted` |
| Open string | full dot with its label | a ring in its degree colour (square ring for the root) |
| Dots | degree colour, interval label, ring around the dot | degree colour only, no text, no ring; the root stays square |

The mockups drew four frets, because the generator then capped shapes at
four fret positions and the fifth column was always empty. Jeremy asked
for five-fret stretches too (2026-10-06), so the span limit went up to
four frets (five positions) and the diagrams draw five. `DIAGRAM_FRETS` is
computed from the span rule, so the two can't drift apart. Dots are still
larger than before (radius 8.5 against 7.5).

The search now builds one window per lowest fret and stops as soon as the
bass isn't the root, which keeps it fast with the wider window.

## The key

Without labels, a line above the Open group names the colours: one swatch
and label per chord tone, in formula order (■ R ● ♭3 ● 5 ● ♭7; a 9 takes
the 2's colour). It is `ToneKey`, shown by the Chord library. The Chord lab
leaves it out because its tone chips, right above the shapes, already show
each tone in its colour.

The big neck is unchanged: it still labels every dot of the chosen shape,
so tapping a diagram shows its intervals.
