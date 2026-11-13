# Tab: move picked chords earlier or later by the grid

Issue #473 (Jeremy, 2026-10-30, settled 2026-11-13): "what I want to be
able to do is select the chords from my image and move them by the
grid", e.g. a 16th chord on beat 3 moved a 16th earlier. Use Dorico's
keys for it, "even if it means we have to remap what we use Alt+← →
for". Insert mode and Chord mode, where a move pushes or stacks instead
of writing over, are issue #474; a length handle is issue #472.

This changes Alt+← → in `2026-10-30-tab-musescore-selection-design.md`
(it stepped through elements; that is now Ctrl/⌘+Alt+← →) and adds a row
to the normal mode table in `2026-10-30-tab-note-input-mode-design.md`.

## What moves

- In normal mode only. In note input mode Alt+← → does nothing (Dorico's
  Alt+← → there moves the caret's chord too, but our caret has its own
  keys; revisit with #474).
- A picked note, chord or Column moves its **whole chord**, as Dorico's
  does: a Column has one time, and a note leaves its chord only for
  another Voice (#237).
- A selection of several Columns moves as one block, and stays selected.
- A Tie chain moves whole: a chord tied over a bar line moves with its
  tie.
- What moves keeps its length. It is **written over** what it lands on
  (Jeremy, 2026-11-13: "option two"), and the time it leaves becomes a
  Gap, so bars stay full (`2026-11-04-tab-bars-always-full-design.md`).
  Across a bar line the meter splits and ties it.
- The marks of its time (a Text, chord name, fermata, wah or dynamic)
  move with it; the time it leaves keeps none. Where it lands, the marks
  already there stay, and Texts join, as for any write-over (#393).
- Moved past the last bar line, a bar is added for it.
- Nothing moves, and nothing changes, for: a rest or a selection of only
  rests; a grace note; a note in a tuplet; a move before the clip's
  start; a move that would cut a tuplet at a bar line.

## The step

- With **Fixed grid** on (Alt+G, Settings → Editing), the grid's
  length.
- Off (the default), the moved music's own length: a 16th chord moves a
  16th, an 8th an 8th; a selection moves by its first note's length.
  This is what "Fixed grid or the note's length" already means for
  note input.

## Keys

| Keys | Does |
|---|---|
| Alt+← → (Option on a Mac) | Moves the picked chord or the selection a step earlier or later (Dorico) |
| Ctrl/⌘+Alt+← → | Picks the last or next note, rest, mark or word (was Alt+← →, MuseScore's next element) |

- Each press is one undo step; the chord stays picked, so presses repeat.
- With a mark or word picked, Alt+← → does nothing.
- The moved chord sounds when Hear notes is on.
- Both rows are in the `?` overlay (`shortcuts.ts`).
- Some Linux desktops take Ctrl+Alt+← → to switch workspaces; there the
  stepping has no key.

## Dragging

- In normal mode, a press on a notehead (staff) or a fret number (tab)
  that moves 6px chooses its axis: mostly up or down drags the pitch or
  string as before; mostly sideways drags the time.
- A sideways drag snaps to the step, previews as it goes, and lands as
  one undo step on release. Dropped outside the drawing, it puts the
  music back.
- A drag on a note inside a selection of several Columns moves the
  selection.
- Dorico drags one item at a time and only with a preference on; ours is
  always on, as dragging the pitch is.

## Tests

- `r.4 r.4 (5.1 3.2 4.3 5.4).16 r.16 r.8 r.4 |`, the chord picked, a
  16th earlier: `r.4 r.8 r.16 (5.1 3.2 4.3 5.4).16 r.2 |`, the cursor on
  column 3; again: `r.4 r.8 (5.1 3.2 4.3 5.4).16 r.16 r.2 |`; two undos
  give the original.
- The same chord a 16th later: `r.2 r.16 (…).16 r.8 r.4 |`, and back:
  `r.2 (…).16 r.16 r.8 r.4 |`.
- Writing over: the moved note replaces the one it lands on, and leaves
  a Gap: `1.1.4 3.1.4 r.4 4.1.4 |`.
- Across a bar line it splits and ties: `r.2 r.4 r.8 5.1.8 | -.1.8 r.8
  r.4 r.2 |`.
- A Tie chain moves whole: `r.4 5.1.2 r.4 |`.
- `r.4 5.1.4{txt "go" ch "A"} r.2 |` a 16th earlier: `r.8 r.16
  5.1.16{ch "A" txt "go"} -.1.8{d} r.16 r.2 |`, the Text and chord name
  once, on the moved note; a selection takes its Texts too.
- Past the last bar line: `r.2 r.4 5.1.4 |` a quarter later gives
  `r.1 | 5.1.4 r.4 r.2 |`.
- No move: a rest, before the clip's start, a grace note, a selection of
  only rests.
- A picked note moves its chord: `(5.1 7.2).4 r.4 r.2 |` with string 2
  picked, a quarter later: `r.4 (5.1 7.2).4 r.2 |`, the cursor on string 2.
- A selection of two 8ths moved an 8th: `r.8 1.1.8 2.1.8 r.8 r.2 |`,
  the selection on columns 1–2.
- Fixed grid on at 8ths: Alt+→ on `5.1.4 r.4 r.2 |` gives
  `r.8 5.1.4 r.8 r.2 |`.
- In note input mode Alt+→ changes nothing; Ctrl+Alt+→ still steps.
- Test arrangement `editing_tests/move-by-the-grid`.

## How

- `timeMoves.ts`: `moveInTime` (the pure edit, from `writeOver` /
  `writeSpan` in `timeline.ts`), `ownStep` (the step with no fixed
  grid) and `timeAtX` (a pointer's time, for the drag).
- `editorKeys.ts`: `moveInTimeKey` on Alt+← →; stepping moves to
  Ctrl/⌘+Alt+← →.
- `TabClip.tsx`: the 6px axis choice and `onDragTime`; `useTabPicking.ts`
  snaps, previews and commits it; `TabPage.tsx` passes the step.
- `shortcuts.ts`: both rows.
