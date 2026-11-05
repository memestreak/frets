# Shared components (`src/components/`, `src/hooks/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/app/` — routes. `layout.tsx` wraps every page in `AppShell`. `/`
  and `/practice` are index pages; the trainers are
  `/practice/intervals` and `/practice/notes`, the Scale lab
  `/explore/scales`, Triads `/explore/triads`, the Circle of fifths `/explore/circle` (`?view=advanced`
  for its Advanced view, the modes), the Chords page `/chords`, the Tuner
  `/tuner`, the Tab editor `/tab`, the Metronome `/metronome`.
- `src/styles/components.css` — the CSS of the components here, beyond
  Fretwood's (`fretwood.css`); a page's own CSS is in its folder. Both are
  imported into the `components` layer by `src/app/globals.css`.
- `src/components/sections.ts` — the app's map: the groups Tools, Practice
  and More (the Agents page), each with its pages (href, title, summary). A group is not a
  path: the Scale lab is a tool at `/explore/scales`. `AppNav`, the home
  page and the Practice page (`PageList`) are drawn from it, in its order,
  so a new page is an entry here, a route and its icon in `PageIcon.tsx`
  (a pictogram on a rosewood tile beside the card's title; a test checks
  every card has one, see `docs/specs/2026-10-15-page-icons-design.md`).
- `src/components/AppShell.tsx` — `AppNav` (breadcrumbs read from the URL:
  `BrandMark` and wordmark home, then the group and the page as one
  button opening a panel of every page with the current one marked; then
  `ThemeSwitch`, one button cycling Auto, Light, Dark; see `docs/specs/2026-10-06-breadcrumb-navigation-design.md`),
  `<main>` and `AppFooter` (source link, the Agents link and the build's commit hash, from
  `NEXT_PUBLIC_COMMIT_HASH` set in `next.config.ts`; unlinked `dev` when git
  was unavailable).
- `src/components/fretboard/` (SVG `Fretboard` with rounded fingerboard
  fill, roving-focus tap cells and arrow keys, an optional `box`
  outlining a fret range, and `mutedStrings`, faded and marked × beside
  the nut; `theme.ts` holds the board
  and dot colours as tokens, and `DEGREES`, the colour per degree number),
  `src/components/chords/` (`ChordDiagram`, the small shape diagram, coloured by an optional `look`;
  `ToneKey`; `chordDots.ts`, shape and arpeggio dots and a shape's muted strings
  for the neck; `export/`, the shapes' menu (`ShapeMenu`, with submenus: an item's `items`, opened by a press, hover or →), Export dialog and PNG export),
  `src/components/controls.tsx` and `icons.tsx`, `src/components/HoverTips.tsx`
  (the one-second tip for any `data-tip`; the Circle of fifths and the Tab
  palette), `src/components/DotLabels.tsx`
  (the Interval / Note / None control and its type), `src/components/KeyPicker.tsx`
  (the root picker: a radio group of seventeen tiles, each sharp over its
  flat), `src/hooks/usePersist.ts` and `useSpaceKey.ts` (space toggles an
  Arpeggio, on the Chords and Triads pages),
  `src/hooks/useDeselect.ts` (Esc or a press off it and the controls lets
  any selection go, the same on every page: the Scale lab's chord, a Triads
  grip, the Tab selection and line, Arrangements…' picked files;
  `docs/specs/2026-11-01-deselect-design.md`),
  `src/components/NumberField.tsx` (a number with up and down buttons:
  type, step, or drag up or down, `dragStep` a drag's step and Shift the
  button step; `resetOnDoubleClick` for its row) and `VolumeKnob.tsx` (a
  small rotary knob for a volume or level; `reset` for a double-click,
  `disabled` to grey it), shared by Tab and the Metronome,
  `src/components/TapPulse.tsx` (`useTapPulse`: a Tap button's green
  flash on each press, with `.tap-press`/`.tap-pulse` in
  `src/styles/components.css`; the Metronome's Tap and show_tab's),
  `src/components/LetGoAfterUse.tsx` and `src/hooks/useLetGoAfterUse.ts`
  (mounted once by `AppShell`: a button, link or list used with the mouse
  or a finger lets go of the focus, so no widget stays outlined or keeps
  the page's keys, and a button that opened a dialog lets go again when
  it closes; keyboard use keeps it. A list closed with no choice lets go
  at the mouse's next move, and `letGoOfFields` is for a control that keeps
  the focus off itself, so a field typed in lets go when it is pressed; see
  `docs/specs/2026-10-30-let-go-after-use-design.md`).
- `src/components/shortcuts/` — the keyboard shortcuts overlay (issue #180,
  `docs/specs/2026-10-30-keyboard-shortcuts-design.md`): `?` anywhere but a
  field shows the page's shortcuts, mounted once by `AppShell`. A page hands
  its list to `useShortcuts` (a module constant; the Tab page's is
  `src/features/tab/shortcuts.ts`, its palette rows read from `tools.ts`);
  a page's ? button (Tab's, right of its gear) calls `showShortcuts`.
  `src/components/Modal.tsx` is the native modal `<dialog>` shell it, the
  trainers' dialogs and the Tab page's dialogs share.
- `src/components/mocks/` — the mock switcher
  (`docs/specs/2026-11-01-mock-switcher-design.md`): a page offering looks to
  choose from declares each with `useMock({ param, label, options })` (a module
  constant) and draws the option it returns; `MockSwitcher`, mounted once by
  `AppShell`, shows a small card at the bottom right whenever the link names one
  of the page's mocks (`?mock=b`), and switches them in place. Mocks never
  merge: `noMocksLeft.test.ts` fails while any page calls `useMock`.
- `src/components/settings/` — the Settings dialog (issue #195,
  `docs/specs/2026-10-29-settings-design.md`): `SettingsDialog.tsx` (the tree
  of groups and sections, on a phone a group picker and a strip of sections;
  the selected section's rows; staged values, OK / Cancel / Apply, Enter = OK,
  a double-click or long-press on a label resetting its field), `types.ts`
  (a group is a list of sections, each one saved key; a field is one of its
  values), `fields.tsx` (the check box and segmented fields every page uses)
  and `general.tsx` (General › Appearance › Theme, shared with `ThemeSwitch`).
  Each page builds its own group on its state (Tab: `tabSettings.tsx`) and
  shows a gear after its page actions; `usePreferenceSaveProblem`
  (`src/hooks/usePersist.ts`) drives the ⚠ after it.
- `src/app/manifest.ts` and `public/icons/` make the app installable (home
  screen, "Install app"); no service worker yet, so no offline use. See
  `docs/specs/2026-10-06-installable-app-design.md`.

## Specs

- `docs/specs/2026-11-01-mock-switcher-design.md`: ?mock= options switch in
  place from a small card; mocks never merge
- `docs/specs/2026-11-01-deselect-design.md`: Esc or a press away lets any
  selection go, on every page
- `docs/specs/2026-10-30-let-go-after-use-design.md`: a control used with
  mouse or finger lets go of the focus
- `docs/specs/2026-10-30-keyboard-shortcuts-design.md`: ? shows the page's
  keyboard shortcuts; each page keeps its list
- `docs/specs/2026-10-29-settings-design.md`: one Settings dialog for every
  Preference, one key per Section
- `docs/specs/2026-10-19-tools-and-practice-design.md`: the pages fall in two
  Groups, Tools and Practice
- `docs/specs/2026-10-19-key-picker-two-tone-design.md`: the key picker's
  sharps and flats a shade darker, like black keys
- `docs/specs/2026-10-18-every-tile-shapes-design.md`: every diatonic tile
  cycles its shapes; Open in Chords from the menu
- `docs/specs/2026-10-17-export-size-design.md`: the Export dialog picks the
  image's size and transparency
- `docs/specs/2026-10-17-chord-neck-labels-design.md`: the Chords neck gets
  Dot labels: Interval, Note or None
- `docs/specs/2026-10-16-key-picker-design.md`: the root picker becomes a row
  of tiles laid out like piano keys
- `docs/specs/2026-10-16-chord-diagram-fret-label-design.md`: every small
  shape diagram labels its starting fret
- `docs/specs/2026-10-15-page-icons-design.md`: a pictogram tile for every
  page card; a test checks each has one
- `docs/specs/2026-10-15-copy-chord-diagram-design.md`: a right-click menu and
  Export dialog copy a shape diagram as an image
- `docs/specs/2026-10-06-simpler-chord-diagrams-design.md`: small shape
  diagrams show colour without labels
- `docs/specs/2026-10-06-installable-app-design.md`: a manifest and icons make
  the app installable; no offline use yet
- `docs/specs/2026-10-06-e-minor-mark-design.md`: the Frets mark and favicon
  are an E minor chord
- `docs/specs/2026-10-06-breadcrumb-navigation-design.md`: breadcrumb
  navigation: home, group and page, with a panel of every page
- `docs/specs/2026-10-04-practice-restructure-design.md`: shared code moves
  out of the trainers into lib, components and hooks
- `docs/specs/2026-10-04-fretwood-design-system.md`: Fretwood: the app's
  tokens, type and shared component classes
- `docs/specs/2026-10-01-soft-ui-design.md`: rounded cards and pill controls
  (superseded by Fretwood)

## Decisions

- `docs/adr/2026-11-02-spec-over-prototype.md`: the spec wins; Fretwood sets
  the look
