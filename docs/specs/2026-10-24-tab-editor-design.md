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
- **Input:** typing on the tab with the keyboard. No neck to tap, no ASCII
  paste.
- **Rhythm:** stems and beams under the tab now. The data carries pitch and
  duration, so a standard staff above the tab can come later.
- **A sheet** is a worksheet: title, subtitle, numbered captioned examples.
  Song sections and repeats come later; a one-example sheet is a single
  riff.
- **Techniques:** the full set below.
- **Saving and output:** sheets kept in the browser with a list; Print /
  Save as PDF; save and open a `.json` file; copy an example as PNG or SVG
  (the chord export pipeline) or as ASCII tab.
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
  Export options…, Move up, Move down, Delete example.
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
- **Copy as ASCII** writes the example as plain tab: `e|--5h7--|` lines,
  bar lines, `h p / \ b ~ x <12>`, a `PM----|` line above when used.
  Rhythm does not survive ASCII.
- **Chord diagrams:** Add chord… opens the Chords page's search box
  (`chordSearch.ts`); the chord's first shape is drawn with `ChordDiagram`
  in the export look, up to four beside an example. Right-click one to
  remove it or step its shape.

## Slices

Each its own PR, this spec in the first.

1. The page, sheet list and storage, examples and captions, typing frets,
   durations, rests, dots, triplets and time signatures, stems, beams,
   bars and line wrapping, hammer-on, pull-off and slides, undo, Print.
2. The other techniques: bends, vibrato, palm mute, let ring, muted notes,
   harmonics, tapping, tremolo, pick strokes.
3. Output: `.json` save and open, Copy as PNG / SVG / ASCII, chord
   diagrams beside examples.

Later: song sections and repeats, a standard staff above the tab (likely
an engraving library such as VexFlow), playback, other tunings.

## Open

- **Phones:** typing needs a keyboard. Default: phones can read and print
  sheets, and tapping a column shows the cursor, but there is no on-screen
  fret pad in slice 1.
- **Renderer:** our own SVG drawing for tab (default), keeping the print
  look in our hands. VexFlow also draws tab with stems and most of these
  techniques; if the staff later uses it, the tab could move to it too.
