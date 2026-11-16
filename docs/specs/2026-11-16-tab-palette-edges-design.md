# Tab: a palette's edges follow the pointer

Jeremy, 2026-11-16 (issue #521): "When my window is wide, when I resize the vertical side palettes on the tab
page by dragging the divider between the arrangement and the palette, the palette width extends from the
opposite side of the palette from where I'm dragging. It's counterintuitive. … if the arrangement is already
at its maximum size, dragging outward from that bar should have no effect. if there is more room on the
opposite side of the palette, I should be able to drag the palette's edge outward to make it wider."

Until now a column grew into the page's margin first and took the clip's width only once that margin was used
up (`2026-11-15-tab-palette-sides-design.md`), so on a wide window the line you dragged stayed put and the
column's far edge moved. Now **the edge you drag follows the pointer and the other edge stays put**, as panels
do in Dorico, MuseScore 4 and VS Code.

## What it does

- **Each side's column has a reach**: how far it sits out past the clip's widest edge into the page's margin,
  up to 16px from the window's edge as before. The rest of its width is taken from the clip. At first the reach
  is the column's width (272px), so a first visit looks as it did.
- **The inner edge** ("Left palette width", "Right palette width"), the line between the column and the clip,
  moves the clip's edge with it: toward the clip widens the column and narrows the clip; away from it narrows
  the column and gives the width back to the clip, but never past the clip's widest edge, so while the clip is
  at its widest a drag away from it does nothing. Its outer edge, and its reach, stay.
- **The outer edge** ("Left palette outer edge", "Right palette outer edge") moves into the margin or back: away
  from the clip widens the column, toward it narrows it, never past the clip's widest edge nor nearer the
  window's edge than 16px. The clip stays put. It shows from 1,280px wide, where the margin is at least 24px;
  it has no line of its own, only the column's border, which thickens on hover as the inner one does.
- **Both** keep the column 224 to 560px wide; the inner edge also keeps the clip 400px wide or more. Both take
  ← → (16px) and Shift+← → (64px), widening or narrowing as the edge would move.
- With the two reaches different, the clip can sit off the page's centre.
- **Kept** in `frets.tab.layout` as `reach: { left, right }` (0 to 560, whole px), written when a drag ends and
  on each key; a missing or non-number reach reads as that side's width. A window narrower than the reach (or
  than 1,240px, where there is no margin) takes the rest from the clip, as before.
- Under 900px nothing changes: no edges to drag.

## Tests

- `parseLayout`: no reach reads as the width (`{ width: { left: 320 } }` → reach left 320, right 272);
  `reach: { left: 100.4, right: 'x' }` → left 100, right the width; −5 → 0; 9000 → 560.
- In a 2,000px window (margin 384px a side), first visit: the inner left edge dragged 80px away from the clip
  changes nothing (the clip is at its widest); 80px toward it makes 352 and keeps reach 272.
- In a 1,600px window (margin 184px), first visit (272 wide, 184 of it in the margin): the outer left edge
  dragged 80px outward stays 272 (the margin is used up); 80px inward makes 224, reach 136. Kept 224 wide with
  reach 100, dragged 200px outward it makes 308, reach 184.
- On the right (reach 100): the outer edge's → makes 288, reach 116; Shift+← 224, reach 52; the inner edge's ←
  240, reach 52.
- On the right: the outer edge's → widens, ← narrows; the inner edge's ← widens.
- In a 1,024px window there is no outer edge (CSS), and the inner edge narrows 272 to 224 as before.
- The grid's margins are `min(var(--rail-reach), var(--rail-left-out, 0px))` and the right's; `--rail-left-out`
  is the reach (never more than the width) when open, 40 for a strip, 0 with no palettes.

## How

1. `paletteLayout.ts` (in `TabRail.tsx` until issue #512): `PaletteLayout.reach`, read by `parseLayout`;
   `sideOut`. `paletteDrag.tsx`: `WidthHandle` takes an `edge`. `TabRail.tsx`: each open column draws both.
2. `tab.css`: the grid's margins use `--rail-*-out`; the outer handle's place, hidden under 1,280px.
3. Tests in `src/__tests__/tab/page/palettes.test.tsx`.
4. The palette-sides and width specs, `src/lib/README.md` (the key), the Tab README.
