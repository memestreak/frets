# Tab: the end of the outro solo, bars 170–181 (Sweet Child O' Mine, round 10)

Jeremy, 2026-10-28: the tenth and last round of drawing Guitar Pro's "Sweet Child O' Mine" near
identically (see `2026-10-28-tab-sweet-child-intro-design.md` for round 1 and the rules on
copyrighted music, and `2026-10-28-tab-sweet-child-outro-design.md` for round 9). This round is page
10 of the book, bars 170–181: the outro solo's last bends under the wah, then the song's end in free
time, a slide down the A string to a low E held under fermatas.

## What the book prints that Frets didn't

- **Free time.** From bar 176 the band stops keeping time. The book writes "Free time" in italics
  over the chord names, shows the time signature again in brackets, "(4/4)", and dashes the bar lines
  from there to the last bar, which closes with the usual thick final line. Frets kept alphaTex `\ft`
  as text it doesn't draw. Now a bar in free time (`Bar.freeTime`) is read and written back, and:
  - its closing bar line is dashed, on the staff and the tab (unless it is the last bar, a repeat's
    end or a double bar, which keep their own lines);
  - the first bar of a run of free bars (`startsFreeTime` in `clip.ts`) shows its time signature in
    Bravura's brackets, as tall as the staff (or the tab, alone), with room made for them;
  - and "Free time" is written over that bar in italics, in the tempo's row (over the chord names),
    after the bar's tempo when it has one.
  A multi-bar rest never runs into, across or out of free bars. A clip whose first bar is in free time
  says "Free time" but draws its opening time signature without brackets. Playback keeps the time.

- **Fermatas.** The last two bars hold a low E under a fermata each. Frets kept alphaTex `fermata` as
  text it doesn't draw. Now a column's fermata (`Column.fermata`: short, medium or long, Bravura's
  three shapes) is read and written back as `fermata medium` (the length alphaTab may carry, as in
  `fermata (medium 2)`, is dropped: Frets doesn't play it). It is drawn over the staff, over everything
  else in its column and clear of the bar number, and over the tab in a row of its own when the tab is
  alone. A press picks it and Delete removes it; no palette button sets it. Playback ignores it.

Everything else on the page Frets already draws: bends with vibrato, held and let down onto pull-offs
(bars 170–171), quarter-note triplets, a tied bend let down onto a note on the next string (bar 172),
grace notes bent and let down (bar 173), pre-bends let down (bar 174), a held pre-bend with vibrato
(bar 175), long vibrato over slides (bars 176–177), a slide carried over the line break (bars 177–178),
a slide in from below with an accent (bar 179), a held half bend pulled off to the open string
(bars 179–180) and a tie over the last bar line.

## Not the same as the book, for later

- **A bend's curve** runs the whole length of a long note in the book (bar 170's dotted half);
  Frets draws every bend's rise the same short length.
- **A pre-bend's label** is "PB full" / "PB ½" in Frets, "full" / "½" in the book (bars 170, 174, 175).
- **A held half bend's pitch** on the staff: the book brackets the fretted pitch, Frets the bent one
  (bar 179; issue #176).
- **Line breaks** (issue #153): the book fits bars 178–181 on one line, Frets wraps bar 181.
- The issues of earlier rounds.
