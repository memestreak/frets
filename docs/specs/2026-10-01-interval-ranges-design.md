# Interval trainer: vertical and horizontal range

## Goal

Let the user set how far the target may sit from the root in the Interval
trainer, in strings (vertical) and in frets (horizontal). Today the fret
distance is a hardcoded `REACH = 4` and the string distance is chosen by the
"String pairs" setting. Both become one consistent box around the root that
governs which questions are asked and which Find-it taps count as correct.

## Settings

`IntervalSettings` (`src/lib/intervals.ts`) loses `pairs` and gains:

| Field    | Meaning                                | Min | Max | Default |
|----------|----------------------------------------|-----|-----|---------|
| `vRange` | Max strings between root and target    | 1   | 5   | 5       |
| `hRange` | Max frets between root and target      | 1   | 12  | 4       |

Both are upper bounds: `hRange = 4` allows fret distances 0 to 4, and
`vRange = 3` allows string distances 1 to 3.

The default changes on purpose: `pairs: 'adj'` (adjacent strings only)
becomes `vRange: 5` (any gap from 1 to 5). `defaultIntervalSettings` is
updated to match.

Removed: `REACH`, the `StringPairs` type, `PAIR_GAPS`, and the `PAIRS` list
used by the parser; in `IntervalTrainer.tsx`, the `StringPairs` import and
`PAIR_OPTS`. Export the limits as constants (`V_RANGE_MAX = 5`,
`H_RANGE_MAX = 12`) and a `clampHRange(n)` helper (round, then clamp to
1..12) so the dialog and parser share them.

## Settings dialog

In `IntervalTrainer.tsx` the "String pairs" field is replaced, in the same
position, by two fields:

```
Vertical range     [1|2|3|4|5]
                   Same string questions ignore this.
Horizontal range   [ 4 ]  frets
```

- **Vertical range** uses the existing `Segmented` control with options
  `[1, '1']` to `[5, '5']`. `Segmented` (`src/components/controls.tsx`) is
  typed `T extends string` today; widen it to `T extends string | number`,
  with no other change.
- **Horizontal range** uses the existing `FretInput` (commit on blur, Enter
  or spinner) with `min=1`, `max=12`. `FretInput` does not clamp (its
  `min`/`max` are only HTML attributes) and stays unchanged; the dialog
  calls `update({ hRange: clampHRange(v) })`. The "frets" suffix is a muted
  span beside the input inside a `FretPair`, as the Fret range field does.

Changing either value goes through the trainer's existing `update()` path
(the `settings` action, which regenerates the question).

The "no question fits" message in `IntervalTrainer.tsx` currently says to
widen the fret range or interval pool. A narrow box is now a likelier cause,
so the message also mentions the vertical and horizontal range.

## Quiz rules

### Question generation (`generateIntervalQuestion`)

- For directions other than Same string, the string gap is picked uniformly
  from 1..`vRange` (replacing `PAIR_GAPS[set.pairs]`).
- A candidate is rejected when `|tgt.f - root.f| > hRange` (replacing the
  `REACH` check).
- Same string: the gap is 0, `vRange` is ignored for generation, `hRange`
  applies. With `hRange = 12` this reaches a full octave on one string.
- All other checks (direction, compound, pool) are unchanged.
- A box too narrow to produce any pooled interval returns `null` and the
  trainer shows its "no question fits" state, with the reworded message
  above.

### Find-it judging (`isCorrectFret`)

A tap is correct when all of these hold:

- it lies in the question's direction and names the asked interval class
  (unchanged);
- it stays within an octave unless `compound` is on (unchanged);
- `|tgt.f - root.f| <= hRange`;
- `|tgt.s - root.s| <= vRange`.

The string-distance check is new: today any string is accepted. Judging
always applies both ranges, whatever the direction; `vRange` is ignored only
when generating Same string questions. A string distance of 0 is always
within range, so in Same string mode taps on the root's string count, and so
do taps on other strings inside the box.

The signature becomes
`isCorrectFret(q, tgt, set: Pick<IntervalSettings, 'compound' | 'vRange' |
'hRange'>)`. Its one call site, in `intervalState.ts`, passes `set`. The doc
comment above the function is updated to describe the box.

## Stored settings

The storage key stays `eminor.intervals.v2`. `parseIntervalSettings`:

- accepts `vRange` only if it is an integer in 1..5, else the default 5;
- accepts `hRange` only if it is an integer in 1..12, else the default 4;
- ignores any stored `pairs` value. There is no migration: the app has no
  users yet.

The parser's existing `num` helper clamps with `clampFret` and accepts
non-integers, so it is not reused here. Add an
`intRange(v, min, max, fallback)` helper built on `Number.isInteger` that
rejects rather than clamps.

## Testing

`src/__tests__/intervals.test.ts`:

- generation: across directions and several `vRange` / `hRange` values, the
  string gap is within 1..`vRange` (0 for Same string) and the fret distance
  is within `hRange`; a gap above 1 is actually produced when `vRange > 1`;
- Same string with `hRange: 12` produces an octave. The existing test that
  treats a same-string octave as "far beyond reach" sets an explicit
  `hRange` so it still means what it says;
- `isCorrectFret`: accepts at the edge of each range, rejects one step
  beyond it, for both ascending and descending questions. Every existing
  call moves to the new signature;
- parser: defaults when absent, rejects out-of-range, non-integer and
  non-number values, ignores `pairs`.

`src/__tests__/IntervalTrainer.test.tsx`: two tests use the String pairs
control. The dialog-open test, which looks for "Skip one", looks for a
control that still exists. The persistence test sets both new controls and
checks `saved.set.vRange` and `saved.set.hRange`.

Existing tests that reference `REACH` or `pairs` are rewritten against the
new fields, not deleted.

The change is verified in a browser: both controls, a Find-it round at a
narrow box, and a reload to confirm persistence.

## Docs

- `CLAUDE.md`: note that the range settings deliberately replace the
  prototype's String pairs rule and fixed reach.
- `design_handoff/` and `docs/specs/2026-10-01-settings-dialog-design.md`
  still mention String pairs and are left untouched as historical
  references.

## Out of scope

- The Notes trainer.
- Any visual indication of the box on the fretboard.
- Exact-gap drills ("skip one string only"), which String pairs offered.
