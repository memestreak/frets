# Answer buttons on phones

## Problem

Both trainers lay their twelve answer buttons out in one row. On a phone in
portrait (390px wide) each button is about 21px wide and 40px tall, well
under a comfortable touch target, and the labels drop to 13px.

## Design

At 700px and narrower the answer grid becomes two rows of six, in the same
order (m2 to TT, then P5 to P8; C to F, then F♯/G♭ to B). Buttons are at
least 48px tall with an 8px gap; labels are 16px (intervals) and 15px
(notes). At 390px each button is 45 × 48px. Wider than 700px, twelve in a
row are already at least 52px wide and nothing changes.

A note label such as "C♯/D♭" may break after the slash when its button is
too narrow (below about 360px wide); the space that `.btn`'s flex gap used
to put before the slash is gone at every width.

The keyboard is unchanged: ←/→ still step through the buttons in order,
wrapping at the ends, and number keys still pick by position.

Options shown to Jeremy before merging: one row (today), six per row, four
per row and three per row, in light and dark.

## Hint button

The hint button used to read "Intervals from root" / "Note names" while
held, which widened it and reflowed the row around it. It now keeps the
label "Hold for hint" at all times; while held (`aria-pressed="true"`) it
swaps its solid fill for `--primary-soft` with a `--primary` label and
outline. The `hintActiveLabel` prop is gone. Options shown to Jeremy:
fade, soft fill, pressed in, and a swapping label at a fixed width.

## Default horizontal range

The Interval trainer's default `hRange` drops from 5 to 4: the target is
at most three frets from the root unless the player widens it in Settings.
`docs/specs/2026-10-01-interval-ranges-design.md` is updated to match.

## Hint hold sources

Pointer up, leave and cancel on the hint button end only a hold that a
pointer press started. A hint held with H (or Space/Enter on the focused
button) now lasts until that key is released, even if the mouse moves off
the button meanwhile.
