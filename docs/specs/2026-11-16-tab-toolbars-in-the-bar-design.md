# Tab: the page's buttons in the site's bar, one row over the clip

Jeremy, 2026-11-16, an annotated screenshot of `/tab`: the row of file buttons moves up into the
site's bar, the view switch and its buttons move up onto the row with Staff | Tab | Both and Size,
and the folded title moves to the score's top right. Two rows go, so the music starts higher.

How the arrows were read:

- The file buttons' arrow ends in the bar's empty right side, left of the theme switch: they sit there,
  in the same order, the theme switch staying last.
- The view switch's arrow points up at the row with Staff | Tab | Both: one row, the switch and its
  buttons at its right, as before.
- The folded title's arrow ends at the drawing's right edge, level with "Standard tuning": it sits at
  the head's top right, on the tuning's line.

This changes `2026-10-31-tab-arrangement-chooser-design.md` (where the page's buttons are),
`2026-11-01-tab-arrangement-header-design.md` (where the folded title is) and
`2026-11-15-tab-palette-sides-design.md` (the buttons no longer end over the clip card's edge).

## What

- **The page's buttons** (New, Arrangements…, Save, Save as…, Import…, Export, Settings, its ⚠ when
  settings can't be saved, and Shortcuts) are drawn in the site's bar, after the breadcrumbs, before
  the theme switch. They keep their look, tips and keys (⌘S, ⇧⌘S, ⌘O). Save's unsaved dot is there too.
- **Too narrow for them** beside the breadcrumbs (under 1024px), they take a line of their own under
  the logo, breadcrumbs and theme switch, ending at the right, wrapping as they must on a phone.
- **Other pages** have no buttons there; their bar is as it was.
- **Over the clip, one row**: Staff | Tab | Both and Size at the left, the view switch, View options,
  copy, Copy link and Download at the right. When the card is too narrow for both (a narrow window,
  or wide palettes), the right group still wraps under the left, as before.
- **The folded title** (the View options' Arrangement header off) is at the head's top right, on the
  tuning's line, scaled with Size as the head is. Picked, its Edit and Expand header are to its left,
  so they stay over the drawing. Everything else about picking and editing it is as before.

## Tests

- In a page rendered with the site's bar, New … Shortcuts are inside the bar's `#page-actions`, before the
  theme switch; rendered alone (no bar), they are still on the page, and work.
- `#page-actions` is empty, and hidden on a narrow window, on every page but Tab.
- The folded title is inside the score head (`.score-head .tab-head-folded`), not in the card's bar;
  pressed, it is picked with Edit and Expand header; Expand brings the full head back.
- The card's bar holds the view switch (`.tab-card-end`) and Staff | Tab | Both (`.tab-card-start`).

## How

1. `src/components/PageActions.tsx`: a page's buttons, drawn (a portal) into `AppNav`'s
   `#page-actions`, or in place when there is no bar.
2. `AppNav.tsx`: the `#page-actions` spot before the theme switch; the bar wraps, the spot taking its
   own line under 1024px.
3. `TabPage.tsx`: the buttons' `<header>` row becomes `PageActions`; the folded title leaves the card's
   bar; `.tab-page` drops `data-right` and `--rail-right`, and `tab.css` the header's margins.
4. `ScoreHead.tsx`: `onExpand`, drawing the folded title at its top right (`.score-folded-title`).
5. Tests in `src/__tests__/tab/page/` and `src/__tests__/tab/headEditing.test.tsx`; the Tab and
   components READMEs.
