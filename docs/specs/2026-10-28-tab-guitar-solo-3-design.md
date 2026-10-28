# Tab: drawing Guitar Solo 3 as Guitar Pro does

Bars 113–114 of a Guitar Pro 8 solo (Jeremy's screenshot) drawn by Frets to match, bar numbers aside.
The excerpt is the example `octave-lines` ("Guitar Solo 3").

## What it adds

- **Octave lines** (`ot 8va`, `8vb`, `15ma`, `15mb` on a beat; `Column.ottava`). The staff is written an
  octave (two for 15ma/15mb) away from the sound, under a dashed line with its label, one height across
  the line of music, past everything else on the staff. The tab and playback ignore it. Set from the
  palette's Accents group: one button opening a panel of None, 8va, 8vb, 15ma, 15mb. A press on the drawn
  line picks it; Delete removes it.
- **One slur over a legato run.** Neighbouring notes joined by hammer-ons, pull-offs or legato slides get
  one arc, on the tab and the staff, instead of one per pair; the H and P letters are gone, as in print.
- **Vibrato over a run.** Neighbouring notes with vibrato get one unbroken wave, on the staff and, when
  the staff is shown, over the tab too. On the staff every wave on a line stands at one height.
- **Ties in Both** are brackets on the tab, with no arc; Tab alone keeps its arcs.
- **Grace notes** are slashed through the stem and flag.

## Spacing, measured against the picture

In staff spaces, scaled so the two staves are the same size: a vibrato's wave 24 px over the notes
(17 over a tie or slur), the 8va line 33 over everything else, the tab's first row 26 under the
staff, and a bend's arrow 26 over the tab's top string with its label 9 over that.

Along the line (Jeremy's pick, 2026-10-28): each note stands at the start of its room, its number
starting the room, and twice as long takes √2 as much room (a quarter 56, a sixteenth 28, as before).
The cursor, selection, loop and playhead cover a note's room from its start.
