# Tab: how selection looks (issue #276)

Jeremy, 2026-11-01. Part of the selection clean-up in #276 (after #238 and #260).

## Selection is blue

Red and rust (`--primary`) are kept for problems and notices. On the Tab page everything selected or
under the cursor is drawn in `--select`, a blue, with `--select-soft` for fills: the lit notes, rests,
heads and marks of a run, the selected note's box and head, the column box, the note-input cursor and
its shadow, a picked word or mark, and the Shift+drag rectangle. The two tokens live in `globals.css`
with the app's other tokens, light and dark.

The blue is Fretwood's own slate blue, its `--info` and `--focus-ring` (#2f6577; dark #8cc3d6), picked
from three mocks (denim and a brighter MuseScore-like blue were the others; Jeremy, 2026-11-01).

## A box round a selected run

A run of selected columns (a bar pressed in normal mode, Shift+arrows, Shift+drag, Ctrl/⌘+Shift+←→)
gets a box round it, as MuseScore boxes a range. It runs from the staff's top (or the tab's top line)
to the tab's bottom line (or the staff's bottom), a little past both. Where the run starts a bar it
starts at the bar line, and where it finishes one it ends at the next bar line, so a whole bar is boxed
bar line to bar line; inside a bar it starts and ends halfway between notes. A run over a line break
has a box on each line. The box is drawn under the notes and follows every change of the run.

It is a 1.5px outline with rounded corners and no fill, picked from three mocks (an outline on a tint,
and a tint alone, were the others).

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

## Later in #276

- A beam lights when every note it joins is selected.
- Playback marks (repeats, endings, tempo, hairpins, fermatas…) are selectable by a press.
