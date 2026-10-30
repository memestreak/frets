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
