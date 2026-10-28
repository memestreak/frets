# Tab: playback controls stay in sight while scrolling

Issue #151. On a long clip the playback footer scrolled off the window, so
Play, Loop and Speed were out of reach while reading the top of the tab.

## Behaviour

- While the controls are shown, they are sticky at the window's bottom
  inside the clip's card (`position: sticky`), the card's width. At the
  card's end they settle back in their place under the tab; nothing moves
  when they stick or settle.
- The small round show/hide toggle is part of the toolbar: it stays at the
  left end of the toolbar's divider and travels with it. Hidden, the toggle
  stays under the tab and nothing is pinned.
- Stuck, the toolbar is drawn on the card's surface with one line the
  card's width over it; the divider's own short line hides so there are
  never two lines.
- On a phone (≤ 640px) the controls keep to one row that scrolls sideways,
  rather than wrapping to four rows that would cover half the screen.
- Only on the drawn view, as before; exports never include it.

## Options considered

Jeremy picked A (2026-10-28) from two mocks:

- A: sticky in the card (built).
- B: a bar fixed to the window's bottom, the window's width, with the page
  padded so it never covered the tab's end.

## Code

`src/features/tab/PinnedPlayback.tsx` wraps the footer, a direct child of
the card, and sets `data-stuck` (an `IntersectionObserver` on the sticky box
at `bottom: -1px`) for the line. Styles: `.tab-pin` in `globals.css`.
