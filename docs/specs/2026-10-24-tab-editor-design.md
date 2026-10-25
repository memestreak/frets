# Tab

A new tool, `/tab`, for a clip of guitar tablature: a riff, lick or
exercise, imported from ASCII tab or typed, drawn with rhythm stems and
playing techniques, edited, and copied or dragged out as an image or as
ASCII tab. Asked for by Jeremy on 2026-10-24 and reshaped on 2026-10-25 in
the "Brainstorm guitar tablature editor" thread, where he settled each
choice below; details he left open are marked as defaults. Mock:
`/mnt/project-files/tab-editor/clips-mock.png`, layout A, whose clip list
comes later.

## Choices Jeremy made

- **The use case first (2026-10-25):** someone hands an agent a screenshot
  of tab; the agent writes it as ASCII tab Frets can read and gives back a
  link that opens it here to edit. So the priority, and what the first PR
  must prove, is **ASCII import, editing and export**. The ASCII format is
  written down exactly enough for an agent to produce valid tab from a
  picture: `public/tab-ascii.txt`.
- **One clip for now:** the clip list and search are later increments.
  Printing is later too.
- **Input:** typing on the tab with the keyboard (no neck to tap), and ASCII
  tab from Import, a paste, a drop or a link.
- **Rhythm:** stems and beams under the tab. Imported ASCII takes its
  durations from a rhythm line above the strings, or, without one, guesses
  them from the spacing. The data carries pitch and duration, so a standard
  staff above the tab can come later.
- **Techniques:** the full set below.
- **ASCII view:** a Tab | ASCII switch shows the clip as read-only ASCII
  tab; no live panel.
- **Out:** copy, download or drag the clip as PNG or SVG (the chord export
  pipeline) or as ASCII tab.

## The ASCII format

`public/tab-ascii.txt`, served at `https://frets.eminor.net/tab-ascii.txt`,
is the format's definition: the whole text, blocks, string lines, columns,
the rhythm line, the guess without one, every technique, examples, the
`#ascii=` link and a checklist for agents reading a picture. It is written
for agents and people, and the parser follows it. If the two ever differ,
the file is right and the parser is the bug; a test parses every example in
it.

In short: optional `Title:` and `Time:` lines, then blocks of six string
lines (high e first) with an optional palm-mute line and rhythm line above;
a note's position is its first digit, notes at one position are one
column; `w h q e s` with `.` and `3` give durations; `h p / \ b r ~ x <> t`
and `PM---|` mark techniques.

## The page

As layout A of the mock, without the list: the clip takes the page width.

- **Header:** the clip's name (Fraunces, edited in place; "Untitled clip"
  when empty) on the left; on the right the **Tab | ASCII** switch
  (`.seg`), **Import…**, **Copy ASCII**, **Copy PNG** and **⋯** (Copy SVG,
  Download PNG, Download SVG, Download ASCII (.txt), Export options…,
  Time signature: 2/4, 3/4, 4/4, 6/8, 12/8; New clip). A ⠿ grip before the
  name drags the clip out.
- **Toolbar:** Duration (1, ½, ¼, ⅛, 1/16), dot and triplet, the
  techniques and the bend amount (½, full, release). Its buttons show the
  cursor column's state and toggle it; each mirrors a key, named in its
  1-second hover tip. It wraps onto a second row when narrow; nothing in it
  changes width. In the ASCII view it stays, disabled, so nothing moves.
- **The clip** in a `--surface-raised` card: the tab, wrapped onto more
  lines at bar lines when wider than the card. In the ASCII view the same
  card holds the clip's ASCII in `--font-mono`, read-only and selectable.
- **Tab drawing:** six lines, "TAB" and the time signature at the start,
  bar lines, a final double bar, in `--ink` (both themes). Columns are
  spaced by duration. Stems and beams under the bottom string, beamed by
  beat: a half note a short stem, a whole note none, a rest its usual sign.
- **Cursor:** a soft `--primary-soft` band behind the cursor column and a
  `--primary` box round the cursor's string. Nothing moves when the cursor
  moves, and the card has no browser focus outline.
- **An empty clip** (first visit, or New clip) shows one empty bar with the
  cursor in it and, under the card, one muted line: "Type frets, or import
  ASCII tab." (default).
- **Phones (default):** the header's buttons wrap under the name. Typing
  needs a keyboard; there is no on-screen fret pad yet, but import, the
  views and export all work.

## Keys (defaults)

While the clip has focus:

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
| b | Bend: cycles ½, full, full and release, none. |
| ~ | Vibrato. |
| m | Palm mute. |
| x | Muted (dead) note. |
| n | Natural harmonic. |
| t | Tap. |
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo; an import is one step. |
| Esc | Leaves the tab; the cursor hides. |

Clicking a column on a string puts the cursor there. The keys do nothing
in the ASCII view.

## Techniques and how they draw

Everything the ASCII format carries, so an imported clip shows all of it:

- On a note: hammer-on and pull-off (an arc to the previous note on that
  string with H or P over it), slide (a slanted line from the previous
  note, or into the note from below or above), bend (a curved arrow above
  the staff with "½" or "full"; release an arrow back down), vibrato (a
  wavy line above the staff), muted note (x for the fret), natural
  harmonic (‹12›), tap (T over the note).
- On a column: palm mute ("P.M." and a dashed line over the run, ending in
  a tick).
- Marks above the staff stack in a fixed order: P.M., then vibrato and
  bend labels.

Later, with no ASCII letter (so typed only): let ring, tremolo picking,
pick strokes.

## Import

- **Import…** opens a dialog (the shared `Modal`) with a text box, a line
  pointing to the format ("Format: frets.eminor.net/tab-ascii.txt") and
  Import. Errors show under the box and nothing is imported.
- **Paste** (Ctrl+V on the page outside the name field, with tab on the
  clipboard), **drop** of a `.txt` file or text, and **the link**
  `/tab#ascii=<percent-encoded text>` import directly; the link's hash is
  cleared afterwards so a reload doesn't import again. The part after `#`
  never leaves the browser.
- An import **replaces the clip**; Ctrl+Z brings the old one back.
- **Errors** (nothing imported, the reason and the line number shown): no
  block of six string lines; a fret above 24; digits running into a fret
  above 24 ("128"); `h` or `p` with no earlier note on that string; a
  rhythm letter not above a column or an empty position.
- **Warnings** (imported, then one muted line under the card says what was
  ignored or guessed, until the next edit): unknown characters in a string
  line (read as "-"); columns without a rhythm letter (guessed); bars whose
  durations don't add up to the time signature; a `Time:` the app doesn't
  offer (4/4 used); string lines of unequal length (padded).

## Export

- **Copy ASCII** and **Download ASCII** write the clip in the canonical
  form of `tab-ascii.txt`: `Title:` and `Time:` lines, two characters a
  sixteenth (wider where a fret needs it), the rhythm line always, a PM line
  when used, blocks broken at bar lines near 80 characters. Writing and
  reading back gives the same clip.
- **Copy PNG**, and in ⋯ Copy SVG, Download PNG and Download SVG, draw the
  clip black on white or transparent, as the chord export does;
  **Export options…** is the chord Export dialog (size, transparent, name
  on top).
- **Drag** the ⠿ grip (mouse): the drag carries the ASCII as text and the
  PNG as an image and a file, so a text editor or chat gets the tab and an
  image app or document gets the picture. Built on `fillDragData` in
  `src/components/chords/export/exportImage.ts`, generalised from a chord
  shape to any drawing.

## Data

`src/features/tab/` (pure files tested on their own):

- `clip.ts`: `Clip` (name, time signature, columns), `Column` (duration:
  base 1, 2, 4, 8 or 16, dotted, triplet; rest; six slots of `Note | null`,
  high e first; palm mute), `Note` (fret and its marks: hammer-on,
  pull-off, slide, bend ½ or full with or without release, vibrato, muted,
  harmonic, tap).
- `ascii.ts`: `readAscii(text)` returning a clip with warnings, or errors;
  `writeAscii(clip)`.
- `layout.ts`: a clip and a width to positioned glyphs; `TabClip.tsx` only
  draws them, so screen, PNG and SVG share one drawing.
- `clipState.ts`: the editing reducer (cursor, undo stack).

`localStorage["frets.tab.clip"]` holds the clip, with a parser that checks
every field, as for the other keys.

## Verifying it

The first PR is done when all of these pass:

1. **Round trip:** every example in `tab-ascii.txt` reads without warnings
   and writes back character for character; random clips written and read
   give the same clip.
2. **Web tab:** a handful of fixtures shaped like tab found online (no
   rhythm line, uneven spacing, `E` for both E strings, chord names and
   lyrics between blocks) import with the expected notes and sensible
   guesses.
3. **Agents:** six clips covering every technique and rhythm are drawn to
   PNG by the app itself. A fresh agent given only one PNG and
   `tab-ascii.txt` writes the ASCII; the result must import with no errors
   and match the clip's notes and techniques exactly, and its rhythm where
   the picture shows stems. Failures change the document (or the parser),
   and the round is run again. The same is tried on a few screenshots of
   real published tab, judged by eye.
4. On the branch preview: open an `#ascii=` link made by an agent from a
   screenshot, edit it, and drag it into a text editor and an image app.

## Slices

Each its own PR, this spec and `tab-ascii.txt` in the first.

1. The page with one clip: the ASCII format, import (dialog, paste, drop,
   link), drawing and editing everything the format carries, rhythm,
   undo, the Tab | ASCII switch, and every export (ASCII, PNG, SVG,
   drag). Verified as above. A large PR, since this is the part Jeremy
   wants proved.
2. Let ring, tremolo picking and pick strokes (typed only).
3. Many clips: the list on the left (layout A), search, import of several
   clips at once.

Later: printing a chosen set of clips, an editable ASCII view, chord
diagrams beside a clip, a standard staff above the tab (likely an engraving
library such as VexFlow), playback, other tunings.

## Open

- **Renderer:** our own SVG drawing for tab (default), keeping the look in
  our hands. VexFlow also draws tab with stems and most of these
  techniques; if the staff later uses it, the tab could move to it too.
