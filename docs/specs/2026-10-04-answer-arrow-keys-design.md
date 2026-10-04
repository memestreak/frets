# Arrow keys across the answer buttons

Date: 2026-10-04
Status: implemented

## Goal

In Name it, on both trainers, the left and right arrow keys move a
highlight across the answer buttons and Enter picks the highlighted one,
so a question can be answered without the mouse or the number-row
shortcuts.

## Design

- The highlight is real keyboard focus, drawn with the Fretwood focus ring
  (`:focus-visible`, `--focus-ring`). Pressing Enter (or Space) is then the
  browser's own button press, and screen readers announce the button.
- `useQuizKeyboard` sends ArrowLeft / ArrowRight to a new `onArrow` while the
  question is open, from anywhere on the page, so there is no need to Tab
  into the row first. Arrows a control already handled (`defaultPrevented`,
  e.g. the board's roving focus in Find it) are left alone, as are arrows
  while typing in a field or while the settings dialog is open.
- `useTrainer` holds a ref to the `AnswerGrid` and moves focus with
  `stepAnswerFocus`: one button per press, wrapping at the ends, skipping
  buttons already answered wrong (they are disabled). With nothing focused,
  the first right arrow lands on the first button and the first left arrow
  on the last. The last button reached is remembered, so after a wrong
  answer drops focus the next arrow steps on from it.
- Focus stays on its button when the next question comes, so the next
  answer starts from the same place.
- Once a question is answered, arrows do nothing (with Pause b/w on they go
  to the next question, like any key) and Enter goes to the next question,
  as before.
- The number-row answer shortcuts are unchanged. Find it has no answer
  buttons, so the arrows only act on the board there, as before.
