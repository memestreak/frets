# Tab: how selection looks (issue #276)

Jeremy, 2026-11-01. Part of the selection clean-up in #276 (after #238 and #260).

## Selection is blue

Red and rust (`--primary`) are kept for problems and notices. On the Tab page everything selected or
under the cursor is drawn in `--select`, a blue, with `--select-soft` for fills: the lit notes, rests,
heads and marks of a run, the selected note's box and head, the column box, the note-input cursor and
its shadow, a picked word or mark, and the Shift+drag rectangle. The two tokens live in `globals.css`
with the app's other tokens, light and dark.

The shade is being chosen from mocks, `?blue=1|2|3` on `/tab`:

1. Fretwood's own slate blue, its `--info` and `--focus-ring` (#2f6577 / dark #8cc3d6). The default.
2. Denim (#2a64a8 / #7fb0e6).
3. A bright blue near MuseScore's (#1a6fe0 / #5ea2ff).

## A box round a selected run

A run of selected columns (a bar pressed in normal mode, Shift+arrows, Shift+drag, Ctrl/⌘+Shift+←→)
gets a box round it, as MuseScore boxes a range. It runs from the staff's top (or the tab's top line)
to the tab's bottom line (or the staff's bottom), a little past both. Where the run starts a bar it
starts at the bar line, and where it finishes one it ends at the next bar line, so a whole bar is boxed
bar line to bar line; inside a bar it starts and ends halfway between notes. A run over a line break
has a box on each line. The box is drawn under the notes and follows every change of the run.

Its look is being chosen from mocks, `?mock=a|b|c`: (a) a 1.5px outline, (b) a 1px outline on a light
tint, (c) the tint alone.

## The selected note lights where it is

A note selected in normal mode was shown by drawing the staff cursor's head and sign over it, at the
cursor's own place: a sign moved left for a chord, or one spelled from the bar's earlier accidentals,
showed twice and only partly lit (Jeremy, 2026-11-01). Now the note's own head, sign, brackets, ledger
lines and dots are drawn in `--select` where they are, and nothing is drawn over them. A head a
second from its neighbour sits on the stem's other side; a press on it now finds it where it is drawn.

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
