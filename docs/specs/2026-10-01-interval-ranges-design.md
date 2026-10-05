# Interval trainer: vertical and horizontal range

This document describes the Interval trainer's range settings as built. It
started as the design for the work and was revised as decisions changed;
the code and its tests are the source of truth where they differ.

## Goal

Let the user set how far the target may sit from the root, in strings
(vertical) and in frets (horizontal). The two ranges define one box around
the root that governs which questions are asked and which Find-it taps
count as correct.

They replace the prototype's "String pairs" setting and its hardcoded reach
of four frets.

## Settings

`IntervalSettings` (`src/lib/intervals.ts`):

| Field    | Meaning                                | Min | Max | Default |
|----------|----------------------------------------|-----|-----|---------|
| `vRange` | Strings spanned, counting the root's   | 1   | 6   | 6       |
| `hRange` | Frets spanned, counting the root's     | 1   | 12  | 4       |
| `dir`    | `'asc'`, `'desc'` or `'rand'`          |     |     | `'asc'` |

Both ranges are one-based spans that include the root. `vRange = 1` is the
root's string alone and `vRange = 6` is every string. `hRange = 1` is the
root's fret alone and `hRange = 5` reaches four frets from the root, the
same reach the prototype had. The default is 4 (three frets either way,
changed 2026-10-05). In distance terms the target is at most
`vRange - 1` strings and `hRange - 1` frets away.

Both ranges at 1 would be the root's cell alone, which no question fits, so
that combination cannot be set. `withVRange` / `withHRange` build the
settings patch for a range change: setting one range to 1 while the other
is 1 bumps the other to 2.

`compound` ("Allow spans over an octave") defaults to `true`. With it off,
notes four or five strings apart within a few frets are always more than an
octave apart, so a tall box would behave like a shorter one.

The fret window still bounds everything: the effective reach is the smaller
of `hRange - 1` and `maxFret - minFret`. Nothing links the two settings.

Constants `V_RANGE_MAX = 6` and `H_RANGE_MAX = 12`, and `clampHRange(n)`
(round, then clamp to 1..12), are exported for the dialog and parser.

## The box

One pure function defines the box, and generation and judging both use it:

```ts
/** Is `pos` in the box around `root` for a question in direction `up`? */
inBox(root: Position, up: boolean, pos: Position, set): boolean
```

`pos` is in the box when it is not the root itself,
`|pos.f - root.f| < hRange`, and one of:

- **Another string**: the string lies in the question's direction
  (higher-numbered strings when `up`, lower when not) and
  `|pos.s - root.s| < vRange`.
- **The root's string**: the fret lies in the question's direction (higher
  frets when `up`, lower when not).

The box is defined by string direction, not pitch. With a wide `hRange`, a
cell on a lower string can be higher in pitch than the root (low E fret 10
against A fret 3); it is still outside an ascending box. Likewise a cell
inside the box can lie in the wrong pitch direction (a higher string, many
frets down); it is simply wrong.

## Quiz rules

### Correct frets

`isCorrectFret(q, tgt, set)` is true when:

- `inBox(q.root, q.up, tgt, set)`;
- the pitch lies in the question's direction (`d > 0` when `q.up`, else
  `d < 0`) and `intervalClass(d) === q.semis`;
- `|d| <= 12`, unless `compound` is on.

`correctFrets(q, set)` lists every correct fret inside the fret window.

### Question generation

`generateIntervalQuestion(set, rng, prev?)` enumerates instead of guessing.
The prototype's 600-try rejection loop skewed the mix towards intervals
with more fingerings and could wrongly report that nothing fits in a narrow
box with a small pool.

1. List every candidate `(root, tgt, up)` with both notes in the fret
   window and `tgt` anywhere in the box, the root's own string included.
   `up` is fixed by the direction; `rand` lists both. Keep a candidate only
   if `tgt` is a correct fret for its own interval class and that class is
   in the active pool.
2. If more than one candidate exists, drop the one equal to `prev` (same
   root and target).
3. Pick an interval class uniformly from the classes that still have
   candidates, then a candidate uniformly within that class.
4. Return `null` only when no candidate exists.

The trainer's `next` and `update` pass the current question as `prev`;
`initIntervalState` passes none.

Consequences:

- every possible interval in the pool is asked equally often, whatever the
  box; impossible ones are silently skipped;
- the same root and target never come up twice running unless it is the
  only question;
- with `vRange = 1` every question is on one string, and with `hRange = 1`
  every question is on one fret. There is no separate "Same string"
  direction.

The worst case is about 19,000 pairs (window 0–24, widest box), measured at
a few milliseconds per question.

### Find-it board

The board does not show the box, and every cell in the window is tappable.
An earlier version dimmed every cell outside the box and made those cells
untappable; it was built, tried in the browser and rejected. `Fretboard` is
unchanged by this work.

A tap is handled as:

- **Correct** (`isCorrectFret`): solved.
- **Right interval, outside the box** (`isOutOfRange`: not in the box, but
  in the question's pitch direction and naming the asked interval class):
  not a miss. The feedback reads "Right interval, but outside your range —
  find a closer one" in the neutral tone. The cell gets a muted outline
  labelled with the interval name (dot kind `far`) and stops accepting
  taps. Nothing is scored: the limit is the user's own setting, not a
  knowledge error.
- **Anything else**, inside or outside the box, including the root's own
  cell: an ordinary miss.

The reducer state holds `far: Position[]` and `farLast: boolean` (whether
the latest tap was one of these, so the feedback line shows the right
message). Both reset with each new question.

### Reveal on solve

When a Find-it question is solved, the tapped cell is solid green and every
other fret from `correctFrets` gets a lighter marker (dot kind `also`: green
outline, transparent fill, the interval name as label). The markers are
hidden while the hint is held, so the two labels never overprint. Skip
reveals nothing.

### Hold-for-hint

The hint labels every cell in the fret window with its interval from the
root, whatever the ranges. An earlier version limited it to the box; that
was rejected, since the hint is a reference for the whole board. It can
therefore label a cell that Find-it would treat as out of range.

### No question fits

When the generator returns `null` the feedback line reads "No question fits
these settings — widen the ranges or interval pool."

## Settings dialog

The dialog's first three fields are:

```
Direction          [ Ascending                ▾ ]
Vertical range     [1|2|3|4|5|6]
                   Strings, counting the root's own.
Horizontal range   [ 5 ]  frets
                   Frets, counting the root's own.
```

- **Direction** is a native `<select>` styled with `.input`, with three
  options: "Ascending" (`asc`), "Descending" (`desc`) and "Ascending and
  Descending" (`rand`, a random direction per question). It always has a
  value. It used to be a segmented control in the header, which now holds
  only the Mode control.
- **Vertical range** is a `Segmented` control with options 1 to 6.
  `Segmented` accepts number values as well as strings for this.
- **Horizontal range** is a `FretInput` (commit on blur, Enter or spinner)
  with `min=1`, `max=12`. `FretInput` does not clamp, so the dialog goes
  through `withHRange`, which does. When the clamped value equals the
  current one, nothing is dispatched and the question is kept.

Changes go through the trainer's `update()` path (the `settings` action),
which regenerates the question.

The header no longer has a subtitle line under the title, in either
trainer.

## Stored settings

The storage key is `eminor.intervals.v2`. `parseIntervalSettings`:

- accepts `vRange` only if it is an integer in 1..6, else the default 6;
- accepts `hRange` only if it is an integer in 1..12, else the default 4;
- loads a stored 1/1 as vertical 1, horizontal 2;
- falls back to Ascending for a stored `dir` of `'same'`;
- ignores any stored `pairs` value.

Ranges are rejected, not clamped, when out of bounds (`intRange`, built on
`Number.isInteger`). There is no migration from earlier shapes: the app had
no users when this was built.

Stats stay keyed by interval class only and are not reset when the ranges
change.

## Testing

- `src/__tests__/intervals.test.ts`: `inBox`, `isCorrectFret`,
  `isOutOfRange` and `correctFrets` with literal positions at the edges of
  both ranges; generation rules per direction across several boxes, the
  even interval mix, no immediate repeat, single-string and single-fret
  boxes, and exact `null`; `withVRange` / `withHRange`; the parser.
- `src/__tests__/intervalState.test.ts`: an out-of-range tap is recorded in
  `far` and not scored; a wrong note outside the box is a miss; a new
  question clears `far`.
- `src/__tests__/IntervalTrainer.test.tsx`: the dialog controls, clamping
  and the 1/1 bump; the direction dropdown; out-of-range feedback; the
  whole-board hint; the reveal; no repeated question.

Trainer tests that need to know the question render with stored settings
and reproduce the first question from the same seeded rng (`renderFindIt`).

## Out of scope

- The Notes trainer, apart from losing its header subtitle.
- Exact-gap drills ("skip one string only"), which String pairs offered.
- Per-range stats, or resetting stats when ranges change.
- Showing the box on the board.
- Avoiding the same interval twice running (only the identical question is
  avoided).
- `design_handoff/` and `docs/specs/2026-10-01-settings-dialog-design.md`
  still mention String pairs and the header direction control; they are
  left untouched as historical references.
