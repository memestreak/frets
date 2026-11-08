# Tab: drag the line between the panel and the clip to set the panels' width

Jeremy, 2026-11-08: "make the tab left nav resizable by dragging on the divider".

Issue #431. Until now every Rail panel was 17rem
(`2026-11-02-tab-rail-design.md`).

## What it does

- **The divider is the panel's right edge**, the line between the open panel
  and the clip. Its hit area runs 14px either side of the line, inside the
  panel's padding and the clip's, with an east-west resize pointer; hovered,
  focused by keyboard, or dragged, the line thickens and darkens
  (`--line-strong`).
- **Dragging moves the width as far as the pointer moves.** Where the rail
  already reaches the page's left edge (most windows up to about 1,900px), the
  panel's left edge stays put, so the line follows the pointer and the clip
  gives up or takes back width on its left; its right edge never moves. Where
  there is spare left margin, a wider panel first grows into it, as opening a
  panel does.
- **One width for every panel**, so switching panels still never moves the
  clip; only opening, closing or dragging does.
- **Limits:** 224px to 560px, and never so wide that the clip has less than
  400px beside it.
- **Keys:** tab to the divider and press ← → for 16px, Shift+← → for 64px.
  These work only on the focused divider, so they are not page shortcuts.
- **A press doesn't take the focus from the tab**, as the rail's buttons
  don't, so the cursor and selection stay and typing goes on into the tab;
  nothing on the page is text-selected during a drag. A right-button press
  does nothing.
- **Kept across visits** in `frets.tab.layout`, now `{ panel, width }`, written
  when a drag ends (not on every move) and on each key. Like the open panel, it
  is how the window is laid out, not a preference, so Settings doesn't list it.
  A missing, non-number or out-of-range width reads as 272px or the nearest
  limit; a missing panel reads as Notes.
- **Under 900px** the panel sits over the clip, so there is no divider.
- No double-click reset: Jeremy's apps avoid double-click triggers. Drag back,
  or use the keys.

## Tests

- `parseLayout` reads `{ panel: 'bars', width: 320 }` as 320; no width, a
  string, null or unreadable text as 272; 100 as 224, 9000 as 560, 300.6 as
  301; `{ width: 320 }` alone keeps Notes open.
- Dragging the divider 80px right makes the panel 352px (`--rail-panel-width`),
  writes nothing until the drag ends, then keeps `{ panel: 'notes', width: 352 }`.
- Switching to Bars keeps 352px.
- Dragging far left stops at 224px, far right at 560px.
- A right-button press doesn't resize.
- → makes 272 into 288; Shift+← then 224, which is kept.
- A kept `{ panel: 'chords', width: 400 }` opens Chords at 400px.
- No divider with every panel closed; under 900px it is hidden (CSS), and the
  open layout's column is `var(--rail-panel-width, 17rem)`.

## How

1. `TabRail.tsx`: `parseLayout` returns `{ panel, width }`; `keepLayout`
   writes one field and keeps the other; `usePanelWidth` holds the width;
   `PanelDivider` is the handle (`role="separator"`), inside the panel.
2. `tab.css`: the open layout's middle column is
   `var(--rail-panel-width, 17rem)`; `.tab-rail-divider` and its line; hidden
   under 900px.
3. The rail spec, `src/lib/README.md` (the key) and the Tab README.
