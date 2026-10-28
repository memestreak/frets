# Tab: the clip's own line breaks and bar widths

Jeremy, 2026-10-28 (Sweet Child O' Mine thread): "As far as line breaks, layout, and spacing, what
does alphaTex support?" then "Yes, let's do that! Some of this is tracked in issue #153". Part of
issue #153; viewer-side spacing settings stay open there.

## What alphaTex has

alphaTab 1.8.4 reads three layout tags:

- `\systemsLayout (n n …)`: how many bars each line (system) holds, first line first.
- `\defaultSystemsLayout n`: bars per line past the list. alphaTab's default is 3.
- `\scale x` on a bar: its weight when a line's width is shared out. Unset means 1.
- `\width px` on a bar: an absolute width, used only by alphaTab's deprecated horizontal (one long
  line) layout. The page layout ignores it.

alphaTab's page layout with `systemsLayoutMode: UseModelLayout` (and its parchment layout) keeps each
bar's fixed parts at their natural size (clef, signatures, bar lines) and shares the rest of the line
by `\scale`, as Guitar Pro, Dorico, Finale, Sibelius and MuseScore do. A multi-bar rest is one bar
renderer, so it counts as one bar of a line and takes its first bar's scale.

## What Frets does

- The clip model holds `systemsLayout`, `defaultSystemsLayout` (on the clip) and `scale` (on a bar).
  They are read from alphaTex when their values are good (whole numbers from 1; a scale above 0) and
  written back after `\multiBarRest` and among a bar's tags. A bad value is kept as written, with a
  warning. `\width` stays kept as written ("Kept but not drawn yet").
- With neither `\systemsLayout` nor `\defaultSystemsLayout`, lines fill by width as before.
- With either, each line holds as many bars as asked (`barsPerLine` in `clip.ts`); lines past the list
  take `\defaultSystemsLayout`, or 3 when only the list is written, as alphaTab does.
- A line too wide for the width even so (a phone) wraps where it must; the rest of that line goes on
  the next, and the next listed line starts after it.
- Each full line runs to the width (`shareByScale` in `layout.ts`): its room after the bars' fixed
  parts goes to its bars by their `scale`; a bar whose share is less than its numbers need keeps what
  it needs, and the others share the rest. Within a bar, columns keep their proportions (and their
  least width, `fitColumns`).
- The last line, when it holds fewer bars than it asks for, gives its bars the line before's rate, so
  they match; a clip of one short line keeps its own room. A last line holding all its bars runs to
  the width, as Frets' last lines already do when as full as the line before.

## Not done (still in #153)

- A way to set bars per line or a bar's width from the clip itself (palette or drag).
- Viewer-side spacing settings (vertical and horizontal room).
- Track-level `\track { systemsLayout … }` is not read (Frets has one track; alphaTab uses the track's
  layout when it draws one track, the score's when several).

## Sweet Child O' Mine

The transcription in project files now carries the book's line breaks: `\systemsLayout` with each
line's bar count, read from the PDF's bar numbers at line starts, and `\scale` on the bars the book
draws wider or narrower, measured from the PDF's bar lines. The `outro-solo` example carries its
excerpt's (bars 157–165).
