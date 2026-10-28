# Shared components (`src/components/`, `src/hooks/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/app/` — routes. `layout.tsx` wraps every page in `AppShell`. `/`
  and `/practice` are index pages; the trainers are
  `/practice/intervals` and `/practice/notes`, the Scale lab
  `/explore/scales`, Triads `/explore/triads`, the Circle of fifths `/explore/circle` (`?view=advanced`
  for its Advanced view, the modes), the Chords page `/chords`, the Tuner
  `/tuner`. Tab, `/tab`, is still being built: reachable by its URL only,
  it is in no menu and has no home page card yet.
- `src/components/sections.ts` — the app's map: the two groups, Tools and
  Practice, each with its pages (href, title, summary). A group is not a
  path: the Scale lab is a tool at `/explore/scales`. `AppNav`, the home
  page and the Practice page (`PageList`) are drawn from it, in its order,
  so a new page is an entry here, a route and its icon in `PageIcon.tsx`
  (a pictogram on a rosewood tile beside the card's title; a test checks
  every card has one, see `docs/specs/2026-10-15-page-icons-design.md`).
- `src/components/AppShell.tsx` — `AppNav` (breadcrumbs read from the URL:
  `BrandMark` and wordmark home, then the group and the page as one
  button opening a panel of every page with the current one marked; then
  `ThemeSwitch`, one button cycling Auto, Light, Dark; see `docs/specs/2026-10-06-breadcrumb-navigation-design.md`),
  `<main>` and `AppFooter` (source link and the build's commit hash, from
  `NEXT_PUBLIC_COMMIT_HASH` set in `next.config.ts`; unlinked `dev` when git
  was unavailable).
- `src/components/fretboard/` (SVG `Fretboard` with rounded fingerboard
  fill, roving-focus tap cells and arrow keys, an optional `box`
  outlining a fret range, and `mutedStrings`, faded and marked × beside
  the nut; `theme.ts` holds the board
  and dot colours as tokens, and `DEGREES`, the colour per degree number),
  `src/components/chords/` (`ChordDiagram`, the small shape diagram, coloured by an optional `look`;
  `ToneKey`; `chordDots.ts`, shape and arpeggio dots and a shape's muted strings
  for the neck; `export/`, the shapes' menu, Export dialog and PNG export),
  `src/components/controls.tsx` and `icons.tsx`, `src/components/HoverTips.tsx`
  (the one-second tip for any `data-tip`; the Circle of fifths and the Tab
  palette), `src/components/DotLabels.tsx`
  (the Interval / Note / None control and its type), `src/components/KeyPicker.tsx`
  (the root picker: a radio group of seventeen tiles, each sharp over its
  flat), `src/hooks/usePersist.ts` and `useSpaceKey.ts` (space toggles an
  Arpeggio, on the Chords and Triads pages).
- `src/app/manifest.ts` and `public/icons/` make the app installable (home
  screen, "Install app"); no service worker yet, so no offline use. See
  `docs/specs/2026-10-06-installable-app-design.md`.
