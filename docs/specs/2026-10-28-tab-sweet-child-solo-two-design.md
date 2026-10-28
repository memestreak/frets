# Tab: a printed score's second solo (Sweet Child O' Mine, round 4)

Jeremy, 2026-10-28: the fourth round of drawing Guitar Pro's "Sweet Child O' Mine" near identically
(see `2026-10-28-tab-sweet-child-intro-design.md` for round 1 and the rules on copyrighted music, and
`2026-10-28-tab-sweet-child-solo-design.md` for round 3). This round is the end of Chorus 2, Guitar
Solo 2 and the start of Chorus 3, bars 77–100, page 4 of the book. Chorus 2's end repeats what round 2
drew and Chorus 3's start draws as the book does; the solo needs what follows.

## What the book prints that Frets didn't

- **Mordents.** Bar 93 has an upper mordent (alphaTex `umordent`; a lower one is `lmordent`), the
  short wavy sign over the note. Frets draws Bravura's sign (ornamentShortTrill, and ornamentMordent
  for a lower one) over the staff, at the vibrato's height on its line, and over the tab in the
  vibrato's row, as the book does. The Techniques palette has Mordent and Lower mordent buttons; each
  sets its kind on the column or takes it away, a drawn sign is picked like any mark, and Delete takes
  it off. Playback plays it: alphaTab's generator sounds the note, the one a step above (or below) and
  the note again.
- **A let-down note where a bar starts is named.** A released bend's note has no number within a bar
  (round 3), but at the start of a bar it is drawn in brackets with the arrow coming down to it
  ("(7)", bar 88), as a tied note is.
- **A tied note within a bar, under a staff, is named when a slide or pull-off leaves from it** ("(10)
  ⟍ 8", bar 92), **or under a mordent** ("(7)", bar 93). Otherwise it is left out, as before.

## Not the same as the book, for later

- **Dead notes.** The book prints a muted note as a capital X; Frets draws a small x.
- **A slur from one string to another.** Bar 80's last note (1st string) slurs into bar 81's first (2nd
  string), as bar 48 into bar 49; alphaTex can't say it.
- **Straight and curved bend arrows, and line breaks**, as in round 3.
