# Tab: a printed score's header and lines (Sweet Child O' Mine, round 1)

Jeremy, 2026-10-28: round-trip the whole of Guitar Pro's "Sweet Child O' Mine" (10 pages, 181 bars)
through the Tab page, section by section from the top, so that Frets draws it near identically and
plays it right. The full transcription stays in the project's files, never in this repository; groups
of up to 12 bars may be committed as examples or test fixtures. This round is the header and the
intro, bars 1–24.

## What the book prints that Frets didn't

- **Credits under the title.** `\artist`, `\words` and `\music` were kept but not drawn. Now the page
  prints, under the title, the artist and then "Words & Music by …" when one set of people wrote
  both, else "Words by …" and "Music by …". The image the Export dialog makes prints them under its
  name. They stay in the clip's header as written (`credits.ts` reads them from there).
- **The tuning.** "Tuning D# G# C# F# A# D#" under the title becomes the book's block: "Tune down 1/2
  step" (or "1 step", "1 1/2 steps", "up …") when every string is tuned alike, then each string as
  ① = E♭ … ⑥ = E♭ in two columns of three, flats for strings tuned down and sharps for strings tuned up.
  With strings tuned apart (drop D) there is no heading and only the retuned strings show (⑥ = D).
  The exported image prints the block too.
- **The staff of a tuned-down guitar.** Guitar books write music for a guitar tuned down as it is
  fingered, as if in standard tuning: the intro's 12th fret on the fourth string is written D in G
  major, though it sounds C♯. Frets now does the same when all six strings are tuned alike
  (`writtenStrings`); with strings tuned apart (drop D) the staff is written as it sounds, as before.
  Playback always sounds the real tuning. Notes entered on the staff are read the same way.
- **Bar numbers**, small over each bar's top line at its start, as Guitar Pro prints them.
- **Beams of four eighths.** In 4/4, two beats of plain eighths in the same half of the bar are
  beamed as one group of four, as the book has them; sixteenths, dotted notes and tuplets are still
  beamed by the beat, and other time signatures by the beat.
- **Lines run to the full width.** Every line but the last is spread to the width, the extra room
  going to the columns in proportion to their room (each note keeps its place near the start of its
  room, as in `2026-10-28-tab-guitar-solo-3-design.md`). The last line spreads as much as the line
  before it, never past the width, so its bars look like theirs.

## View options

Jeremy asked for a place to choose what the drawing shows that is the reader's choice rather than
the music's. An eye button on the clip's top row, before copy and save, opens a
small panel under it. Its first option is **Bar numbers: Every bar | Each line | None**, starting on
Every bar (his choice: every bar, as the PDF shows). The second is **Size**, 50% to 200% in steps of
10% (his ask), starting at 100%: a small number field with up and down buttons (a typed size goes to
the nearest step; a double-click on its row puts it back to 100%, as Speed's does). The drawing and
everything over it (the playhead, fields, panels, presses) is zoomed, and laid out that much wider or
narrower, so at 70% the intro fits four bars to a line as the book does. The text views keep their
size. A choice applies at once; a press elsewhere, Esc,
a scroll or the button again closes the panel. The options are saved per viewer
(`localStorage["frets.tab.view"]`), not in the clip, like Staff | Tab | Both, and copies and exports
follow them.

Every view has the eye button (Jeremy, 2026-10-28: "All view options should always be available,
but segmented by view type"). The panel always lists every view's options, each under its view's
name, whichever view shows:

- **Notation**: Bar numbers and Size, as above.
- **ASCII Tab**: **Rhythm**, a check box, on by default. Off, the ASCII text leaves out the rhythm
  line (w h q e s…) over the strings; its copy, its save and the Export dialog's ASCII download follow.
- **AlphaTex**: **Line numbers**, a check box, on by default. Off, the editor's margin keeps only
  its ⚠ marks.

## Not yet (listed for later rounds or a question)

- Spacing of the drawing's parts, vertical and horizontal, set by the reader: its own feature
  request, issue #153.
- The tempo is printed "Medium Rock ♩ = 122" (the words first, bold), and the section as a boxed
  letter and bold name without a box; Frets keeps its own drawing of both until Jeremy chooses.
- Beams slant with the notes in the book; Frets draws them flat.
- The double bar at the end of bar 24, before section B.

## Example

`tuned-down`, "Sweet Child O' Mine (intro)": bars 1–8 with the credits, the E♭ tuning and the D5
over beat three of bar 7.
