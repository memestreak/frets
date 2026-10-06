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

The bar is the path through the app's three levels, Home › section › page,
read from the URL with `locate` and drawn from `sections.ts`:

| Where | Bar |
| --- | --- |
| `/` | Frets |
| `/explore` | Frets › Explore |
| `/explore/scales` | Frets › Explore › Scale lab |

- Every crumb but the last is a link: "Frets" (the brand mark and
  wordmark) to Home, the section to its section page. The last crumb is the
  current page: `--ink`, not a link, `aria-current="page"`. Earlier crumbs
  are `--ink-muted` and turn `--ink` on hover. On Home the Frets link itself
  carries `aria-current="page"`.
- Crumbs are separated by "›" in `--line-strong`, hidden from screen
  readers. The crumbs are an ordered list in a `nav` labelled "Breadcrumb".
- Moving sideways means stepping up a crumb and picking: Home lists every
  page, a section page lists its own. With five pages, anything is at most
  two taps away. The section pages stay for this reason.
- Below 640px, away from Home, the wordmark is visually hidden (the link
  keeps the name "Frets"), and a page title too long for the row is cut with an ellipsis.
- The theme switch, on the right, becomes one icon button that cycles Auto,
  Light, Dark (a half-filled circle, a sun, a moon). Its name is "Theme:
  Auto" and its tooltip says what the next click picks. The three-way
  segmented switch took too much of a phone's width for the crumbs.

## Out of scope

A menu of every page, and switching to a sibling from its crumb (options B
and C). Revisit if sections grow past a few pages each.
