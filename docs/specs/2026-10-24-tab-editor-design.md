# Tab

A new tool, `/tab`, for keeping clips of guitar tablature: short riffs,
licks and exercises, each typed or imported, drawn with rhythm stems and
playing techniques, and copied or dragged out as an image or as ASCII tab.
Asked for by Jeremy on 2026-10-24 and reshaped on 2026-10-25 in the
"Brainstorm guitar tablature editor" thread, where he settled each choice
below on decision cards; details he left open are marked as defaults.
Mock: `/mnt/project-files/tab-editor/clips-mock.png`, layout A.

## Choices Jeremy made

- **For:** managing clips of tab and moving them in and out of the app
  (2026-10-25). Printing came first on 2026-10-24 and is now a later slice.
- **Input:** typing on the tab with the keyboard, no neck to tap; and
  conventional ASCII tab in, from a paste, a file, a drop or a link.
- **The use case behind it:** hand Claude a screenshot of tab, get back a
  Frets link that opens it as a clip to edit.
- **Rhythm:** stems and beams under the tab. The data carries pitch and
  duration, so a standard staff above the tab can come later.
- **Techniques:** the full set below.
- **ASCII:** a Tab | ASCII switch shows the clip as read-only ASCII tab, not
  a live panel (2026-10-25). Imported ASCII takes its durations from a
  rhythm line above the strings, or guesses them from the spacing.
- **Out:** copy, download or drag a clip as PNG or SVG (the chord export
  pipeline) or as ASCII tab.
- **Layout A:** the clip list on the left, the open clip on the right.

## The page

- **Left column**, 270px: **Import…** and **+ New clip**, a **search box**
  (matches clip names), then the **clip list**: each row a ⠿ grip, the
  clip's name and a muted line ("2 bars · 4/4"; "imported" until first
  edited). The open clip's row is sunken (`--surface-sunken`). Newest
  edit first (default). Under the list, a faint "Drop ASCII or a .txt
  here". With no clips, the list says "No clips yet" and the right side
  opens an empty new clip.
- **Right side, the open clip:**
  - **Header:** ⠿ grip, the name (Fraunces, edited in place), then on the
    right the **Tab | ASCII** switch (`.seg`), **Copy ASCII**, **Copy PNG**
    and **⋯** (Copy SVG, Download PNG, Download SVG, Download ASCII
    (.txt), Export options…, Time signature: 4/4 default, 3/4, 2/4, 6/8,
    12/8; Duplicate, Delete).
  - **Toolbar:** Duration (1, ½, ¼, ⅛, 1/16), dot and triplet, the
    techniques and the bend amount (full, ½, release). Its buttons show the
    cursor column's state and toggle it; each mirrors a key, named in its
    1-second hover tip. It wraps onto a second row when narrow; nothing in
    it changes width. In the ASCII view it stays, disabled, so nothing
    moves.
  - **The clip** in a `--surface-raised` card: the tab, wrapped onto more
    lines at bar lines when wider than the card. In the ASCII view the
    same card holds the ASCII in `--font-mono`, read-only and selectable.
- **Phones (default):** the list becomes a Clip dropdown above the clip.
  Typing needs a keyboard; there is no on-screen fret pad yet.
- **Tab drawing:** six lines, "TAB" and the time signature at the start,
  bar lines every full bar, a final double bar, in `--ink` on the card
  (both themes). Columns are spaced by duration. Stems and beams under the
  bottom string: beamed by beat, a half note a short stem, a whole note
  none, a rest its usual sign.
- **Cursor:** a soft `--primary-soft` band behind the cursor column and a
  `--primary` box round the cursor's string. Nothing moves when the cursor
  moves, and the card has no browser focus outline.

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
| b | Bend: cycles full, ½, release, none. |
| ~ | Vibrato. |
| m | Palm mute. |
| x | Muted (dead) note. |
| l | Let ring. |
| n | Natural harmonic, drawn ‹12›. |
| t | Tap. |
| e | Tremolo picking. |
| d u | Pick stroke down ⊓ or up V; again to clear. |
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo (per clip). |
| Esc | Leaves the tab; the cursor hides. |

Clicking a column on a string puts the cursor there. The name is an
ordinary text field. The keys do nothing in the ASCII view.

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

One format, read and written, so a clip exported and imported again comes
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
  gap just before the second. Tunings other than standard are read as
  standard (later: tunings).
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
- **Clips and names:** blocks of six lines that follow each other belong
  to one clip. A line of text right before a block starts a new clip with
  that text as its name; otherwise the name is "Imported clip". Other lines
  are ignored, so a whole tab page pasted from the web becomes one clip
  per titled section.
- **Writing:** columns are spaced in proportion to duration (two
  characters a sixteenth), the rhythm line always written, lines wrapped at
  bar lines near 80 characters, the clip's name on top.
- `public/tab-ascii.txt` describes the format in a few lines, so any Claude
  (or person) given a screenshot can be pointed at it.

### Getting ASCII in

Every way in adds clips to the list and opens the first new one.

- **Import…** opens a dialog with a text box.
- **Paste** (Ctrl+V on the page outside a text field, with tab on the
  clipboard).
- **Drop** a `.txt` file, or ASCII text, anywhere on the page.
- **A link:** `/tab#ascii=<the tab, percent-encoded>`, then the hash is
  cleared so a reload doesn't add it twice. The part after `#` never
  leaves the browser. This is what Claude hands back from a screenshot: it
  reads the tab (and the rhythm, if the screenshot shows stems or a
  staff), writes it in this format and encodes it into the link. Very long
  links may be cut by some chat apps; a few clips are fine.
- Text that doesn't parse says so in the dialog (or a one-line notice for
  a paste, drop or link) and adds nothing.

## Getting clips out

- **Copy ASCII**, **Copy PNG**, and in ⋯ Copy SVG and the downloads.
  Images are always black on white or transparent, as the chord export
  is; **Export options…** is the chord Export dialog (size, transparent,
  name on top).
- **Drag** a clip by its ⠿ grip, in the list or the header (mouse): the
  drag carries the ASCII as text and the PNG as an image and a file, so a
  text editor or chat gets the tab as text and an image app or document
  gets the picture. Built on `fillDragData` in
  `src/components/chords/export/exportImage.ts`, generalised from a chord
  shape to any drawing.

## Data

`src/features/tab/clip.ts` (pure):

- `Clip`: id, name, time signature, columns, last edited.
- `Column`: duration (base 1, 2, 4, 8 or 16, dot, triplet), rest, six
  slots of `Note | null` (high e first), and column marks (stroke, palm
  mute, let ring, tremolo).
- `Note`: fret, and its marks (hammer-on, pull-off, slide up / down,
  bend, vibrato, muted, harmonic, tap).

`ascii.ts` reads and writes the format above (pure, tested both ways).
Editing is a reducer over the open clip with the cursor beside it, so undo
is a stack of clips. Layout is a pure function from a clip and a width to
positioned glyphs (`layout.ts`); `TabClip.tsx` only draws them, so screen,
PNG and SVG share one drawing.

`localStorage["frets.tab.clips"]` holds every clip and which one is open,
with a parser that checks every field, as for the other keys.

## Slices

Each its own PR, this spec in the first.

1. The page and clip list, search, storage; typing frets, durations,
   rests, dots, triplets and time signatures; stems, beams, bars and
   wrapping; hammer-on, pull-off and slides; undo; ASCII read and written
   (Import dialog, paste, drop, the `#ascii=` link, the ASCII view, Copy
   ASCII, dragging a clip out as ASCII text) and `public/tab-ascii.txt`.
2. The other techniques, on the tab and in ASCII: bends, vibrato, palm
   mute, let ring, muted notes, harmonics, tapping, tremolo, pick strokes.
3. Images: Copy / Download PNG and SVG, Export options, and the PNG added
   to a clip's drag.

Later: printing a chosen set of clips, an editable ASCII view, chord
diagrams beside a clip, a `.json` backup of every clip, a standard staff
above the tab (likely an engraving library such as VexFlow), playback,
other tunings.

## Open

- **Renderer:** our own SVG drawing for tab (default), keeping the look in
  our hands. VexFlow also draws tab with stems and most of these
  techniques; if the staff later uses it, the tab could move to it too.
