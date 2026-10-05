# Answers below the board, hint as a toggle

## Layout

In both trainers the answer card (kicker, Skip / Next, feedback, and the
answer buttons in Name it or the target prompt in Find it) moves from above
the fretboard to below it. The order is now: header, board, answer card,
session stats. The board keeps its legend and hint button at its foot, so
the hint button sits between the board and the answers.

## Hint toggle

The hint button is a toggle instead of a momentary hold. A click or tap (or
Space / Enter on the focused button) turns the hint on, the next one turns it
off. Its label is "Hint" at all times; `aria-pressed` says whether it is on,
and the soft fill from `docs/specs/2026-10-05-answer-buttons-touch-design.md`
shows it. The H key toggles it too, once per press (auto-repeat is ignored),
and does nothing while the settings dialog is open.

The hint belongs to the question it was turned on for: it turns off when the
next question loads, whether by Next, auto-advance, Skip or a settings change
that redraws the question. A settings change that keeps the question (such as
Note names) keeps the hint. Leaving the window or opening the settings dialog
no longer ends it.

This replaces the "Hint hold sources" section of the answer-buttons spec;
pointer capture and the H key-up release are gone.
