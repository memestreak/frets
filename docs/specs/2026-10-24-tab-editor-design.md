# Tab

A new tool, `/tab`, for writing guitar tablature worksheets to print and
teach from: a title, then numbered examples, each a few bars of tab with
rhythm stems under it, its playing techniques marked, and chord diagrams
beside it if wanted. Asked for by Jeremy on 2026-10-24, who settled each
choice below on decision cards in the "Brainstorm guitar tablature editor"
thread; details he left open are marked as defaults. Mock:
`/mnt/project-files/tab-editor/tab-mock.png`, option A.

## Choices Jeremy made

- **For:** printed sheets for practice and teaching (not quick notes, not
  playback).
- **Input:** typing on the tab with the keyboard, no neck to tap; and
  conventional ASCII tab in, from a paste, a file, a drop or a link
  (2026-10-25).
- **Rhythm:** stems and beams under the tab now. The data carries pitch and
  duration, so a standard staff above the tab can come later.
- **A sheet** is a worksheet: title, subtitle, numbered captioned examples.
  Song sections and repeats come later; a one-example sheet is a single
  riff.
- **Techniques:** the full set below.
- **Saving and output:** sheets kept in the browser with a list; Print /
  Save as PDF; save and open a `.json` file; copy, download or drag out an
  example as PNG or SVG (the chord export pipeline); copy it as ASCII tab.
- **ASCII alongside (2026-10-25):** the sheet's ASCII tab shown live under
  the paper while editing; a rhythm line above the strings carries
  durations, and without one the import guesses them from the spacing.
- **The use case behind it (Jeremy):** hand Claude a screenshot of tab, get
  back a Frets link that opens it as a sheet to edit.
- **Layout A:** the printed page is the editor. What you see is what
  prints.

## The page

- **Header**, as on the Chords page: the title "Tab" on the left; on the
  right the **Sheet** dropdown (labelled from the top; lists this
  browser's sheets, then New sheet), a **⋯** menu (Rename, Duplicate,
  Delete, Save file…, Open file…, Paper: Letter / A4) and **Print**.
- **Toolbar** under the header, one fixed-width row: Duration (1, ½, ¼, ⅛,
  1/16), dot and triplet, the techniques, and the bend amount (full, ½,
  release). Its buttons show the cursor column's state and toggle it; each
  mirrors a key, named in the button's 1-second hover tip. Nothing in it
  changes width. On narrow screens it scrolls sideways.
- **The paper** below: a white page, Letter by default (Jeremy may pick A4
  in ⋯), centred, scaled to fit the width on small screens. On it the sheet
  title and subtitle (edited in place; the subtitle is free text such as
  "A minor pentatonic, 5th position · ♩ = 90"), the examples, and a faint
  "+ Add example" after the last, which does not print.
- **An example:** "1." and its caption (edited in place), the tab, and any
  chord diagrams to its right. Its menu (right-click, long press or
  Shift+F10 on it, like the chord shapes): Time signature (4/4 default, 3/4,
  2/4, 6/8, 12/8), Add chord…, Copy as PNG, Copy as SVG, Copy as ASCII,
  Export options…, Move up, Move down, Delete example. With a mouse an
  example also drags out as its PNG, as a chord diagram does; a press that
  doesn't move is still a click on a column.
- **ASCII panel** under the paper: the whole sheet as ASCII tab (format
  below), in `--font-mono`, updated as you type, with Copy. Read-only for
  now; editing it, with changes flowing back to the page, is a later slice
  (Jeremy, 2026-10-25). It does not print. Its height follows the text, so it never
  scrolls inside itself.
- **Tab drawing:** six lines, "TAB" and the time signature at the start of
  the example's first line, bar lines every full bar, a final double bar.
  Columns are spaced by duration. An example too wide for the page wraps
  onto further lines at bar lines. Stems and beams under the bottom
  string: beamed by beat, a half note a short stem, a whole note none, a
  rest its usual sign in the stem band.
- **Cursor:** a soft `--primary-soft` band behind the cursor column and a
  `--primary` box round the cursor's string. Neither prints. Nothing moves
  when the cursor moves, and the paper has no browser focus outline.

## Keys (defaults)

While the paper has focus:

| Key | Does |
| --- | --- |
| 0–9 | Fret on the cursor's string. Two digits within a second make one fret (1 then 2 is 12), up to 24. |
| ↑ ↓ | String. |
| ← → | Column; → past the last column adds one with the same duration. |
| Backspace | Clears the cursor's note; on an empty column, removes it. |
| + − | Longer or shorter duration. |
| . | Dot. |
| Alt+3 | Triplet. |
| r | Rest (clears the column's notes). |
| h p | Hammer-on or pull-off from the previous note on that string. |
| / \ | Slide up or down into the note. |
| b | Bend: cycles full, ½, release, none. |
| ~ | Vibrato. |
| m | Palm mute. |
| x | Muted (dead) note. |
| l | Let ring. |
| n | Natural harmonic, drawn ‹12›. |
| t | Tap. |
| e | Tremolo picking. |
| d u | Pick stroke down ⊓ or up V; again to clear. |
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo. |
| Enter | Next example's first column (adds an example after the last). |
| Esc | Leaves the tab; the cursor hides. |

Clicking a column on a string puts the cursor there. Captions and titles
are ordinary text fields.

## Techniques and how they draw

- On a note: hammer-on and pull-off (an arc to the previous note on that
  string with H or P over it), slide in (a slanted line from the previous
  note), bend (a curved arrow above the staff with "full" or "½"; release
  an arrow down), vibrato (a wavy line above the staff), muted note (x for
  the fret), natural harmonic (‹12›), tap (T over the note).
- On a column: palm mute ("P.M." and a dashed line over the run, ending in
  a tick), let ring ("let ring" and a dashed line), tremolo picking (three
  slashes on the stem), pick stroke (⊓ or V over the staff).
- Marks above the staff stack in a fixed order: strokes, then P.M. / let
  ring, then vibrato and bend labels.

## ASCII tab

One format, read and written, so a sheet exported and imported again comes
back the same, except pick strokes, let ring and tremolo, which ASCII tab
has no common marks for and leaves out.

```
Legato, a bend and vibrato
   e   e   e   e   e   e   e   e   | e   e   e   e   q       q       |
e|---------------------------------|---------------------------------|
B|---------------------------------|---------------------------------|
G|-------------------------5--h7---|-7--p5---------------------------|
D|-----------------5--h7-----------|---------7--p5-------------------|
A|---------5--h7-------------------|-----------------7b9-------------|
E|-5--h8---------------------------|-------------------------5~------|
```

- **Strings:** six lines, high e first, each `name|` then the tab; the
  names are optional, `|` marks bars. A column's position is its first
  digit; a technique letter that joins two notes (`h p / \`) sits in the
  gap just before the second. Tunings other than standard are
  read as standard (later: tunings).
- **Rhythm line (optional):** directly above the strings, one letter at
  each column's position: `w h q e s` (whole to sixteenth), `.` after it
  for dotted, `3` after it for a triplet; a letter over an empty column is
  a rest. When present it is used as written.
- **Without a rhythm line (Jeremy, 2026-10-25), durations are guessed from
  spacing:** each column's duration is its distance to the next column in
  characters. Where the line has bar lines, a bar's width stands for one
  bar of the time signature (4/4 unless the text says otherwise); with no
  bar lines, the most common gap is an eighth. Each guess snaps to the
  nearest plain or dotted duration. The guess is a start to correct by
  hand.
- **Techniques:** `5h7`, `7p5`, `5/7`, `7\5`, `7b9` (a bend up to the
  pitch of fret 9: two frets is full, one is ½), `7b9r7` (bend and
  release), `7~`, `x`, `<12>` (harmonic), `t12` (tap), and a `PM----|`
  line above the strings for palm mute.
- **Examples and title:** blocks of six lines that follow each other belong
  to one example. A line of text right before a block starts a new example
  with that text as its caption; the first such line before any tab, if it
  stands alone, is the sheet's title. Other lines are ignored.
- **Writing:** columns are spaced in proportion to duration (two
  characters a sixteenth), the rhythm line always written, lines wrapped at
  bar lines near 80 characters, the caption above each example and the
  title on top.
- `public/tab-ascii.txt` describes the format in a few lines, so any Claude
  (or person) given a screenshot can be pointed at it.

### Getting ASCII in

- **⋯ › Import ASCII…** opens a dialog with a text box; Import adds its
  examples to the open sheet.
- **Paste** (Ctrl+V while the paper has focus and the clipboard holds tab)
  does the same.
- **Drop** a `.txt` file on the page, or **Open file…** one: a new sheet.
- **A link:** `/tab#ascii=<the tab, percent-encoded>` opens it as a new
  sheet, then clears the hash so a reload doesn't add it twice. The part
  after `#` never leaves the browser. This is what Claude hands back from a
  screenshot: it reads the tab (and the rhythm, if the screenshot shows
  stems or a staff), writes it in this format and encodes it into the
  link. Very long links may be cut by some chat apps; a few examples are
  fine.
- Anything that doesn't parse says so in the dialog (or a one-line notice
  for a link or file) and imports nothing.

## Data

`src/features/tab/sheet.ts` (pure):

- `Sheet`: id, title, subtitle, paper, examples.
- `Example`: id, caption, time signature, chord slugs, columns.
- `Column`: duration (base 1, 2, 4, 8 or 16, dot, triplet), rest, six
  slots of `Note | null` (high e first), and column marks (stroke, palm
  mute, let ring, tremolo).
- `Note`: fret, and its marks (hammer-on, pull-off, slide up / down,
  bend, vibrato, muted, harmonic, tap).

Editing is a reducer over the sheet with the cursor beside it, so undo is a
stack of sheets. Layout is a pure function from an example and a page width
to positioned glyphs (`layout.ts`); `TabExample.tsx` only draws them, so
print, PNG and SVG share one drawing.

## Saving and output

- `localStorage["frets.tab.sheets"]` holds every sheet and which one is
  open, with a parser that checks every field, as for the other keys.
- **Print** prints the paper alone (`@media print`, `@page` size from the
  sheet's paper), which also gives Save as PDF.
- **Save file…** downloads `<title>.frets-tab.json` (`{ format:
  "frets-tab", version: 1, sheet }`); **Open file…** reads one into a new
  sheet and refuses anything its parser rejects.
- **Copy as PNG / SVG** draws one example through the export pipeline
  (`src/components/chords/export/`, generalised from a chord shape to any
  drawing), always black on white or transparent, as the chord export is.
- **Copy as ASCII** writes one example in the format above, with its
  rhythm line; the ASCII panel's Copy writes the whole sheet.
- **Drag out** an example as PNG (mouse), as the chord diagrams do.
- **Chord diagrams:** Add chord… opens the Chords page's search box
  (`chordSearch.ts`); the chord's first shape is drawn with `ChordDiagram`
  in the export look, up to four beside an example. Right-click one to
  remove it or step its shape.

## Slices

Each its own PR, this spec in the first.

1. The page, sheet list and storage, examples and captions, typing frets,
   durations, rests, dots, triplets and time signatures, stems, beams,
   bars and line wrapping, hammer-on, pull-off and slides, undo, Print;
   ASCII read and written (import dialog, paste, drop, file, the `#ascii=`
   link, the live panel, Copy as ASCII) and `public/tab-ascii.txt`.
2. The other techniques, on the page and in ASCII: bends, vibrato, palm
   mute, let ring, muted notes, harmonics, tapping, tremolo, pick strokes.
3. Images and files: Copy / Download PNG and SVG, drag out, Export
   options; `.json` save and open; chord diagrams beside examples.

Later: the ASCII panel editable both ways, song sections and repeats, a standard staff above the tab (likely
an engraving library such as VexFlow), playback, other tunings.

## Open

- **Phones:** typing needs a keyboard. Default: phones can read and print
  sheets, and tapping a column shows the cursor, but there is no on-screen
  fret pad in slice 1.
- **Renderer:** our own SVG drawing for tab (default), keeping the print
  look in our hands. VexFlow also draws tab with stems and most of these
  techniques; if the staff later uses it, the tab could move to it too.
