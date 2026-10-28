# Tab: the clip's own line breaks

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

- The clip model holds `systemsLayout` and `defaultSystemsLayout`. They are read from alphaTex when
  their values are good (whole numbers from 1) and written back after `\multiBarRest`. A bad value is
  kept as written, with a warning.
- The clip's breaks are a view option (Jeremy, 2026-10-28: "Can we optionally use the book's line
  breaks (perhaps a view option that defaults to false)?"): View options → Notation → "Clip's line
  breaks", off by default and saved per viewer (`lineBreaks` in `frets.tab.view`). Off, or with
  neither tag, lines fill by width as before; the clip keeps its tags either way and writes them back.
  `laidOut` in `viewOptions.ts` gives the page and the exported images the clip as laid out.
- With the option on and either tag, each line holds as many bars as asked (`barsPerLine` in `clip.ts`); lines past the list
  take `\defaultSystemsLayout`, or 3 when only the list is written, as alphaTab does. A multi-bar rest
  counts as one bar.
- A listed line too full for the width is squeezed, no column below what its numbers (and on the staff
  its heads and accidentals) need; only when even that doesn't fit (a phone) does it wrap, and the next
  listed line starts after it.
- Each full line runs to the width with Frets' own spacing (`spreadLines` in `layout.ts`): its room
  after the bars' fixed parts goes to its bars in proportion to the room their notes take, as lines
  filled by width are spread. A short last line is spread at the line before's rate; a clip of one
  short line keeps its own room.
- `\scale` and `\width` are kept as written but not used. The first version shared each line by
  `\scale` as Guitar Pro does (even shares unless a bar says otherwise); Jeremy found Frets' spacing
  better ("I feel like our spacing was superior"), so bars are spaced by their notes.

## Not done (still in #153)

- A way to set bars per line from the clip itself (palette or drag).
- Viewer-side spacing settings (vertical and horizontal room).
- Track-level `\track { systemsLayout … }` is not read (Frets has one track; alphaTab uses the track's
  layout when it draws one track, the score's when several).

## Sweet Child O' Mine

The transcription in project files now carries the book's line breaks: `\systemsLayout` with each
line's bar count, read from the PDF's bar numbers at line starts. The `outro-solo` example carries
its excerpt's (bars 157–165).
