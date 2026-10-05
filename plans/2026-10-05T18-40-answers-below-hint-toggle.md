# Answers below the board, hint as a toggle

Spec: `docs/specs/2026-10-05-answers-below-hint-toggle-design.md`.

1. `IntervalTrainer.tsx`, `NoteTrainer.tsx`: render `BoardFrame` before
   `AnswerCard`. Move the 14px gap from `.board-frame`'s top margin to the
   answer card's.
2. `useTrainer.ts`: keep the hint as the question it was turned on for, so a
   new question turns it off without an effect; expose `hint` and
   `toggleHint`.
3. `useQuizKeyboard.ts`: H key-down (not repeat) calls `onToggleHint`; drop
   the key-up and window-blur release.
4. `BoardFrame.tsx`: a plain toggle button labelled "Hint" with
   `aria-pressed`; drop the pointer-hold handlers and `touch-action` /
   `user-select` CSS that only served the hold.
5. Update tests for the toggle and for the hint turning off on Next.
6. `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`;
   before/after screenshots at 1280 and 390px.
