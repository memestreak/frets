# Space toggles the hint

In both trainers the Space bar toggles the hint, in place of the H key. H
no longer does anything. The hint button's keycap reads "Space".

Space belongs to the hint wherever focus is on the trainer page:

- It does not press a focused button. An answer tile clicked with the
  mouse keeps focus, so Space would otherwise answer it again; on the hint
  button itself, it would toggle twice.
- It does not tap a focused board cell in Find it.
- It does not scroll the page.
- Once a question is answered, Space still toggles the hint. Enter is the
  only key for Next; with Pause b/w on, every other non-modifier key still
  goes to the next question as before.

Unchanged: one toggle per press (auto-repeat is ignored); nothing while the
settings dialog is open or while focus is in a text field or select; Enter
presses a focused answer tile, board cell or other button.

This replaces the H key in `2026-10-05-answers-below-hint-toggle-design.md`
and Space as Next in `2026-10-04-answer-arrow-keys-design.md` and the
prototype's keyboard rules.
