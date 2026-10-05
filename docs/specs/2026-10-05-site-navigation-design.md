# Site navigation: location and menu

## Problem

The bar showed the wordmark, one link per section and the Auto / Light /
Dark switch. Inside a section, that section's link was renamed to the
current page ("Interval trainer") but kept the muted colour every other
link had, so nothing marked where you were; it also still went to the
section index, not to the page it named. A trainer's `h1` is its question
("Name the interval"), so the page's name appeared nowhere else. Moving
between the two trainers went through the Practice index, which only
repeated the home page. On a phone the theme switch wrapped onto its own
row. `aria-current` was set only on the section index pages.

## Design

Options shown to Jeremy: sections then pages (two rows), a breadcrumb with
a switcher, every page in the bar, and location plus a menu. He picked
location plus a menu, then, from four menus (panel under the bar, side
drawer, compact list, the location as the button), the panel under the bar
(D1). Mockups: https://claude.ai/artifact/WAuPxSQx6Kuxh94tqxCXme and
https://claude.ai/artifact/QPiJ1AcMVxNi9b94XH1sst.

The bar, left to right:

- The brand mark and "Frets" wordmark, linking home. Below 640px the
  wordmark is visually hidden; the link keeps the name "Frets".
- The location, on every page but Home: the section name, muted, then
  "›", then the page title in `--ink`, e.g. "Practice › Interval trainer".
  It is text, not a link, and truncates with an ellipsis if it runs out of
  room.
- The theme button (below).
- The Menu button: a secondary button with a menu icon and "Menu"; below
  640px the icon alone, still named "Menu".

### Menu panel

The Menu button toggles a panel that hangs from the bar's bottom edge
across its full width, over the page. It holds one column per section
(stacked below 640px): the section name as a small uppercase heading, then
each page as a link showing its title and its one-line summary. The current
page's link has the `--primary-soft` fill, reads "You are here" beside its
title, and carries `aria-current="page"`.

The panel closes when you pick a page, press Esc, press Menu again, or
press anywhere outside the bar. Opening it moves focus to its first link;
Esc returns focus to the Menu button. While it is open, key presses inside
the bar don't reach the trainers' or the Scale lab's window shortcuts, so
digits and arrows don't answer a question behind the menu.

### Theme button

The three-way switch becomes one icon button that cycles Auto → Light →
Dark → Auto. Its icon shows the current choice (half-filled circle, sun,
moon); its name is "Theme: Auto" (or Light, Dark) and its tooltip names
the next choice. The choice is saved and restored as before.

### Section index pages

`/practice` and `/explore` are removed: the menu lists every page and Home
still lists them all under their section headings, which are no longer
links. Sections keep their label, summary and pages but lose their `href`.
No redirects (no users yet).
