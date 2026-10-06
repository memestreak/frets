# Site navigation: breadcrumbs

## Problem

The bar showed the wordmark, one link per section and the Auto / Light /
Dark switch. Inside a section, that section's link was relabelled with the
current page ("Scale lab") but kept the muted colour of every other link and
still went to the section page. So in the Scale lab, "Explore" disappeared
from the bar, nothing marked where you were, and the bar mixed "where can I
go" with "where am I". An earlier fix (a location label plus a Menu panel,
PR #26) never merged and is closed by this change.

## Design

Jeremy asked for breadcrumbs: in the Scale lab the bar reads "Explore ›
Scale lab". Options shown to him: plain breadcrumbs (A), crumbs that open a
list of sections or sibling pages (B), and crumbs plus a Menu panel (C).
Mockups: https://claude.ai/artifact/Ri1o1uVNMnvJLqXiaehcRB. He picked A.

After trying A on the preview, Jeremy asked (2026-10-06) that a click
anywhere on the breadcrumbs open a menu of the whole site, as the earlier
Menu panel did (PR #26), with something that makes clear where you are.

The bar is the logo, the path through the app's three levels, and the theme
switch, read from the URL with `locate` and drawn from `sections.ts`:

| Where | Bar |
| --- | --- |
| `/` | Frets |
| `/explore` | Frets › Explore ▾ |
| `/explore/scales` | Frets › Explore › Scale lab ▾ |

- The brand mark and "Frets" wordmark link Home, and carry
  `aria-current="page"` there. Below 640px, away from Home, the wordmark is
  visually hidden (the link keeps the name "Frets").
- The crumbs after it are one button with a down chevron: the section in
  `--ink-muted`, then the page in `--ink`, separated by "›" in
  `--line-strong` (hidden from screen readers). Its name reads "Explore ›
  Scale lab: show every page". A page title too long for the row is cut
  with an ellipsis. Home has no crumbs: it lists every page itself.
- The button opens a panel under the bar, one column per section (stacked
  on phones), each page with its one-line summary. Where you are is marked
  three ways: your section's heading is in `--primary`, your page sits on
  `--primary-soft` with "You are here", and it carries
  `aria-current="page"`. Section headings link to their section pages; on
  a section page the heading is the one marked.
- Opening the panel focuses the current page (or the first link). Esc
  closes it and returns focus to the crumbs; so do a press outside the bar,
  picking a page and pressing the crumbs again. While it is open, keys
  pressed in the bar stop there, so the trainers' and the Scale lab's
  window shortcuts don't act on the page behind it.
- The theme switch, on the right, becomes one icon button that cycles Auto,
  Light, Dark (a half-filled circle, a sun, a moon). Its name is "Theme:
  Auto" and its tooltip says what the next click picks. The three-way
  segmented switch took too much of a phone's width for the crumbs.
