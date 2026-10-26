# Tab note marks

Jeremy, 2026-10-26, after the alphaTex triage
(https://claude.ai/artifact/FkNzi3PhjegeM4Aev5RsBL): "Lets address all of the
'next' features." This is the first of three PRs. It draws the note marks the
triage put first. Until now these were kept as written but not drawn. The
second PR covers what goes above the tab (chord names, tempo, section, capo),
and the third covers rhythm (grace notes, tremolo picking, tuplets of 5 to 7).

## The marks

| Mark | alphaTex | Drawn | Palette, key |
| --- | --- | --- | --- |
| Let ring | `lr` | "let ring" then a dashed line over the run of columns, with an end tick (as P.M.) | Techniques, L |
| Ghost note | `g` | the number in brackets, "(5)", "(x)"; no arc | Techniques, G |
| Accent | `ac` | ">" over the column | Accents, A |
| Heavy accent | `hac` | "^" over the column | Accents, A (second press) |
| Staccato | `st` | a dot over the column, under an accent | Accents, S |
| Wide vibrato | `vw` | a taller, longer wave, in a heavier line | Techniques, V (second press) |
| Slide out down / up | `sod` / `sou` | a short line after the number, going down or up | Joins, `\` (down, then up) |
| Pinch harmonic | `ph` | "P.H." over the column; the number stays plain | Techniques, N (second press) |

The palette's buttons each set one kind, and pressing a button again clears
it. A key that has more than one kind (V, N, A, `\`) steps through its kinds
and then clears, starting from the cursor's note. With a selection, every
note in it gets the same kind.

Palm mute, let ring, accents and staccato are per note in alphaTex but drawn
once per column, so their buttons and keys mark every note in the cursor's
column, wherever the cursor is in it. A button shows pressed only when every
note in the column has the mark. Jeremy found that palm mute could not be
turned off on a chord. With the cursor on a string the chord leaves empty,
the button did nothing, and a column muted on some notes still drew its
P.M. line. The vibrato wave is drawn once per column too, but it stays per
note: it is a sound, not a line over the column.

**Ghost note or tie.** Both print a fret in brackets. A tie now always has its
arc from the note before, even across a held chord (it used to drop the arcs
when more than two strings were tied), so brackets without an arc mean a
ghost note. The agent guide says so.

## Rows above the staff

Each mark that stands over the staff has a row of its own, so marks never
collide (an accented strum, a pinch harmonic with vibrato). The rows are
there only when the clip uses them, top to bottom:

1. endings (and repeat counts other than 2)
2. strokes
3. let ring
4. palm mute
5. "P.H."
6. vibrato
7. accents and staccato

The staff moves down to make room. Every line of tab in a clip has the same
rows, so the lines look alike. A clip with none of these marks is shorter
than before, since its rows used to be there regardless. `rowsFor` in
`layout.ts` works this out; drawing, hit testing and the exported image all
read it. The second PR adds its rows (section, chord names) the same way.

## Model

`Note` gains `letRing`, `ghost`, `staccato` (booleans), `accent`
(`'normal' | 'heavy'`) and `slideOut` (`'down' | 'up'`). `vibrato` becomes
`'slight' | 'wide'`, and `harmonic` becomes `'natural' | 'pinch'`. With no
users yet, a saved clip in the old shape is dropped, not migrated.

ASCII has no spelling for these marks. Wide vibrato is written `~` like
vibrato, a pinch harmonic as a plain fret, and the others are left out.

## Also fixed

The kept-but-not-drawn list called a bar's `\ac` an accent. As a bar tag,
`\ac` is a pickup bar, and the list now says so.

## Examples

Three new examples: Accents, ghost notes and staccato (`accents`), Let ring
(`let-ring`), and Pinch harmonics, wide vibrato, slides out (`lead`). The
agent guide's section 3 lists the marks, its checklist says how to read
them from a picture, and its examples gain one that uses them.

## Pressing the drawing

Jeremy, 2026-10-26: "When I click on the palm mute annotation, it should
highlight the associated fretting … click on the palm mute and then disable
it." And: "clicking in an area in the clip, other than the tablature itself,
should not highlight the tablature."

- A press on a P.M. or let ring line, on its label or its dashes, selects
  every column of the run. The run counts across bars and lines of tab
  (`runAround`). The cursor goes to the run's first marked note, so the
  mark's button shows pressed, and one press of it, or of M or L, turns the
  whole run off.
- A press lands on the tab only on the staff of a bar: between 10 units
  above the top string and 10 below the bottom one (the cursor's band).
  Marks over the staff, the rhythm under it, and the space past the last bar
  are blank space. A press there takes no focus, and if the editor had the
  cursor or a selection, they go, as with Esc.
