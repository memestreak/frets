# Practice (`src/features/practice/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

reference for anything the specs in `docs/specs/` do not cover. Where a spec
and a prototype disagree, the spec wins; the departures are listed below.
The prototypes are not a reference for the look: the shipped styling is the
Fretwood design system, applied as `docs/specs/2026-10-04-fretwood-design-system.md`
describes. `docs/pedagogy/` holds research on what to teach next (ideas,
sizes and open questions, not specs); some of it is already built.

One quiz rule deliberately differs: the prototype names a note below the
root by its distance down, while `intervalClass` names it by its function
against the root (G below C is a P5).

The Interval trainer also departs from the prototype's String pairs setting,
fixed four-fret reach and "repeats allowed" rule: `vRange` / `hRange` define
a box around the root (`inBox` in `features/practice/intervals/intervals.ts`) that drives question
generation and Find-it judging. Neither the board nor the hint shows the box;
tapping the right interval outside it is explained, not scored. The generator
enumerates every valid question, so each possible interval is asked equally
often and the same question never comes up twice running. See
`docs/specs/2026-10-01-interval-ranges-design.md`.

The Note trainer departs from the prototype's three modes: it has Name it
and Find it, and both settings (Strings in scope, Fret range) apply to both.
Find it names one string; the right note on that string outside the range is
explained, not scored, and the board never draws the range. Its generator
also enumerates every valid question. See
`docs/specs/2026-10-01-notes-modes-design.md`. Find it can also be answered
by playing the note into the microphone, beside tapping (the Mic button;
`docs/specs/2026-10-17-note-trainer-mic-design.md`). T or its Tuner button
opens the tuner over the page (`docs/specs/2026-10-17-tuner-design.md`), the
Tuner page's panel in a dialog.

## Files

  - `intervals/` and `notes/` — each trainer's pure logic (`intervals.ts` /
    `notes.ts`: settings, question generators taking an injectable `rng`,
    settings parsing, storage key), its rules (`intervalState.ts` /
    `noteState.ts`: answer key, Name-it or Find-it, correct, out of range,
    handed to the shared reducer) and its component, which keeps what
    differs: dots, prompt and settings fields. Random questions are
    generated outside the reducer and passed in actions, so it stays pure.
  - `quiz/` — what both trainers share: `trainerState.ts` (state, actions,
    reducer, init from storage), `quizFlow.ts` (miss/solve/pause scoring),
    `stats.ts`, `attempt.ts` (miss and out-of-range dots, answer-button
    state, feedback text), the header, answer card/grid, board frame with
    hint toggle, `SettingsDialog` and its field parts (in `src/components/Modal.tsx`, the
    native modal `<dialog>` shell), `SessionStatsCard`, and the hooks: `useTrainer` wires a reducer
    to `useQuizKeyboard`, `useAutoAdvance` and `usePersist`, owns the hint
    and settings-dialog flags, and suspends the first two while the dialog
    is open.
  - `mic/` — answering by playing, on the mic in `src/components/tuner/`:
    `useMic.ts` (status, toggle, remembered choice, each held note judged
    once), `MicButton.tsx` (fixed-size toggle with the live note and level)
    and `TunerDialog.tsx` (`TunerPanel` in a `Modal`; it borrows the
    trainer's mic, `useMic`'s `borrowed`). The shared reducer's
    `answerPitch` places a played pitch with the trainer's optional
    `placePitch` / `rightPitch` rules; only the Note trainer has them yet.
    The mic needs a secure context: https or localhost.
  - `TrainerLoaders.tsx` — trainers render client-only (`ssr: false`)
    because their initial state reads localStorage and draws a random
    question.
- `practice.css` — the trainers' CSS (answer buttons, the board's frame, the hint and the mic), imported from `src/app/globals.css`.

## Specs

- `docs/specs/2026-10-17-tuner-design.md`: the first tuner, in a modal on the
  Note trainer: strobe, strings, reference notes
- `docs/specs/2026-10-17-note-trainer-mic-design.md`: Find it can be answered
  by playing the note into the mic
- `docs/specs/2026-10-09-interval-fixed-board-design.md`: the Interval
  trainer's board keeps its size whatever the Fret range
- `docs/specs/2026-10-09-hint-spacebar-design.md`: Space toggles the trainers'
  hint, in place of H
- `docs/specs/2026-10-05-answers-below-hint-toggle-design.md`: the answer card
  moves below the board; the hint becomes a toggle
- `docs/specs/2026-10-05-answer-buttons-touch-design.md`: the answer buttons
  wrap to two rows on phones, for touch-sized targets
- `docs/specs/2026-10-04-practice-restructure-design.md`: shared code moves
  out of the trainers into lib, components and hooks
- `docs/specs/2026-10-04-answer-arrow-keys-design.md`: arrow keys and Enter
  answer Name it without the mouse
- `docs/specs/2026-10-01-settings-dialog-design.md`: the trainers' settings
  move to a dialog; session stats stay on the page
- `docs/specs/2026-10-01-settings-defaults-design.md`: a Defaults button in
  the trainers' settings dialog
- `docs/specs/2026-10-01-notes-modes-design.md`: the Note trainer reduced to
  Name it and Find it, both settings applying to both
- `docs/specs/2026-10-01-interval-ranges-design.md`: the Interval trainer's
  Box (vRange, hRange) drives questions and judging

## Decisions

- `docs/adr/2026-11-02-spec-over-prototype.md`: the spec wins; Fretwood sets
  the look
