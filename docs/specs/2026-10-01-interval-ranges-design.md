# Interval trainer: vertical and horizontal range

## Goal

Let the user set how far the target may sit from the root in the Interval
trainer, in strings (vertical) and in frets (horizontal). Today the fret
distance is a hardcoded `REACH = 4` and the string distance is chosen by the
"String pairs" setting. Both become one box around the root that governs
which questions are asked and
which taps count as correct.

## Settings

`IntervalSettings` (`src/lib/intervals.ts`) loses `pairs` and gains:

| Field    | Meaning                                | Min | Max | Default |
|----------|----------------------------------------|-----|-----|---------|
| `vRange` | Strings spanned, counting the root's   | 1   | 6   | 6       |
| `hRange` | Frets spanned, counting the root's     | 1   | 12  | 4       |

Both are one-based spans that include the root. `vRange = 1` is the root's
string alone and `vRange = 6` is every string; `hRange = 1` is the root's
fret alone and `hRange = 4` is a four-fret position (up to three frets
away). In distance terms the target is at most `vRange - 1` strings and
`hRange - 1` frets from the root. (An earlier draft used zero-based
distances with a vertical maximum of 5; the prototype's fixed reach of four
frets' distance corresponds to `hRange = 5`.)

Two defaults change on purpose:

- `pairs: 'adj'` (adjacent strings only) becomes `vRange: 6`.
- `compound` ("Allow spans over an octave") becomes `true`. With it off, two
  notes 4 or 5 strings apart within a few frets are always more than an
  octave apart, so the default `vRange` would behave like a smaller one.

Removed: `REACH`, `MAX_TRIES`, the `StringPairs` type, `PAIR_GAPS`, and the
`PAIRS` list used by the parser; in `IntervalTrainer.tsx`, the `StringPairs`
import and `PAIR_OPTS`. Export the limits as constants (`V_RANGE_MAX = 6`,
`H_RANGE_MAX = 12`) and a `clampHRange(n)` helper (round, then clamp to
1..12) so the dialog and parser share them.

The fret window still bounds everything: the effective reach is the smaller
of `hRange - 1` and `maxFret - minFret`. Nothing links the two settings.

## The box

One pure function in `src/lib/intervals.ts` defines the box, and generation,
and judging both use it:

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

The box is defined by string direction, not pitch. With `hRange` of 5 or
more, a cell on a lower string can be higher in pitch than the root (low E
fret 10 against A fret 3). Such cells are outside an ascending box, matching
the header copy "Root on the lower string, interval ascends to the higher
string". Likewise a cell inside the box can lie in the wrong pitch direction
(a higher string, many frets down); it is simply wrong.

## Quiz rules

### Correct frets (`isCorrectFret`)

The signature becomes `isCorrectFret(q, tgt, set)`. A tap is correct when:

- `inBox(q.root, q.up, tgt, set)`;
- its pitch lies in the question's direction (`d > 0` when `q.up`, else
  `d < 0`) and `intervalClass(d) === q.semis` (unchanged);
- `|d| <= 12` unless `compound` is on (unchanged).

Its one call site, in `intervalState.ts`, passes `set`. Add
`correctFrets(q, set): Position[]`, every correct fret inside the fret
window, for the reveal below.

### Question generation (`generateIntervalQuestion`)

The 600-try rejection loop is replaced by enumeration. It skewed the mix
(m2 4.7% against P8 10.4% at the defaults) and falsely returned `null` for
narrow boxes with small pools (30% of the time for m2 ascending at
`vRange 5`, `hRange 3`).

1. List every candidate `(root, tgt, up)` with both notes in the fret
   window: `tgt` anywhere in the box, the root's own string included, `up`
   fixed by the direction (both values for Ascending and Descending). With
   `vRange = 1` every question is on one string; with `hRange = 1` every
   question is on one fret; with both at 1 the box is empty.
   Keep a candidate only if `tgt` is a correct fret for its own interval
   class and that class is in the active pool.
2. If more than one candidate exists, drop the one equal to the previous
   question (same root and target).
3. Pick an interval class uniformly from the classes that still have
   candidates, then a candidate uniformly within that class.
4. Return `null` only when no candidate exists. This is now exact.

The signature becomes `generateIntervalQuestion(set, rng, prev?)`. The
trainer's `next` and `update` pass the current question as `prev`;
`initIntervalState` passes none. The worst case is about 19,000 pairs
(window 0–24, widest box), which is fine to enumerate per question.

Consequences: every possible pooled interval is asked equally often,
whatever the box; impossible ones are silently skipped; the same root and
target never come up twice running unless it is the only question.

### Find-it board

The board does not show the box. An earlier version dimmed every cell
outside it and made those cells untappable; it was built, tried in the
browser and rejected as visually unwelcome. `Fretboard` is unchanged.

Every cell in the window is tappable. A tap is handled as:

- **Correct** (`isCorrectFret`): solved, as today.
- **Right interval, outside the box** (`isOutOfRange`: not in the box, but
  in the question's pitch direction and naming the asked interval class):
  not a miss. The feedback reads "Right interval, but outside your range —
  find a closer one" in the neutral tone, the cell gets a muted outline labelled
  with the interval name (dot kind `far`) and stops accepting taps, and nothing is scored. The
  limit is the user's own setting, not a knowledge error.
- **Anything else**, inside or outside the box, including the root's own
  cell: an ordinary miss, as today.

The reducer state holds `far: Position[]` and `farLast: boolean` (whether
the latest tap was one of these, so the feedback line shows the right
message); both reset with each new question.

### Reveal on solve

When a Find-it question is solved, the tapped cell is solid green as today,
and every other fret from `correctFrets` gets a lighter marker (dot kind
`also`: green outline, transparent fill, the interval name as label). Skip
still reveals nothing.

### Hold-for-hint

Unchanged: the hint labels every cell in the fret window with its interval
from the root, whatever the ranges. An earlier version limited it to the
box; that was rejected, since the hint is a reference for the whole board.
It can therefore label a cell that Find-it would treat as out of range.

### No question fits

The message becomes "No question fits these settings — widen the ranges or
interval pool."

## Settings dialog

In `IntervalTrainer.tsx` the "String pairs" field is replaced, in the same
position, by two fields:

```
Direction          [ Ascending                ▾ ]
Vertical range     [1|2|3|4|5|6]
                   Strings, counting the root's own.
Horizontal range   [ 4 ]  frets
                   Frets, counting the root's own.
```

- **Direction** moves out of the header into the dialog as a native
  `<select>` (styled with `.input`) with three options: "Ascending" (`asc`),
  "Descending" (`desc`) and "Ascending and Descending" (`rand`, which picks
  a direction at random per question). It always has a value. The header
  keeps only the Mode control. The old "Same string" direction is removed:
  `Direction` is `'asc' | 'desc' | 'rand'`, and a stored `'same'` falls back
  to the default, Ascending.

- **Vertical range** uses the existing `Segmented` control with options
  `[1, '1']` to `[6, '6']`. `Segmented` (`src/components/controls.tsx`) is
  typed `T extends string` today; widen it to `T extends string | number`,
  with no other change.
- **Horizontal range** uses the existing `FretInput` (commit on blur, Enter
  or spinner) with `min=1`, `max=12`. `FretInput` does not clamp (its
  `min`/`max` are only HTML attributes) and stays unchanged; the dialog
  calls `update({ hRange: clampHRange(v) })`. The "frets" suffix is a muted
  span beside the input inside a `FretPair`, as the Fret range field does.

Changing either value goes through the trainer's existing `update()` path
(the `settings` action, which regenerates the question).

## Stored settings

The storage key stays `eminor.intervals.v2`. `parseIntervalSettings`:

- accepts `vRange` only if it is an integer in 1..6, else the default 6;
- accepts `hRange` only if it is an integer in 1..12, else the default 4;
- ignores any stored `pairs` value. There is no migration: the app has no
  users yet.

The parser's existing `num` helper clamps with `clampFret` and accepts
non-integers, so it is not reused here. Add an
`intRange(v, min, max, fallback)` helper built on `Number.isInteger` that
rejects rather than clamps.

Stats stay keyed by interval class only and are not reset when the ranges
change.

## Testing

`src/__tests__/intervals.test.ts`:

- `inBox`: edges of both ranges; direction-aware strings; the root's string
  included only on the direction's side; the root cell excluded;
- `isCorrectFret`: accepts at the edge of each range and rejects one step
  beyond; accepts a correct fret on the root's string for an ascending
  question; rejects a right-named note on a lower string for an ascending
  question. Every existing call moves to the new signature;
- generation: across directions and several boxes, every question's target
  passes `isCorrectFret`; string gap is within 1..`vRange`; over many draws
  each possible pooled class appears at a roughly equal rate; m2 ascending
  at `vRange 5`, `hRange 3` never returns `null`; an impossible setup
  returns `null`; consecutive questions differ when more than one candidate
  exists; Ascending and Descending produces both directions;
- `correctFrets`: lists all and only the correct frets in the window;
- parser: defaults when absent, rejects out-of-range, non-integer and
  non-number values, ignores `pairs`; `compound` defaults to `true`.

`src/__tests__/intervalState.test.ts`: an out-of-range tap is recorded in
`far` and not scored; a wrong note outside the box is a miss; a new question
clears `far`.

`src/__tests__/IntervalTrainer.test.tsx`:

- two tests use the String pairs control. The dialog-open test, which looks
  for "Skip one", looks for a control that still exists. The persistence
  test sets both new controls and checks `saved.set.vRange` and
  `saved.set.hRange`;
- Find-it leaves every cell tappable and explains an out-of-range tap
  without scoring it; the hint labels the whole window whatever the
  ranges; solving reveals the
  other correct frets;
- generation order changes for every seed, so tests that depend on a
  specific seeded question are re-derived, not loosened.

The change is verified in a browser: both controls, each direction, a Find-it round at a narrow box, the reveal, the hint, and a
reload to confirm persistence.

## Docs

- `CLAUDE.md`: note that the range settings and the enumerating, even-mix
  generator deliberately replace the prototype's String pairs rule, fixed
  reach and "repeats allowed" rule.
- `design_handoff/` and `docs/specs/2026-10-01-settings-dialog-design.md`
  still mention String pairs and are left untouched as historical
  references.

## Out of scope

- The Notes trainer.
- Exact-gap drills ("skip one string only"), which String pairs offered.
- Per-range stats, or resetting stats when ranges change.
- Confining arrow-key focus to the box.
- Avoiding the same interval twice running (only the identical question is
  avoided).
