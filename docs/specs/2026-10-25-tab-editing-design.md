# Tab: editing

PR 2 of `2026-10-24-tab-editor-design.md`. It updates that spec's "Keys"
and "Toolbar" sections with what Jeremy chose on 2026-10-25 in the
"Brainstorm guitar tablature editor" thread:

- **Q1 = C:** Shift+arrows select columns. Ctrl+C, X and V copy, cut and
  paste them as text. A paste goes in at the cursor, and Import… replaces
  the whole clip.
- A **symbol palette** like Guitar Pro's replaces the plain toolbar. It
  holds tab symbols only.
- **Q2 = 1:** the palette holds only the symbols Frets already reads.
  Ghost notes, accents, staccato, let ring, grace notes, tremolo, text,
  tempo and the rest of his screenshot come later.

## The editor

The drawn tab is the editor. It is a focusable `role="textbox"`, so screen
readers pass keys through to it.

- **Cursor:** a click (or a tap) on the tab puts the cursor on the nearest
  column and string. While the editor has focus, the cursor shows as a
  soft `--primary-soft` band behind its column and a `--primary` box round
  its string. Esc leaves the editor, and the cursor hides.
- **Selection:** Shift+click or Shift+←/→ selects a run of columns, and
  the band runs unbroken under it on each line of tab, across the bar
  lines inside it (Jeremy, 2026-10-26: a band per column left gaps at
  the bar lines). Ctrl+A selects every column.
- **No outline, no movement:** the editor has no focus outline, and
  nothing moves when the cursor or the selection does. The palette's
  buttons have a fixed size and only change their fill.
- **Line under the clip:** when no import or paste has anything to say,
  it names the bars that don't add up to the time signature.

## Keys

| Key | Does |
| --- | --- |
| 0–9 | Fret on the cursor's string. A second digit within a second, on the same spot, makes a two-digit fret, up to 24. A typed fret keeps the note's marks but drops a tie or a dead note. |
| ↑ ↓ | String. |
| ← → | Column, across bar lines. → from the last column of a bar that doesn't add up fills it at once, anywhere in the clip, with the fewest rests that complete it (`fewestRests`: a dotted half after a quarter in 4/4, a whole rest in an empty bar; Jeremy, 2026-10-26: "be generous"), and the cursor goes to the first of them. A fret typed on a rest longer than the last note before it splits the rest: the note takes that note's length and the rest of the time stays the fewest rests, so a run of quarters types on as before. → from the clip's last column, once its bar is full, starts a new bar: a rest as long as the cursor's column to type on, then the fewest rests that fill the bar. A pickup bar walked through with → fills up too; Ctrl+Z takes it back. Leaving a short bar any other way fills it the same way, the rests after its last column (`fillBar`; Jeremy, 2026-10-27): ← off its first column, a press on a note in another bar, a press off the tab, or Esc. Shift+← doesn't, nor does focus moving to the clip's own fields and panels or the palette, nor the window losing focus. |
| Shift+← → | Select. |
| Backspace, Delete | With a selection, removes its columns, and the bars a selection over several bars leaves empty. Otherwise clears the cursor's note, and on a rest removes the column. The cursor stays in the bar: on the column after while there is one in that bar, else on the column before (Jeremy, 2026-10-26: deleting a bar's last note had jumped to the next bar). A bar emptied on its own stays, empty, with the cursor in it, so → fills it again, with one rest where one will do (Jeremy, 2026-10-26); Delete in an empty bar removes the bar. |
| Insert | A rest before the cursor's column. |
| Ctrl+Enter (⌘+Enter), Ctrl+Shift+Enter | A new bar after (with Shift, before) the cursor's bar, filled with the fewest rests that make up the time signature in force there (a whole rest in 4/4, a dotted half in 3/4 or 6/8; before a bar that changes the time, the time before the change); the cursor goes to its first rest. Also the Bars group's first two buttons and the tab's right-click menu (Insert bar before, Insert bar after, on the bar under the pointer). Jeremy asked for both directions and the menu items the same day. Added 2026-10-26: Jeremy couldn't see how to add a bar of rests mid-clip, and picked this over a Mac key for Insert and over notes spilling into the next bar. |
| + − | Longer or shorter note value. |
| . | No dot, then one dot, then two dots. |
| Alt+3 | Triplet. |
| R | Rest. |
| = | Tie to the note before on the string. |
| H or P | Hammer-on or pull-off from the note before. Which one is named by the frets. |
| / | Steps the slide: from the note before (sl), shift slide (ss), in from below (sib), in from above (sia), none. The kinds from the note before are skipped when there isn't one. |
| B | Steps the bend amount: ¼, ½, full, 1½, 2, none. |
| Shift+B | Steps the bend shape: release, pre-bend, pre-bend and release, plain. |
| V M X N T | Vibrato, palm mute, dead note, natural harmonic, tap. |
| D U | Down or up stroke. |
| [ ] E | Repeat start; repeat end, ×2, ×3, ×4, then none; ending 1., 2., then none. |
| Ctrl+C, X, V | Copy, cut, paste (below). |
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo. Every change is one step. |

Column marks (duration, dots, triplet, rest, strokes) and note marks
(vibrato, palm mute and so on) apply to every selected column when there
is a selection. A note mark then goes on every note in those columns, and
pressing it again takes it off once they all have it.

## Palette

The palette is a toolbar between the header and the clip. It shows one
button per symbol, drawn as the symbol looks in tab, in five groups. Each
group's name is a small muted caption 6px above its buttons (Jeremy picked
this, layout A, over boxed groups and a side column, 2026-10-25). The
groups are:

1. Duration: whole to sixty-fourth, dot, rest (triplets moved to Rhythm,
   `docs/specs/2026-10-26-tab-rhythm-design.md`). A sixty-fourth
   takes no dots (it would need a 128th to fill its beat); the ASCII rhythm
   line writes a thirty-second t and a sixty-fourth x.
2. Joins: tie, hammer-on/pull-off, slide, shift slide, slide in from below,
   slide in from above.
3. Bends: Bend, release, pre-bend. One Bend button (Jeremy, 2026-10-26,
   in place of one per amount): a press opens a small panel under it with
   ¼ · ½ · full · 1½ · 2 · None, the note's amount lit (None without a
   bend); picking one sets it, None takes the bend away, and a press outside or Esc
   closes it with the cursor left on the tab. Its icon shows the note's
   amount, none without a bend. B still steps through the amounts.
4. Techniques: vibrato (one button stepping normal, wide, off, as V does;
   its icon shows the note's kind), palm mute, dead note, harmonic, tap, down stroke,
   up stroke.
5. Repeats: repeat start, repeat end, ending.

A button is pressed when the cursor's column, note or bar has its symbol,
and a press toggles that symbol. Only while the tab has the cursor: a click
off the bars or outside the clip leaves no button pressed (Jeremy,
2026-10-26). Its one-second tip (`HoverTips`, now in
`src/components/`) names the symbol and its key. Pressing a button keeps
the focus on the tab. In the ASCII and alphaTex views the palette stays in
place but is disabled. `tools.ts` holds the table that both the palette
and the keys use.

## Copy, cut and paste

- **Copy:** the selected columns, or the cursor's column when nothing is
  selected, go to the clipboard as alphaTex, with `\ts` and `\tuning` so
  they read the same anywhere. The bar lines between them are kept. A join
  to a note that wasn't copied is dropped.
- **Paste:** anywhere on the page outside a text field, alphaTex or ASCII
  goes in at the cursor, as text does at a caret. With a selection, the
  paste replaces it. The pasted text's first bar joins the cursor's bar
  before the cursor's column, each later bar becomes a new bar, and the
  rest of the cursor's bar follows the last one.
- **Paste into an empty clip:** the paste comes in whole, with its name,
  time and tuning.
- **Replacing the clip:** Import…, a dropped file and a `#tab=` link still
  replace it.

## Code

- `editing.ts` (pure): the cursor, places in the clip, every change, and
  `normalize`. After each change, `normalize` makes the marks that join a
  note to the one before it agree with that note:
  - a tie takes the earlier note's fret;
  - a hammer-on or pull-off is named by the frets;
  - a join with no note before it is dropped.
- `tools.ts` (pure): the palette and key table.
- `TabPalette.tsx`: the palette.
- `layout.ts`: `hitTest` and `cursorSpot`, and each placed column carries
  its place in the clip.
- `TabClip.tsx`: draws the `highlight` (cursor and selection) and reports
  presses with `onPick`. Exported images pass neither, so they are
  unchanged.
- `TabPage.tsx`: the cursor, the selection and the keys. Edits go through
  the clip's undo history.

## Time signature

The time signature under the clip's name is also where it is set (Jeremy,
2026-10-25/26). It is a small raised button with the two numbers stacked as
on a staff, in the display font, and a chevron. Jeremy picked this look (C)
over an engraved tile with ▲▼ pairs (A) and inline − / + steppers (B). The
button opens a panel below it with two parts:

- **Beats in a bar:** a − / + stepper round a small field, 1 to 32. A typed
  count takes effect on Enter or when the field loses focus; anything else
  puts the old count back, and Esc does too. ↑ and ↓ step it at once.
- **Beat:** a segmented row of 2, 4, 8, 16 and 32.

A click outside the panel, or Esc, closes it. Each change is one undo step.
Bars that no longer add up are named in the line under the clip. A
double-click for 4/4 was tried and dropped as too easy to trigger.

Jeremy asked for counts up to 256. alphaTab's parser, which reads every clip
(saved, linked or imported), refuses a count over 32, as Guitar Pro does, so
the field stops at 32 (Jeremy agreed) (`MAX_BEATS` in `clip.ts`).

Short notes are beamed within a beat, never less than a quarter, or within
three beats in compound time (6/8, 9/8, 12/16: a count in threes over an
eighth or shorter). A clip has one time signature; a change within a clip
(alphaTex allows `\ts` on any bar) is later, if needed.

## Later

- Renaming and the tuning.
- An on-screen fret pad for phones.
- The other symbols from his screenshot (Q2).
- Images and dragging the clip out (PR 3).
