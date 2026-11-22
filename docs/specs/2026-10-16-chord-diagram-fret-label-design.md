# Chord diagrams: always label the starting fret

Every small chord diagram (the Chords page, the Scale lab's Diatonic chords
card, and the PNG an export copies or a drag carries, all drawn by
`ChordDiagram`) changes in two small ways.

| | Before | After |
|---|---|---|
| Starting fret number | only when the shape starts above fret 1; the nut stood for fret 1 | always, under the first column, `1` included, at 9 units (was 11); the nut is still drawn |
| × on a muted string | 12 units | 15 units, same muted colour |

Since `docs/specs/2026-11-22-chord-export-background-design.md` the number
is 12 units with its baseline 19 under the board, the band under the board
23 units (was 28), and × 18 units.

The band under the board that holds the number was already reserved on
every diagram, so a diagram with `1` under it is the same size as before
and nothing moves. This supersedes the "Fret number" row of
`2026-10-06-simpler-chord-diagrams-design.md`.

The neck's own × (`Fretboard`'s `mutedStrings`) is unchanged: it is already
18 units and bold.
