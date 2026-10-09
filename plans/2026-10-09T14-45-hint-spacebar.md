# Space toggles the trainers' hint

Spec: `docs/specs/2026-10-09-hint-spacebar-design.md`.

- `useQuizKeyboard.ts`: drop the H branch and Space as Next. A second
  window listener, in the capture phase for keydown and keyup, takes Space
  (unless disabled, in a text field, or with a modifier): prevent default,
  stop propagation, toggle on a non-repeat keydown. Capture runs before the
  board cell's own Enter/Space handler and React's listeners; keyup is
  covered because some browsers press a focused button on Space's keyup.
- `BoardFrame.tsx`: keycap "Space".
- Tests: H presses become Space; new hook tests for a focused button,
  a text field, and Space vs Enter once answered.
