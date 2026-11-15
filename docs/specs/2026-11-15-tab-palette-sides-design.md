# Tab: each palette on the clip's left or right

Jeremy, 2026-11-15 (issue #490, "FR: Tab: choose which side of the page each palette lives on"): "Please
open a feature request that allows us to choose, for each palette, which side of the application the
palette lives at. For example, I think, by default, we will want our chat palette to be on the right side."

Questions page: https://claude.ai/artifact/7WEbudifqHyCCMFL2EZVAg. Built on its recommendations while he
answers.

This extends the palettes' column (`2026-11-09-tab-palettes-design.md`, issue #454) to a column on each side;
everything that spec says of a palette, its header, height and drag holds on either side.

For comparison: Dorico's panels are fixed (Notes left, Notations right, Properties bottom), each side hidden on
its own; MuseScore 4 docks its panels on either side by dragging their tabs, each side its own width; Guitar
Pro 8's are fixed (Edition palette left, Inspector right), each shown or hidden by a button; VS Code moves views
between its two side bars by dragging or "Move to Secondary Side Bar", each with its own width and hide button.

## What it does

- **Two sides.** Each palette lives in a column on the clip's left or on its right. A first visit puts Notes,
  Articulations, Bars and Chords on the left and Chat alone on the right, folded. A side with no palettes has
  no column, no strip and no room kept: the clip takes it.
- **Dragging a header across** moves a palette to the other side: the same drag that moves it up or down.
  Once the pointer is past the clip's middle, it lands on the other side, among that side's palettes (the blue
  line shows where) or last there when that side is collapsed or has none. Under 900px, where both sides sit
  over the clip, a drag stays on its own side.
- **While a header is dragged**, a side with no palettes shows a dashed band in the page's margin, 16px from
  the window's edge, where it can be dropped, solid blue while the drag would land there. A collapsed side's
  strip is outlined in blue while the drag would land there; dropping on it expands it. The band is laid over
  the page, so nothing moves.
- **On a focused header, Alt+← →** move its palette to that side, last there; on its own side they do
  nothing. Alt+↑ ↓ move it within its side, as before.
- **Each side collapses on its own**, from its own button at the top of its column on the clip's side (top
  right on the left, top left on the right), "Collapse left palettes" / "Collapse right palettes", to its own
  40px strip on its own edge. Chat's reply dot shows on the strip of the side Chat is on.
- **Each side has its own width**, 224 to 560px, 272 at first, set by the line between it and the clip
  ("Left palette width", "Right palette width"); on the right, leftwards widens. The clip keeps at least
  400px.
- **Where the room comes from.** A column grows into the page's margin on its side, up to 16px from the
  window's edge, so the clip keeps both edges, and its width, while the margins hold the columns; past that the
  clip gives up width. The page's buttons (New … ?) end over the clip card's right edge, moving in with it.
- **Under 900px** both sides sit over the clip in one stack, the left side's column first, each with its own
  Collapse button, no width handles.
- **Kept across visits** in `frets.tab.layout`, with the rest of the layout and not in Settings (it is how the
  window is laid out): `{ open, order, right, heights, collapsed: { left, right }, width: { left, right } }`.
  `order` is every palette top to bottom; each side lists its own in that order; `right` holds the palettes on
  the right.

## Tests

- A first visit: the left column lists Notes (open), Articulations, Bars, Chords; the right lists Chat
  (folded); kept as `right: ['chat']`, `collapsed: { left: false, right: false }`, `width: { left: 272, right:
  272 }`.
- Alt+→ on Bars puts it after Chat on the right; again, nothing; Alt+← puts it last on the left. ← → without
  Alt move nothing.
- With the clip laid out from 300 to 1100: Notes dragged to x 650 stays left (last); to x 750 it lands after
  Chat on the right, the blue line after Chat while dragging; Chat dragged from the right to x 650 lands last on
  the left.
- Chat moved left: no right column, no right Collapse button, no `data-right`; no drop band until a header is
  dragged; then the right band shows, `data-target` once past the middle; dropped, Bars is alone on the right
  and the band is gone.
- Right collapsed, Bars dragged across: its strip has `data-drop`; dropped, the right side is expanded with
  Chat, Bars.
- Collapse left leaves the right column; collapse right leaves the left; each strip is on its own side.
- A Chat reply ended unseen, right collapsed: "Expand right palettes" has `data-status` `unread`; "Expand left
  palettes" has none.
- The right width: ← makes 288; a drag 80px left from there makes 368; kept `{ left: 272, right: 368 }`; the
  left handle still says 272.
- After Alt+→ on Chords and collapsing the left, the next visit shows Chat, Chords on the right.
- `placeOn`: on one side as `moveTo` was (Chat to 0 first, Notes to 5 last, Notes to 2 second, Bars to 2 or 3
  stays); Notes to the right at 0 lands before Chat, at 1 after it; Chat to the left at 0 goes first; Bars to an
  empty right side goes last in `order`.
- `parseLayout`: `right` drops unknown palettes and keeps `[]`; `collapsed: { right: true, left: 'no' }` reads
  `{ left: false, right: true }`; each side's width read and clamped as before; the one-column shape
  (`collapsed: true`, `width: 400`) reads as a first visit.
- The grid's columns are `var(--rail-left, 0px) minmax(0, var(--clip-width)) var(--rail-right, 0px)`.

## How

1. `TabRail.tsx`: `PaletteLayout` gains `right`, `collapsed` and `width` per side; `sideOf`, `paletteList`,
   `sideState`, `sideRoom`; `placeOn` replaces `moveTo`; `useReorder` aims at a side by the clip's middle;
   `TabRail` draws a column per side with its own Collapse button and `WidthHandle`, and the drop band.
2. `TabPage.tsx`: `.tab-page` carries `data-right` and `--rail-right`, so the page's buttons end over the clip.
3. `tab.css`: three grid tracks, margins per side, the right column's mirrored button and handle, the drop band,
   the header's margin, the narrow stack.
4. Tests: `src/__tests__/tab/page/palettes.test.tsx`; `column(side)` in `src/__tests__/tab/tool.ts`; Chat's and
   the Chord chart's tests name the side.
5. The Tab README, `src/lib/README.md` (the key), the palettes and width specs.
