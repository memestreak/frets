@AGENTS.md

# Frets

Guitar fretboard app with three sections: Practice, holding two quiz
trainers (Intervals, Notes), Explore, holding the Scale lab and the Circle
of fifths, and Chords,
holding the Chord library and the Chord lab (see
`docs/specs/2026-10-04-practice-restructure-design.md`,
`docs/specs/2026-10-04-scale-lab-design.md`,
`docs/specs/2026-10-05-chord-library-design.md`,
`docs/specs/2026-10-05-chord-lab-design.md`,
`docs/specs/2026-10-06-simpler-chord-diagrams-design.md` and
`docs/specs/2026-10-06-chord-arpeggio-design.md` and
`docs/specs/2026-10-07-circle-of-fifths-design.md`). The app has no users
yet: don't keep old URLs, storage keys or saved state working after a change.
Next.js 16 App Router with
static export (`out/`), React 19, TypeScript strict, Tailwind 4, Vitest,
tonal (pinned to 6.4.3: 6.5.0 can't be imported under Node).
Spec and prototypes: `design_handoff/README.md` and
`design_handoff/prototypes/*.dc.html`. The prototypes' `<script
data-dc-script>` logic is where the quiz rules started, and is still the
reference for anything the specs in `docs/specs/` do not cover. Where a spec
and a prototype disagree, the spec wins; the departures are listed below.
The prototypes are not a reference for the look: the shipped styling is the
Fretwood design system, applied as `docs/specs/2026-10-04-fretwood-design-system.md`
describes.

One quiz rule deliberately differs: the prototype names a note below the
root by its distance down, while `intervalClass` names it by its function
against the root (G below C is a P5).

The Interval trainer also departs from the prototype's String pairs setting,
fixed four-fret reach and "repeats allowed" rule: `vRange` / `hRange` define
a box around the root (`inBox` in `features/practice/intervals/intervals.ts`) that drives question
generation and Find-it judging. Neither the board nor the hint shows the box;
tapping the right interval outside it is explained, not scored. The generator
enumerates every valid question, so each possible interval is asked equally
often and the same question never comes up twice running. See
`docs/specs/2026-10-01-interval-ranges-design.md`.

The Note trainer departs from the prototype's three modes: it has Name it
and Find it, and both settings (Strings in scope, Fret range) apply to both.
Find it names one string; the right note on that string outside the range is
explained, not scored, and the board never draws the range. Its generator
also enumerates every valid question. See
`docs/specs/2026-10-01-notes-modes-design.md`.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Static export to out/
npm run lint     # ESLint (jsx-a11y at error severity)
npm test         # Vitest
npm run typecheck  # tsc --noEmit (covers tests and config files too)
npm run icons    # Re-render every icon and favicon.ico after changing the mark's SVGs
```

`.github/workflows/ci.yml` runs all four checks on Node 22 for every pull
request and every push to `main`.

In the Claude Code sandbox, `npm install` needs `--cache "$TMPDIR/npm-cache"`,
and `next build` / `next dev` must run unsandboxed (Turbopack's PostCSS worker
binds a local port).

## Layout

- `src/app/` — routes. `layout.tsx` wraps every page in `AppShell`. `/`,
  `/practice`, `/explore` and `/chords` are index pages; the trainers are
  `/practice/intervals` and `/practice/notes`, the Scale lab
  `/explore/scales`, the Circle of fifths `/explore/circle` (`?view=mode`
  for its Mode view), the Chord library `/chords/library` and the Chord lab
  `/chords/lab`.
- `src/app/manifest.ts` and `public/icons/` make the app installable (home
  screen, "Install app"); no service worker yet, so no offline use. See
  `docs/specs/2026-10-06-installable-app-design.md`.
- `src/components/sections.ts` — the app's map: each section with its pages
  (href, title or label, summary). `AppNav`, the home page and section index pages
  (`PageList`) are drawn from it, so a new page is an entry here plus a route.
- `src/components/AppShell.tsx` — `AppNav` (breadcrumbs read from the URL:
  `BrandMark` and wordmark home, then the section and the page as one
  button opening a panel of every page with the current one marked; then
  `ThemeSwitch`, one button cycling Auto, Light, Dark; see `docs/specs/2026-10-06-breadcrumb-navigation-design.md`),
  `<main>` and `AppFooter` (source link and the build's commit hash, from
  `NEXT_PUBLIC_COMMIT_HASH` set in `next.config.ts`; unlinked `dev` when git
  was unavailable).
- Shared by every feature: `src/lib/` (pure logic, no React: `music.ts`
  with tuning, names, `intervalClass` and
  `positionsOnNeck`; `notation.ts` with `prettyNote`;
  `fretWindow.ts`, `fretboardGeometry.ts`, `storage.ts`),
  `src/components/fretboard/` (SVG `Fretboard` with rounded fingerboard
  fill, roving-focus tap cells and arrow keys; `theme.ts` holds the board
  and dot colours as tokens, and `DEGREES`, the colour per degree number),
  `src/components/controls.tsx` and `icons.tsx`, and `src/hooks/usePersist.ts`.
- `src/features/<section>/` — everything only one section uses. For
  `practice/`:
  - `intervals/` and `notes/` — each trainer's pure logic (`intervals.ts` /
    `notes.ts`: settings, question generators taking an injectable `rng`,
    settings parsing, storage key), its rules (`intervalState.ts` /
    `noteState.ts`: answer key, Name-it or Find-it, correct, out of range,
    handed to the shared reducer) and its component, which keeps what
    differs: dots, prompt and settings fields. Random questions are
    generated outside the reducer and passed in actions, so it stays pure.
  - `quiz/` — what both trainers share: `trainerState.ts` (state, actions,
    reducer, init from storage), `quizFlow.ts` (miss/solve/pause scoring),
    `stats.ts`, `attempt.ts` (miss and out-of-range dots, answer-button
    state, feedback text), the header, answer card/grid, board frame with
    hint toggle, `SettingsDialog` (native modal `<dialog>`) and its field
    parts, `SessionStatsCard`, and the hooks: `useTrainer` wires a reducer
    to `useQuizKeyboard`, `useAutoAdvance` and `usePersist`, owns the hint
    and settings-dialog flags, and suspends the first two while the dialog
    is open.
  - `TrainerLoaders.tsx` — trainers render client-only (`ssr: false`)
    because their initial state reads localStorage and draws a random
    question.
- `src/features/explore/` — the Scale lab (`scales/`), the Circle of
  fifths (`circle/`) and their client-only loaders. `theory.ts` is the only file that imports tonal: root and scale
  tables, spelled scales, mode rotation, diatonic chords (symbols and
  numerals from its own table) and the notes on the neck. `settings.ts` holds the saved
  settings and their parser; `ScaleLab.tsx`, `ScalePanel.tsx` and
  `ChordStrip.tsx` draw the page, and `ChordLadder.tsx` / `ChordClock.tsx`
  (shared parts in `chordDiagram.tsx`) draw a selected chord against the
  scale (`docs/specs/2026-10-04-chord-diagrams-design.md`).
  `circle/` is the Circle of fifths, Key and Mode views on one wheel:
  `circle.ts` (pure: spokes, cells, key signatures, numerals, and the
  `keyWheel` / `modeWheel` models saying what every cell, chip and tip
  shows; spelling from `theory.ts`), `CircleWheel.tsx` (draws a model,
  knows no theory), `HoverTips.tsx` (the one-second tip for any
  `data-tip`), `KeyPanel.tsx` / `ModePanel.tsx` and the page,
  `CircleOfFifths.tsx`. Only the view is in the URL; nothing is saved.
- `src/features/chords/` — the Chord library (`library/`, with its
  client-only loader) and the Chord lab (`lab/`). `chordTypes.ts` is the
  section's only tonal import: tonal's chord types with our groups and
  symbols, roots, `chordOf` (spelled notes, tone labels, which tones a
  voicing may leave out) and `chordFromTones` (a type, or an unnamed chord,
  from a set of tones). `naming.ts` gives every name for a set of notes.
  `voicings.ts` searches the neck for playable shapes (each rule a named
  constant) and splits them into open, the best few moveable, and all
  moveable. `ChordHeader.tsx`, `ChordDiagram.tsx`, `ToneKey.tsx`, `VoicingGroups.tsx`
  and `chordDots.ts` (shape dots, and the arpeggio the library's Arpeggio toggle
  shows) are shared by both pages; `library/ChordLibrary.tsx` and
  `lab/ChordLab.tsx` are the pages and their only stateful components. The chord is in the URL, not storage:
  `/chords/library?chord=am7b5`, slugs in `library/chordUrls.ts`.
- Code moves into `src/lib/` or `src/components/` only once a second section
  needs it.

## Styling

- `src/styles/fretwood.css` is the Fretwood design system: its tokens (names
  as in its `tokens.json`, light on `:root`, dark under
  `prefers-color-scheme` and `data-theme`), type and the shared component
  classes (`.btn-*`, `.seg`, `.card`, `.input`). It is imported into
  Tailwind's `components` layer; app-specific component CSS is in the same
  layer in `globals.css`. Use tokens directly, e.g. `text-(--ink-muted)`,
  `bg-(--surface-raised)`; Tailwind's default palette is disabled.
- Surfaces: `--surface` (page), `--surface-raised` (cards, dialogs, inputs),
  `--surface-sunken` (segmented track, answer tiles, stat bars). Lines
  `--line` / `--line-strong`. Text `--ink` / `--ink-muted`. Status
  `--success`, `--danger`. Fretboard `--fretboard`, `--fret-wire`, `--nut`,
  `--inlay`, `--string`, `--dot-*`, `--degree-*`.
- Fonts: `--font-display` (Fraunces, `h1` and wordmark), `--font-sans`
  (Figtree) and `--font-mono` (JetBrains Mono, the Scale lab's diagram degrees),
  self-hosted in `src/app/fonts/`.
- Theme: `src/lib/theme.ts` (choice, `data-theme`, the `<head>` boot script)
  and `ThemeSwitch`. Every colour must be a token so both themes work.
- `.seg-opt` is a button (`aria-pressed`) or a link (`aria-current`); its
  selected and hover rules key off those attributes.

## Storage

`localStorage["frets.practice.intervals"]` and `["frets.practice.notes"]`
hold `{ set, stats }`; `["frets.explore.scales"]` holds the Scale lab's
settings; `["frets.theme"]` holds the theme choice. Keys are `frets.<section>.<page>`. The parsers next to
each key validate every field; keep them in step with settings changes.

## Testing

Tests live in `src/__tests__/`, with a feature's tests in a folder named
after it (`practice/`, `explore/`, `chords/`). `helpers/rng.ts` provides a seeded RNG;
trainers accept an `rng` prop. Node 25's global `localStorage` shadows
jsdom's, so `setup.ts` installs an in-memory Storage. jsdom has no
`dialog.showModal()` / `close()`, so `setup.ts` also shims them with the
`open` attribute.
