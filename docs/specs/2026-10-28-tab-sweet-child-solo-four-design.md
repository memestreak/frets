# Tab: the rest of Guitar Solo 3's first half (Sweet Child O' Mine, round 6)

Jeremy, 2026-10-28: the sixth round of drawing Guitar Pro's "Sweet Child O' Mine" near identically
(see `2026-10-28-tab-sweet-child-intro-design.md` for round 1 and the rules on copyrighted music, and
`2026-10-28-tab-sweet-child-solo-three-design.md` for round 5). This round is page 6 of the book, bars
119–130 of Guitar Solo 3: half-step bends held over the bar line and let down, grace notes bent up, and
four bars of sixteenths under a wah pedal.

## What the book prints that Frets didn't

- **The wah's + and o.** Bars 127–130 print a "+" (pedal closed) or an "o" (open) over many beats,
  in a row of their own over the chord names. alphaTex writes them as the beat effects `wahc` and
  `waho`; Frets kept them as written but drew nothing. Now a column's `wah` is read and written, and
  drawn as a small "+" or circle in that row, in every view and in exports. The Techniques palette has
  a Wah button that steps the cursor's column (or the selection) through closed, open, then off, its
  icon showing the column's sign; a drawn sign is picked like any mark, lights the Wah button, and
  Delete takes it off. Playback doesn't sound the wah, as alphaTab doesn't.
- **A bracket under every tuplet** (issue #179). The book brackets triplets that a beam joins too
  (bars 117, 128, 129). Jeremy, 2026-10-28, reversing his 2026-10-26 rule: bracket them all, on the
  staff and on the tab alone.
- **A let-down note that slides out is named.** In bar 120 a full bend on the 1st string is held and
  let down, and the let-down note slides out downward; the book names it "(15)" before the slide's line.
  Like a pull-off from it (round 3), a slide out of a let-down note now keeps its number.

## Not the same as the book, for later

- **When a bend reaches its height.** A grace note bent up in bar 122 reaches its half step at once,
  the book drawing a straight arrow and a dashed line to the bar's end; in bar 126 it rises over the
  note. alphaTex keeps no timing for a bend, so Frets draws both alike (as rounds 3–5).
- **A bend's starting pitch in brackets on the staff** (issue #176), and the issues of earlier rounds.
