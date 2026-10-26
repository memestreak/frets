# Tab

A new tool, `/tab`, for a clip of guitar tablature: a riff, lick, solo or
strummed part, imported from ASCII tab or typed, drawn with rhythm stems
and playing techniques, edited, and copied or dragged out as an image or as
ASCII tab. Asked for by Jeremy on 2026-10-24 and reshaped on 2026-10-25 in
the "Brainstorm guitar tablature editor" thread, where he settled each
choice below; details he left open are marked as defaults. Mock:
`/mnt/project-files/tab-editor/clips-mock.png`, layout A, whose clip list
comes later.

**Since 2026-10-25 the clip's own format is alphaTex**
(`2026-10-25-tab-alphatex-design.md`): agents write alphaTex, links are
`#tab=`, and ASCII tab is one more import and export. What follows about
ASCII still holds for ASCII.

## Choices Jeremy made

- **The use case first (2026-10-25):** someone hands an agent a screenshot
  of tab; the agent writes it as ASCII tab Frets can read and gives back a
  link that opens it here to edit. So the priority is **ASCII import,
  editing and export**, and the ASCII format is written down exactly enough
  for an agent to produce valid tab from a picture: `public/tab-ascii.txt`.
- **What gets imported:** riffs, solos and strummed chord parts (one voice:
  every column has one duration). Fingerstyle with independent bass and
  melody rhythms is out.
- **Format coverage (2026-10-25):** ties written `(5)`; the tuning recorded
  and shown but not used; repeat signs with counts and 1st / 2nd endings;
  bends from a ¼-tone curl to 2 steps, with release, and pre-bends; pick
  and strum directions on their own line; palm mutes.
- **One clip for now:** the clip list and search are later. Printing is
  later too.
- **Input:** typing on the tab with the keyboard (no neck to tap), and ASCII
  tab from Import, a paste, a drop or a link.
- **Rhythm:** stems and beams under the tab. Imported ASCII takes its
  durations from a rhythm line above the strings or, without one, guesses
  them from the spacing. The data carries pitch and duration, so a standard
  staff can come later.
- **Import replaces the clip;** Ctrl+Z in the same browser tab brings the
  old one back. Opening a link in another tab overwrites the saved clip.
- **Forgiving import:** whatever can be read is imported; one line under
  the clip says what was guessed, ignored or doesn't add up. Nothing on the
  drawing marks it (Jeremy dropped the tint, 2026-10-25).
- **ASCII view:** a Tab | ASCII switch shows the clip as read-only ASCII.
- **Out:** copy, download or drag the clip as PNG or SVG (the chord export
  pipeline) or as ASCII tab.
- **Verified by tests in CI;** Jeremy tries real screenshots on the first
  PR's preview.
- **Three PRs:** view first (format, import, drawing), then editing, then
  images.

## The ASCII format

`public/tab-ascii.txt`, served at `https://frets.eminor.net/tab-ascii.txt`,
is the format's definition: the whole text and its header lines, blocks,
string lines, columns, the rhythm line, the guess without one, every
technique, repeats and endings, four worked examples, the `#tab=` link
and a checklist for agents reading a picture. It is written for agents and
people, and the parser follows it: if the two differ, the file is right and
the parser is the bug. A test parses every example in it.

In short: optional `Title:`, `Time:` and `Tuning:` lines, then blocks of
six string lines (highest string first), with up to four optional lines
above them (endings and repeat counts, palm mute, strokes, rhythm). A
note's position is its first digit and notes at one position are one
column; `w h q e s` with `.` and `3` give durations; `h p / \ b r pb ~ x
() <> t`, `|: :|` and `PM---|` mark the rest.

## The page

As layout A of the mock, without the list: the clip takes the page width.

- **Header:** the clip's name (Fraunces; "Untitled clip" when empty) on
  the left; on the right the **Tab | ASCII** switch (`.seg`),
  **Import…** and **Download** (the ASCII as a .txt; PR 2
  or PR 3 folds it into a **⋯** menu once there are more items). A ⠿ grip before the name drags the clip out
  (PR 3). Under the name, muted: the time signature, and the tuning when
  it is not standard ("4/4 · Tuning D A D G B E").
- **The clip** in a `--surface-raised` card: the tab, wrapped onto more
  lines at bar lines when wider than the card. In the ASCII view the same
  card holds the clip's ASCII in `--font-mono`, read-only and selectable,
  with a copy button in its top-right corner (the only Copy ASCII; every
  ASCII block gets one).
- **Toolbar** (PR 2), between the header and the card: Duration (1, ½, ¼,
  ⅛, 1/16), dot, triplet, tie, the techniques, the bend amount (¼, ½,
  full, 1½, 2, release, pre-bend) and stroke. Its buttons show the cursor
  column's state and toggle it; each mirrors a key, named in its 1-second
  hover tip. It wraps onto a second row when narrow; nothing in it changes
  width. In the ASCII view it stays, disabled, so nothing moves.
- **Cursor** (PR 2): a soft `--primary-soft` band behind the cursor column
  and a `--primary` box round the cursor's string. Nothing moves when the
  cursor moves, and the card has no browser focus outline.
- **An empty clip** (first visit) shows one empty bar and, under the card,
  one muted line: "Import ASCII tab, or paste it here." (PR 2 adds "Type
  frets").
- **Phones (default):** the header's buttons wrap under the name. Typing
  needs a keyboard; there is no on-screen fret pad yet, but import, the
  views and export all work.

## Drawing

- Six lines that start at an opening line, with "TAB" stacked T, A, B on
  them at the start of every line of tab, as printed tab does. The time
  signature stands in front of the first line of tab, left of its opening
  line, its two numbers close together; bar lines, a final double bar, in
  `--ink` (both themes). With a non-standard tuning, the
  string names stand left of the lines (D A D G B E).
- Columns are spaced by duration. Stems and beams under the bottom string,
  beamed by beat: a half note a short stem, a whole note none, a rest its
  usual sign; triplets a "3" over their beam.
- On a note: hammer-on and pull-off (an arc to the previous note on that
  string with H or P over it); slide (a slanted line from the previous
  note, or into the note); bend (a curved arrow above the staff labelled
  ¼, ½, full, 1½ or 2; release an arrow back down; a pre-bend a straight
  arrow up before the note, its label starting "PB" so a picture of it
  can't be read as a bend; this came from the agent round trip); vibrato (a wavy line above the staff); muted
  note (x); tie (the fret in parentheses with a tie arc from the note it
  continues); natural harmonic (‹12›); tap (T over the note).
- On a column: palm mute ("P.M." and a dashed line over the run, ending in
  a tick); stroke (⊓ down, V up, over the staff).
- Repeats: thick-thin bar lines with two dots; the count ("×4") above the
  end repeat when it is not 2. Endings: a bracket over their bars with
  "1." or "2.".
- Marks above the staff stack in a fixed order, top down: endings and
  counts, strokes, P.M., then bend and vibrato labels.
- **Guessed spots:** the drawing doesn't mark them. After an import one
  muted line under the card says how many durations were guessed, which
  bars don't add up, and what was ignored.

## Import

- **Import…** opens a dialog (the shared `Modal`) with a text box, a line
  pointing to the format ("Format: frets.eminor.net/tab-ascii.txt") and
  Import. Errors show under the box and nothing is imported.
- **Paste** (Ctrl+V on the page outside a text field, with tab on the
  clipboard), **drop** of a `.txt` file or text, and **the link**
  `/tab#tab=<percent-encoded text>` (ASCII or alphaTex) import directly; the link's hash is
  cleared afterwards so a reload doesn't import again. The part after `#`
  never leaves the browser.
- An import **replaces the clip** and is one undo step (Ctrl+Z, in PR 1
  already).
- **Errors** (nothing imported; the reason and line number shown, in the
  dialog or a one-line notice): no block of six string lines; a fret above
  24, including digits run together ("128"); `h` or `p` with no earlier
  note on that string; a tie `(5)` whose string's previous note isn't fret
  5.
- **Forgiven, and listed in the line under the card:** columns
  without a rhythm letter, or blocks without a rhythm line (guessed);
  bars whose durations don't add up (drawn as written); unknown characters
  in a string line (read as "-"); string lines of unequal length (padded);
  a rhythm or stroke letter not above a column (ignored); a bend past 2
  steps (2); a `Time:` the app doesn't offer (4/4); an ending or count with
  no repeat to belong to (ignored).
- **Other spellings** read as their canonical forms, listed at the end of
  section 6 of `tab-ascii.txt`, with the ones not read as their tabs mean
  them. `src/__tests__/tab/fixtures/` holds one golden pair per spelling
  (the input and what the import gives), modelled on two pages Jeremy
  pointed to (how-to-play-electric-guitar.net/tab-symbols.html,
  total-guitar-lessons.com's beginner tablature page 4).

## Export

- **Copy** (the ASCII view's button) and **Download** write the clip in the canonical
  form of `tab-ascii.txt`, as its examples are: header lines, two
  characters a sixteenth (wider where a note needs it), the rhythm line
  always, the other lines when used, blocks broken at bar lines near 80
  characters. Writing and reading back gives the same clip.
- **PR 3:** Copy PNG, and in ⋯ Copy SVG, Download PNG, Download SVG and
  Export options… (the chord Export dialog: size, transparent, name on
  top), black on white or transparent as the chord export is. **Drag** by
  the ⠿ grip (mouse) carries the ASCII as text and the PNG as an image and
  a file, so a text editor or chat gets the tab and an image app or
  document gets the picture; built on `fillDragData` in
  `src/components/chords/export/exportImage.ts`, generalised from a chord
  shape to any drawing.

## Keys (PR 2, defaults)

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
| = | Tie the cursor's note to the previous note on that string (same fret). |
| h p | Hammer-on or pull-off from the previous note on that string. |
| / \ | Slide up or down into the note. |
| b | Bend: cycles ¼, ½, full, 1½, 2, none. |
| Shift+B | Cycles release, pre-bend, pre-bend and release, none. |
| ~ | Vibrato. |
| m | Palm mute. |
| x | Muted (dead) note. |
| n | Natural harmonic. |
| t | Tap. |
| d u | Stroke down or up; again to clear. |
| [ ] | Start or end repeat on the bar line before or after the cursor. |
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo. |
| Esc | Leaves the tab; the cursor hides. |

Clicking a column on a string puts the cursor there. Repeat counts,
endings, the time signature, the tuning and the name are set in ⋯ (Repeat
count…, Ending…, Time signature, Tuning…, Rename). The keys do nothing in
the ASCII view.

## Data

`src/features/tab/` (pure files tested on their own):

- `clip.ts`: `Clip` (name, time signature, tuning, bars), `Bar` (columns,
  repeat start, repeat end with count, ending number), `Column` (duration:
  base 1, 2, 4, 8 or 16, dotted, triplet; rest; six slots of `Note | null`,
  high string first; palm mute; stroke), `Note` (fret and its marks:
  hammer-on, pull-off, slide up / down / in, bend amount in quarter-steps
  with release and pre-bend, vibrato, muted, tie, harmonic, tap), .
- `ascii.ts`: `readAscii(text)` returning a clip with warnings, or errors;
  `writeAscii(clip)`.
- `layout.ts`: a clip and a width to positioned glyphs; `TabClip.tsx` only
  draws them, so screen, PNG and SVG share one drawing.
- `clipState.ts`: the reducer (imports in PR 1; the cursor and edits in
  PR 2; undo stack throughout).

`localStorage["frets.tab.clip"]` holds the clip, with a parser that checks
every field, as for the other keys.

## Verifying it

Tests in CI (Jeremy, 2026-10-25); no agent runs. Jeremy tries real
screenshots, through an agent, on PR 1's preview.

1. **The document:** every example in `tab-ascii.txt` reads without errors
   or warnings, and writing it back gives the same text, character for
   character.
2. **Round trip:** clips covering every mark, written and read, give the
   same clip.
3. **Each rule:** a test per error and per forgiven case in Import above.
4. **Web tab:** fixtures shaped like tab found online (no rhythm line,
   uneven spacing, `E` for both E strings, chord names and lyrics between
   blocks, `||:` written double) import with the expected notes and
   sensible guesses.

## Pull requests

Each its own PR; this spec and `tab-ascii.txt` ride in the first (PR #90).

1. **View:** the `/tab` page, by URL only (Jeremy, 2026-10-25: no Tools
   entry or home card while it is still baking); `tab-ascii.txt`;
   reading and writing ASCII; import (dialog, paste, drop, link) with undo;
   drawing everything the format carries, the
   Tab | ASCII switch; Copy and Download ASCII; storage.
2. **Editing:** the toolbar, cursor and keys above, ⋯'s editing items.
3. **Images:** PNG and SVG copy and download, Export options, dragging the
   clip out.
4. Let ring and tremolo picking (typed only; no ASCII letter).
5. Many clips: the list on the left (layout A), search, importing several
   clips at once.

Later: printing a chosen set of clips, an editable ASCII view, chord
diagrams beside a clip, a second voice for fingerstyle, a standard staff
above the tab (likely an engraving library such as VexFlow), playback
(which would use the tuning).

## Open

- **Renderer:** our own SVG drawing for tab (default), keeping the look in
  our hands. VexFlow also draws tab with stems and most of these
  techniques; if the staff later uses it, the tab could move to it too.
