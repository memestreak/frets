# Note trainer: Name it and Find it

## Goal

The Note trainer has three modes (Name it, Find on string, Find in range)
and two settings (Strings in scope, Target range). The range applies
unevenly: Find on string ignores it, and only Find in range draws it. This
work reduces the trainer to two modes, **Name it** and
**Find it**, with both settings applying to both modes in the same way.

## Modes

`NoteMode` (`src/lib/notes.ts`) becomes `'name' | 'find'`.

| Mode    | Header label | Title           | Question                        |
|---------|--------------|-----------------|---------------------------------|
| `name`  | Name it      | Name the note   | A marked fret; name its note    |
| `find`  | Find it      | Find the note   | A note and a string; tap a fret |

`NoteQuestion` becomes:

```ts
export type NoteQuestion =
  | { mode: 'name'; pc: number; s: number; f: number }
  | { mode: 'find'; pc: number; s: number };
```

The `range` question (find every occurrence) and `rangeTargets` are
removed.

## Settings

`NoteSettings` keeps its fields; only `mode`'s type changes.

| Field     | Meaning                                  | Default    |
|-----------|------------------------------------------|------------|
| `strings` | Strings questions are drawn from         | all six    |
| `rFrom`   | One end of the fret range, 0..15         | 1          |
| `rTo`     | The other end of the fret range, 0..15   | 12         |

`targetRange(set)` still returns the two ends in order, so the fields may be
entered either way round. Both settings apply to both modes:

- **Name it** marks a fret on an in-scope string, inside the range.
- **Find it** names an in-scope string, and the answer must be inside the
  range.

The dialog shows the same two fields as today. "Target range" is relabelled
**Fret range**; the inputs keep their accessible names ("Range start fret",
"Range end fret"). Changes regenerate the question, as now.

## Quiz rules

### Judging a Find-it tap

Two pure functions in `src/lib/notes.ts`, used by the reducer:

```ts
/** Is `pos` the asked note on the asked string, inside the fret range? */
isCorrectNoteFret(q: FindQuestion, pos: Position, set: NoteSettings): boolean

/** Is `pos` the asked note on the asked string, but outside the range? */
isNoteOutOfRange(q: FindQuestion, pos: Position, set: NoteSettings): boolean
```

where `FindQuestion` is the `find` member of `NoteQuestion`. A tap is
handled as:

- **Correct** (`isCorrectNoteFret`): solved. One tap solves the question.
  A range of 13 frets or more can hold the note twice on a string; either
  fret is correct.
- **Right note, right string, outside the range** (`isNoteOutOfRange`): not
  a miss. The feedback reads "Right note, but outside your range — look in
  frets A–B" in the neutral tone, where A–B is the ordered range ("look at
  fret A" when the range is a single fret). The cell
  gets a muted outline labelled with the note name (dot kind `far`) and
  stops accepting taps. Nothing is scored, and the question stays open.
  This mirrors the Interval trainer's out-of-range rule.
- **Anything else**, including the right note on another string: an
  ordinary miss (red ✕, "Not that fret — try again").

The feedback line checks, in order: no question, answered, `farLast`, then
the latest miss. This is the Interval trainer's order.

### Question generation

`generateNoteQuestion(set, rng, prev?)` enumerates instead of retrying,
replacing the `MAX_TRIES` loop. The argument order changes to match
`generateIntervalQuestion`; `prev` is the previous question, not just its
pitch class.

1. List every candidate for the mode:
   - `name`: each `(s, f)` with `s` in scope and `f` in the range.
   - `find`: each `(s, pc)` with `s` in scope and `pc` present on `s`
     inside the range.
2. If `prev` is given and some candidate has a different pitch class from
   `prev`, keep only those. This keeps today's rule that the same note is
   not asked twice running.
3. Pick uniformly from what remains.
4. Return `null` only when there is no candidate, which happens only when
   no string is in scope.

Consequences:

- A narrow range limits Find it to the notes present on each string inside
  it. With frets 1–5, each string offers five notes.
- When only one pitch class is possible (one string, one fret) the same
  question repeats; that is the only question the settings allow.

The trainer's `next` and `update` pass the current question as `prev`;
`initNoteState` passes none.

### No question fits

Unchanged: "No question fits these settings — put a string in scope."

## State

`NoteState` (`src/components/notes/noteState.ts`) changes to match
`IntervalState`:

- `found: Position[]` becomes `picked: Position | null`, the cell where the
  correct Find-it answer was tapped.
- `far: Position[]` holds out-of-range taps; `farLast: boolean` is true
  while the latest tap was one of them, so the feedback line shows the
  right message.

All three reset with each new question. In `answerFret`, taps on a cell
already in `wrong` or `far` are ignored; a correct tap sets `picked` and
clears `farLast`; a miss clears `farLast`.

## Board

- The board still draws frets 0–15 and every cell is tappable in Find it.
- The range is never drawn: the green band (`BAND_FILL`) and its legend
  entry are removed. Nothing else uses `Fretboard`'s `band` prop, so the
  prop, its `range-band` rects and their tests are removed too.
- In Find it the asked string is drawn bolder and green, as Find on string
  does today. Out-of-scope strings stay dimmed in both modes.
- Legend: "Note to name" in Name it, "Target string" in Find it.
- On solve the tapped cell is solid green, labelled with the note name
  (dot kind `found`, as today).
- `scrollToFret` is the marked fret in Name it and the range's lower end in
  Find it, so the range is in view on narrow screens.
- Hold-for-hint is unchanged: it labels every cell with its note name,
  whatever the range.

The Find-it prompt shows the note name with "on the D string" beneath it.

## Stored settings

The storage key stays `eminor.notes.v2`. `parseNoteSettings` accepts `name`
and `find`, and maps a stored `string` or `range` to `find`. Any other value
falls back to the default, `name`. Other fields parse as before. Stats stay
keyed by pitch class and are not reset.

## Testing

- `src/__tests__/notes.test.ts`: `isCorrectNoteFret` and `isNoteOutOfRange`
  at both ends of the range, on the wrong string, and with the range entered
  backwards; generation for both modes stays in scope and in range, asks
  only notes present on the string, never repeats the previous note when
  another exists, returns the sole question when it is the only one, and
  returns `null` with no string in scope; the parser's mode migration.
- `src/__tests__/noteState.test.ts`: a correct tap solves and sets `picked`;
  an out-of-range tap goes to `far`, is not scored and leaves the question
  open; the right note on another string is a miss; repeat taps are
  ignored; a new question clears `picked`, `far` and `farLast`.
- `src/__tests__/NoteTrainer.test.tsx`: two mode options; the Fret range
  field; the target string prompt; out-of-range feedback; no band. Three
  existing tests change: "Find in range: counts found targets" is removed,
  and the two that store `mode: 'string'` ("Defaults resets the dialog
  fields", "has no Board window setting") move to `'find'`.
- A browser check of both modes, per the project's UI rule.

## Out of scope

- A "find every occurrence" task; it is removed, not kept behind a setting.
- Marking the second in-range occurrence after a solve.
- Changing the board's fret extent or linking it to the range.
- Per-string or per-mode stats.
- `design_handoff/`, which still describes three modes; it stays as a
  historical reference. `CLAUDE.md` gets a short note on the difference.
