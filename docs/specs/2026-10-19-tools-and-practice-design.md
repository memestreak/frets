# Home page: Tools and Practice

## Problem

The home page and the site menu grouped the pages by section, in the order
Explore, Chords, Practice, Tuner. Two of those (Chords, Tuner) were single
pages posing as sections, so the home page mixed group headings with page
headings and the menu had four columns for seven pages.

## Design

Jeremy asked (2026-10-19) for two groups: Practice, the quiz pages, and
Tools, everything else.

| Group | Pages |
| --- | --- |
| Tools | Scale lab, Chords, Triads, Circle of fifths, Tuner |
| Practice | Interval trainer, Note trainer |

- `sections.ts` holds the two groups, Tools first. Every entry is a page
  with a title, a summary and its icon; the "section with no pages" case is
  gone.
- A group is not a path: the URLs stay as they were (`/explore/scales`,
  `/chords`, `/tuner`, `/practice/notes`). `locate` finds a page by its exact
  URL, then its group.
- The home page shows each group's heading and summary over its cards.
  Practice's heading links to `/practice`, its index page; Tools has no
  index page, so its heading is plain text.
- The menu under the breadcrumbs has one column per group, the same way;
  only Practice's column heading is a link.
- The breadcrumbs name the group: "Tools › Scale lab", "Tools › Chords",
  "Practice › Note trainer", and "Practice" on `/practice`.
- `/explore`, the old Explore index page, is removed: nothing links to it.
