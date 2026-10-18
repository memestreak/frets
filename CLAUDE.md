@AGENTS.md

# Frets

Guitar fretboard app with four sections: Practice, holding two quiz
trainers (Intervals, Notes), Explore, holding the Scale lab and the Circle
of fifths, Chords, one page that looks a chord up by name and names
the notes tapped on the neck, and Tuner, one page with a dial or a strobe
(`docs/specs/2026-10-17-tuner-page-design.md`; see
`docs/specs/2026-10-04-practice-restructure-design.md`,
`docs/specs/2026-10-04-scale-lab-design.md`,
`docs/specs/2026-10-05-chord-library-design.md`,
`docs/specs/2026-10-05-chord-lab-design.md`,
`docs/specs/2026-10-06-simpler-chord-diagrams-design.md`,
`docs/specs/2026-10-06-chord-arpeggio-design.md`,
`docs/specs/2026-10-09-chord-lab-arpeggio-design.md`,
`docs/specs/2026-10-07-scale-lab-position-shapes-design.md`,
`docs/specs/2026-10-13-one-diatonic-chords-card-design.md`,
`docs/specs/2026-10-07-circle-of-fifths-design.md`,
`docs/specs/2026-10-09-published-chord-shapes-design.md`,
`docs/specs/2026-10-15-copy-chord-diagram-design.md`,
`docs/specs/2026-10-17-move-shape-design.md` (‹ › slide the shape and
its chord along the neck; ← → step through the shapes) and
`docs/specs/2026-10-15-one-chords-page-design.md`, which merged the Chord
library and the Chord lab into it). Both the Scale lab and the Chords page
pick their root from `KeyPicker`, tiles laid out like a piano's keys
(`docs/specs/2026-10-16-key-picker-design.md`), and label their neck's dots
with `DotLabelsPicker`, Interval, Note or None
(`docs/specs/2026-10-17-chord-neck-labels-design.md`); on the Chords page a
magnifier beside Type also finds a chord by its typed or pasted name
(`docs/specs/2026-10-16-chord-search-design.md`), and its Export options
choose the image's size and whether it is transparent
(`docs/specs/2026-10-17-export-size-design.md`). The app has no users
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
`docs/specs/2026-10-01-notes-modes-design.md`. Find it can also be answered
by playing the note into the microphone, beside tapping (the Mic button;
`docs/specs/2026-10-17-note-trainer-mic-design.md`). T or its Tuner button
opens the tuner over the page (`docs/specs/2026-10-17-tuner-design.md`), the
Tuner page's panel in a dialog.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run dev:https  # Same over https (self-signed), for the mic from another device
npm run build    # Static export to out/
npm run lint     # ESLint (jsx-a11y at error severity)
npm test         # Vitest
npm run typecheck  # tsc --noEmit (covers tests and config files too)
npm run icons    # Re-render every icon and favicon.ico after changing the mark's SVGs
```

`.github/workflows/ci.yml` runs all four checks for every pull request and
every push to `main`. `.node-version` pins Node 22 for both CI and the
Cloudflare Pages build; `engines` in `package.json` requires `>=22.13.0`.

In the Claude Code sandbox, `npm install` needs `--cache "$TMPDIR/npm-cache"`,
and `next build` / `next dev` must run unsandboxed (Turbopack's PostCSS worker
binds a local port).

## Layout

- `src/app/` — routes. `layout.tsx` wraps every page in `AppShell`. `/`,
  `/practice` and `/explore` are index pages; the trainers are
  `/practice/intervals` and `/practice/notes`, the Scale lab
  `/explore/scales`, the Circle of fifths `/explore/circle` (`?view=advanced`
  for its Advanced view, the modes), the Chords page `/chords` and the Tuner
  `/tuner`.
- `src/app/manifest.ts` and `public/icons/` make the app installable (home
  screen, "Install app"); no service worker yet, so no offline use. See
  `docs/specs/2026-10-06-installable-app-design.md`.
- `src/components/sections.ts` — the app's map: each section with its pages
  (href, title or label, summary). `AppNav`, the home page and section index pages
  (`PageList`) are drawn from it, in its order (Explore, Chords, Practice,
  Tuner),
  so a new page is an entry here, a route and its icon in `PageIcon.tsx`
  (a pictogram on a rosewood tile beside the card's title; a test checks
  every card has one, see `docs/specs/2026-10-15-page-icons-design.md`).
  A section with no pages (Chords, Tuner) is a page itself: the home page shows its
  summary as its card, the menu its summary under its name.
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
  `fretWindow.ts`, `fretboardGeometry.ts`, `storage.ts`; `chords/` with
  `chordTypes.ts`, the only tonal import outside the Scale lab: tonal's
  chord types (plus add11, add9(add11) and m(maj7)♯11, which it lacks;
  `docs/specs/2026-10-17-add11-chords-design.md`) with our groups and
  symbols, roots, `withBass` (a chord over a bass outside it;
  `docs/specs/2026-10-18-bass-outside-chord-design.md`), `chordOf` (spelled
  notes, tone labels, which tones a voicing may leave out) and
  `chordFromTones` (a type, or an unnamed chord, from a set of tones);
  `publishedShapes.ts`, the shapes guitarists play, from Haus of Chords
  (`data/haus-of-chords.json`, CC BY 4.0, credited in `NOTICE.md`;
  re-import with `scripts/import-haus-of-chords.py`, see `data/README.md`);
  `voicings.ts`, which shows those first and otherwise searches the neck
  for playable shapes (each rule a named constant), splits them into open,
  the best few moveable and all moveable, and picks the shapes in a
  five-fret position (`shapesInPosition`); `chordUrls.ts`, the Chord
  library's URLs),
  `src/components/fretboard/` (SVG `Fretboard` with rounded fingerboard
  fill, roving-focus tap cells and arrow keys, an optional `box`
  outlining a fret range, and `mutedStrings`, faded and marked × beside
  the nut; `theme.ts` holds the board
  and dot colours as tokens, and `DEGREES`, the colour per degree number),
  `src/components/chords/` (`ChordDiagram`, the small shape diagram, coloured by an optional `look`;
  `ToneKey`; `chordDots.ts`, shape and arpeggio dots and a shape's muted strings
  for the neck),
  `src/components/controls.tsx` and `icons.tsx`, `src/components/DotLabels.tsx`
  (the Interval / Note / None control and its type), `src/components/KeyPicker.tsx`
  (the root picker: a radio group of seventeen tiles, each sharp over its
  flat), and `src/hooks/usePersist.ts`.
- `src/components/tuner/` — the mic and the tuner, shared by the Note
  trainer and the Tuner page: `pitch.ts` (pure YIN detector, note names),
  `hold.ts` (pure: a note held since its onset, and how long counts),
  `listener.ts` (`MicListener`: getUserMedia, an analyser and a loop
  publishing readings outside React; `MicStatus` and the error words),
  `tuner.ts` (pure: nearest string, cents, strobe step), `pluck.ts` (the
  simulated string), `sounds.ts` (the recorded sets in `public/sounds/`
  and each one's measured tuning), `reference.ts` (plays a reference
  note; `referenceSounding` so the mic ignores it), `useTunerPitch.ts`,
  `settings.ts` (meter and sound, saved), `Dial.tsx`, `Strobe.tsx` and
  `TunerPanel.tsx` (switch, meter, reading, strings). The page itself is
  `src/features/tuner/TunerPage.tsx`, with its own mic.
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
    hint toggle, `SettingsDialog` and its field parts,
    `Modal` (the native modal `<dialog>` shell it and the tuner share), `SessionStatsCard`, and the hooks: `useTrainer` wires a reducer
    to `useQuizKeyboard`, `useAutoAdvance` and `usePersist`, owns the hint
    and settings-dialog flags, and suspends the first two while the dialog
    is open.
  - `mic/` — answering by playing, on the mic in `src/components/tuner/`:
    `useMic.ts` (status, toggle, remembered choice, each held note judged
    once), `MicButton.tsx` (fixed-size toggle with the live note and level)
    and `TunerDialog.tsx` (`TunerPanel` in a `Modal`; it borrows the
    trainer's mic, `useMic`'s `borrowed`). The shared reducer's
    `answerPitch` places a played pitch with the trainer's optional
    `placePitch` / `rightPitch` rules; only the Note trainer has them yet.
    The mic needs a secure context: https or localhost.
  - `TrainerLoaders.tsx` — trainers render client-only (`ssr: false`)
    because their initial state reads localStorage and draws a random
    question.
- `src/features/explore/` — the Scale lab (`scales/`), the Circle of
  fifths (`circle/`) and their client-only loaders. `theory.ts` is the only file that imports tonal: root and scale
  tables, spelled scales, mode rotation, diatonic chords (symbols and
  numerals from its own table) and the notes on the neck. `settings.ts` holds the saved
  settings and their parser; `ScaleLab.tsx` and `ScalePanel.tsx` draw the
  page. `DiatonicChords.tsx` is the one "Diatonic chords" card
  (`docs/specs/2026-10-13-one-diatonic-chords-card-design.md`): Triads /
  Sevenths, the Arpeggio toggle, the position's ‹ › and its two halves.
  `PositionShapes.tsx` (logic in `positions.ts`) draws every diatonic
  chord's shape in the same five frets, the only chord row, with ‹ n of m ›
  to cycle a chord's shapes and a link to the chord on the Chords page.
  `ChordOverScale.tsx` places `ChordLadder.tsx` / `ChordClock.tsx`
  (shared parts in `chordDiagram.tsx`), which draw a selected chord against
  the scale (`docs/specs/2026-10-04-chord-diagrams-design.md`). Selecting a
  chord must move nothing. With a chord selected, a click on anything but a
  control, or Esc, goes back to the scale.
  `circle/` is the Circle of fifths, its Circle (keys) and Advanced (modes)
  views on one wheel:
  `circle.ts` (pure: spokes, cells, key signatures, numerals, and the
  `keyWheel` / `modeWheel` models saying what every cell, ring note, chip
  and tip shows; a mode is spelled from its parent key, `parentKey`;
  spelling from `theory.ts`), `CircleWheel.tsx` (draws a model, with the
  ring of notes round it; knows no theory), `HoverTips.tsx` (the one-second tip for any
  `data-tip`), `KeyPanel.tsx` / `ModePanel.tsx` (the Parallel modes chord
  table) and the page,
  `CircleOfFifths.tsx`. Only the view is in the URL; nothing is saved.
- `src/features/chords/` — the Chords page (`ChordsPage.tsx`, the only
  stateful component, with its client-only loader), built on
  `src/lib/chords/` and `src/components/chords/`. The frets on the neck are
  the source of truth: picking a chord in `ChordPickers` puts its first
  shape there and keeps that chord, tapping names the notes afresh
  (`naming.ts`, every name for a set of notes, listed by `NameList`).
  `ChordPickers` also swaps the Type dropdown for a search box (the
  magnifier, or `/`); `chordSearch.ts` reads the name typed there.
  `ChordHeader.tsx`, `VoicingGroups.tsx`, `VoicingStepper.tsx`
  and `useSpaceKey.ts` (space toggles the Arpeggio) are its parts, and so is `export/`:
  right-click, a long press or Shift+F10 on a shape diagram (or the
  neck; `useShapeExport`, once per page) opens a menu
  (Copy as PNG, Export options…) and the Export dialog, whose Name
  starts on the deduced name; with a mouse a shape diagram (not the neck)
  also drags out as that PNG, drawn on hover; the image is
  `ChordDiagram` drawn with a concrete `look` (`exportStyle.ts`, whose
  palettes a test checks against `fretwood.css`), serialized and rasterized
  in `exportImage.ts`. The chord and the frets are in the URL, not storage:
  `/chords?chord=am7b5&shape=x-0-1-0-1-x` (either may be left out); a pick
  in the menus adds a history entry, everything else replaces it; slugs in
  `src/lib/chords/chordUrls.ts`.
- Code moves into `src/lib/` or `src/components/` only once a second section
  needs it.

Third-party material (the chord shapes, the tuner's recordings) is listed
with its licence in `NOTICE.md` and credited in the README's Credits; add
both for anything new.

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
hold `{ set, stats }` (the Note trainer's set includes the mic choice);
`["frets.tuner.settings"]` holds the tuner's meter and reference sound,
for the page and the trainer's tuner alike; `["frets.explore.scales"]` holds the Scale lab's
settings; `["frets.chords.export"]` holds the Export dialog's choices; `["frets.chords.neck"]` the Chords neck's dot labels; `["frets.theme"]` holds the theme choice. Keys are `frets.<section>.<page>`. The parsers next to
each key validate every field; keep them in step with settings changes.

## Testing

Tests live in `src/__tests__/`, with a feature's tests in a folder named
after it (`practice/`, `explore/`, `chords/`). `helpers/rng.ts` provides a seeded RNG;
trainers accept an `rng` prop. Node 25's global `localStorage` shadows
jsdom's, so `setup.ts` installs an in-memory Storage. jsdom has no
`dialog.showModal()` / `close()`, so `setup.ts` also shims them with the
`open` attribute.
