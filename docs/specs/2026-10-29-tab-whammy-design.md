# Tab: the whammy bar

Issue #216. alphaTex's whammy bar, `tb (points)`, was kept as written but not drawn, so a dive
looked like a plain held note. Seen in Stop (Jane's Addiction), the guitar solo's Gtr. 4 and Gtr. 5
(the book's pages 75–76), whose drawing this follows: Hal Leonard prints whammy bar dives as lines
under the tab.

## What is read and written

- `tb` with only its points (`tb (0 -24)`, `tb 0 -4 0`), two or more whole quarter tones, none above
  the note, is the column's whammy bar (`Column.whammy`, its points as written). Frets writes it after
  the beat's length: `15.2.2{tb (0 -24)}`. One written with a note (`15.2{tb (0 -24)}.2`) is read the
  same, as alphaTab plays it, and written back with the beat.
- Kept as written, not drawn: a pull-up (a point above the note), `tb` naming a type or style
  (`tb dive (0 -4)`), `tbe` with its own offsets, and points that aren't whole quarter tones.
- The points are spread evenly over the beat's length, as alphaTab plays them. A tied note held down
  repeats the depth: `-.2.8{tb (-24 -24)}`.

## How it is drawn (the book's look)

- A line leaves the note's number (the column's lowest, or the bottom string over a rest) and goes
  down through the tab to below it, where its depth is labelled in steps, four quarter tones a step:
  "-6" an octave down, "-1½", "-3½", "-½", with ¼ and ¾ for odd quarter tones.
- The line's points are spread over the note's length, from its number to just before the next note,
  as a bend's arrows run. Deeper dives go lower, by the square root of their depth, an octave down the
  lowest.
- A dive is a slanting line; a dip a V, its depth at the bottom; a depth held within a note a dashed
  line. A depth is labelled where the line reaches it, not again while it is held.
- A note that starts down (pre-dipped, `tb (-6 -6)`) drops dashed straight down from its number to
  its depth, labelled there.
- A note held down the whole of its length draws nothing more. The next change goes on from where the
  hold began, as the book draws it: a pre-dipped note followed by a tied note returning (`tb (-14 -14)`
  then `tb (-14 0)`) is a dashed drop, then a line climbing back to the tied note's number.
- A line held over a line break goes on from the next line's start.
- Under a staff, a tied note the bar holds down has no number, even where a bar starts (the book's
  bar 3); a tied note the bar returns to has its number, for the line to reach.
- "w/ bar" in italics with a dashed line runs over each run of neighbouring columns with a whammy bar,
  in its own row: between the staff and the tab in Both, over the tab in Tab, under the staff with the
  staff alone (which draws only this; the lines need the tab).
- The lines and labels take room under the tab; the Tab view's stems move down under them.
- Every view and export that draws the tab draws them.

## Editing

- A press on a line or label under the tab picks it (since issue #276 lit blue, Delete in its right-click menu), as bends are
  picked; on the strings a press still places the cursor.
- The Techniques group's Whammy bar button opens a panel: Dip -½ `(0 -2 0)`, Dive -2 `(0 -8)`, Dive
  and return -2 `(0 -8 0)`, Dive bomb -6 `(0 -24)`, and None. The cursor's column (or the selection)
  takes the shape. The button is lit for any whammy bar; the panel lights the shape only when it is one
  of these. Other shapes are typed in the AlphaTex view.

## Playback

alphaTab already bends the column's notes along the points, tied notes too, with a pitch-bend range
of 16 semitones; tests check a dive, a hold over a tie, a pre-dip and its return.

## On the staff (follow-up to #218)

As the book prints Stop's staff:

- A tied note going on under a whammy bar is drawn at the pitch the bar starts it at (`whammySemitones`,
  quarter tones halved toward the note), with its own accidental, and the tie becomes a straight
  line between the two pitches, as a tie into a bend does. So a dive an octave down ends on a head an
  octave lower.
- A pre-dipped note is drawn at the pitch it is dipped to, after its fret's pitch in brackets joined by a
  line, as a picked bend's starting pitch is drawn (#176).
- A dive, dip or return that no tied note goes on from draws a line from the top head through the
  pitches it reaches, over the note's length, within its bar.
- With the staff alone the depths are labelled under the staff (the tab labels them otherwise),
  pre-dips and dives into tied notes too.
- The staff's line is picked like the tab's, for the same Delete.

## Tests

`src/__tests__/tab/whammy.test.tsx` (the staff's too), `playback.test.ts` (the bends heard), the built-in arrangement
`articulations/whammy.atex`, and the "Dive" example in `public/tab-alphatex.txt`.
