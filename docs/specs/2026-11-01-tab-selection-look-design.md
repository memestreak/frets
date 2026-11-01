# Tab: how selection looks (issue #276)

Jeremy, 2026-11-01. Part of the selection clean-up in #276 (after #238 and #260).

## Selection is blue

Red and rust (`--primary`) are kept for problems and notices. On the Tab page everything selected or
under the cursor is drawn in `--select`, a blue, with `--select-soft` for fills: the lit notes, rests,
heads and marks of a run, the selected note's box and head, the column box, the note-input cursor and
its shadow, a picked word or mark, and the Shift+drag rectangle. The two tokens live in `globals.css`
with the app's other tokens, light and dark.

The blue is a denim (#2a64a8; dark #7fb0e6; soft fills #d6e3f3 / #1c3150), picked by Jeremy from three
mocks (Fretwood's slate `--info` and a brighter MuseScore-like blue were the others; 2026-11-01).

## A box round a selected run

A run of selected columns (a bar pressed in normal mode, Shift+arrows, Shift+drag, Ctrl/⌘+Shift+←→)
gets a box round it, as MuseScore boxes a range. It runs from the staff's top (or the tab's top line)
to the tab's bottom line (or the staff's bottom), a little past both. Where the run starts a bar it
starts at the bar line, and where it finishes one it ends at the next bar line, so a whole bar is boxed
bar line to bar line; inside a bar it starts and ends halfway between notes. A run over a line break
has a box on each line. The box is drawn under the notes and follows every change of the run.

It is a 1px outline on a light tint (`--select-soft`), rounded, picked by Jeremy from three mocks (an
outline alone and a tint alone were the others).

## The selected note lights where it is

A note selected in normal mode was shown by drawing the staff cursor's head and sign over it, at the
cursor's own place: a sign moved left for a chord, or one spelled from the bar's earlier accidentals,
showed twice and only partly lit (Jeremy, 2026-11-01). Now the note's own head, sign, brackets, ledger
lines and dots are drawn in `--select` where they are, and nothing is drawn over them. A head a
second from its neighbour sits on the stem's other side; a press on it now finds it where it is drawn.

## A press off the bars lets the selection go

A press anywhere off the drawn bars, on the score's head, under the tab or on the page round the card,
lets the selection go, as MuseScore's does (Jeremy, 2026-11-01). Buttons, fields, the palette, menus and
dialogs keep it, so their tools still work on it. It is told by what is pressed, not by where the focus
goes, as Safari doesn't focus a pressed button.

## Rests are selectable

In normal mode a press on a rest selects that rest alone, not its bar (Jeremy, 2026-11-01): on the staff
across its five lines, with the tab alone where its rhythm draws the rest under the strings (`restAt` in
`hitTest.ts`). It lights alone, with no box round its column (Jeremy, 2026-11-01: the box is for runs); Shift+press grows the run to it. A
multi-bar rest and a grace note have none to pick. In note input a press there still enters a note.
With the tab alone, the box reaches down over the rhythm so the rest is inside it, and a selected rest
there is lit too.

## Beams light with their notes

A beam is drawn in `--select` once every note it joins is selected, on the staff and under the tab
alone (Jeremy, 2026-11-01); with only some of them selected it stays as it is. A selected column's stem,
flags and dots light with it, under the tab alone as on the staff.

## A picked mark turns blue, with its actions in a right-click menu

Jeremy, 2026-11-01: a picked word, bar line or mark is drawn in `--select` where it is, as a selected
note is, with no box round it, and nothing is drawn beside it: the pencil (Edit) and the trash can
(Delete) that stood to its right are gone. This reverses his earlier taste for visible icon buttons over
right-click menus, for these. What lights:

- the words: chord names, text, sections, tempos, the capo, ending brackets;
- the technique marks (`marks.ts`): bends, slides, ties, hammer-on arcs, vibrato, accents, harmonics,
  strokes, wah, tremolo, tuplets, octave lines, fermatas, the whammy bar, hairpins. A mark drawn on both
  the staff and the tab lights where it was pressed (where it is drawn, when only once);
- the bar lines: a repeat's start or end, a repeat's ×N count, a double bar line, on the staff and the
  tab both;
- a P.M. or let ring line, once its run is selected (a press on it selects the run).

A right-click on it (a long press on a touch screen; Shift+F10 or the menu key with it picked) picks it,
as a press does, and opens its menu at the pointer (from the keys, under it):

- a word: **Edit**, **Delete**;
- a repeat's end or its count: **Edit** (a "Times played, 2 to 9" field), **Delete**;
- a mark, a repeat's start or a double bar: **Delete**.

Edit and Delete do what Enter and Delete do on it. The menu keeps it picked and lit while it is open; a
press away lets it go. A right-click anywhere else still opens the bar menu (Insert bar before or after,
Insert paste); on a time or key signature too, which a press opens the panel of.

## Repeats, double bars and hairpins are selectable

Jeremy, 2026-11-01 ("playback annotations"): in normal mode a press picks, as it picks a word
(`barLines.ts`; found by `textAt`, so they win over the note under them, never over a note's number):

- a repeat's start (its thick and thin lines and dots), its end, and its ×N count, apart: the count's
  Delete puts the repeat back to played twice, written without one; the end's Delete takes the repeat's
  end away. Enter on the end or the count opens the count's field. The Repeat starts or Repeat ends tool
  lights while one is picked;
- a double bar line (the Double bar line tool lights);
- a hairpin, picked whole over the run of columns it spans; Delete takes it off them all. No palette
  tool sets one, so none lights.

Alt+← → step to them too: a bar's repeat start before its columns, its repeat end, count and double bar
after them.

Endings, tempos and fermatas were pickable already; they now light blue too.

Left for later: the Arrangements… chooser keeps its trash cans (they delete files, not marks on the tab).
