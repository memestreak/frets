@AGENTS.md

# Frets

Guitar fretboard trainers (Intervals, Notes). Next.js 16 App Router with
static export (`out/`), React 19, TypeScript strict, Tailwind 4, Vitest.
Spec and prototypes: `design_handoff/README.md` and
`design_handoff/prototypes/*.dc.html` (their `<script data-dc-script>` logic
is the reference for quiz rules).
The prototypes remain the reference for quiz rules, not for the look: the
shipped styling follows `docs/specs/2026-10-01-soft-ui-design.md`.
One quiz rule deliberately differs: the prototype names a note below the
root by its distance down, while `intervalClass` names it by its function
against the root (G below C is a P5).

The Interval trainer also departs from the prototype's String pairs setting,
fixed four-fret reach and "repeats allowed" rule: `vRange` / `hRange` define
a box around the root (`inBox` in `lib/intervals.ts`) that drives question
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
```

`.github/workflows/ci.yml` runs all four checks on Node 22 for every pull
request and every push to `main`.

In the Claude Code sandbox, `npm install` needs `--cache "$TMPDIR/npm-cache"`,
and `next build` / `next dev` must run unsandboxed (Turbopack's PostCSS worker
binds a local port).

## Layout

- `src/lib/` — pure logic, no React: `music.ts` (tuning, names,
  `intervalClass`), `intervals.ts` / `notes.ts` (settings, question
  generators taking an injectable `rng`, settings parsing), `quizFlow.ts`
  (shared miss/solve/pause scoring), `stats.ts`, `fretWindow.ts`,
  `fretboardGeometry.ts`, `storage.ts`.
- `src/components/intervals|notes/` — each trainer's `intervalState.ts` /
  `noteState.ts` is only its rules (answer key, Name-it or Find-it, correct,
  out of range) handed to the shared reducer in `quiz/trainerState.ts`. The
  component keeps what differs: its dots, prompt and settings fields. Random
  questions are generated outside the reducer and passed in actions, so it
  stays pure.
- `src/components/fretboard/` — shared SVG `Fretboard` (rounded fingerboard
  fill, roving-focus tap cells, arrow keys) and `theme.ts` (only the `maple`
  theme ships).
- `src/components/quiz/` — header, answer card/grid, board frame with
  hold-for-hint, `SettingsDialog` (native modal `<dialog>`) and its field
  parts, `SessionStatsCard` (summary, reset and per-item bars below the
  board). Also the code both trainers share: `trainerState.ts` (state,
  actions, reducer, init from storage) and `attempt.ts` (miss and
  out-of-range dots, answer-button state, feedback text).
- `src/components/AppShell.tsx` — nav, `<main>` and `AppFooter` (source
  link and the build's commit hash, from `NEXT_PUBLIC_COMMIT_HASH` set in
  `next.config.ts`; unlinked `dev` when git was unavailable).
- `src/hooks/` — `useTrainer` wires a trainer's reducer to `useQuizKeyboard`,
  `useAutoAdvance` and `usePersist`, and owns the hint and settings-dialog
  flags. It suspends the first two while the settings dialog is open.
- Trainers render client-only (`TrainerLoaders.tsx`, `ssr: false`) because
  their initial state reads localStorage and draws a random question.

## Styling

- `src/styles/industry.css` is the Industry design system, rethemed in place
  to the soft look (filled rounded cards, pill buttons and segmented
  controls); it no longer matches `design_handoff/`. It is imported into
  Tailwind's `components` layer; app component CSS is in the same layer in
  `globals.css`. Use DS tokens (`var(--color-*)`), e.g.
  `text-(--color-accent)`; Tailwind's default palette is disabled.
- Surfaces: page and cards are white (`--color-bg`, `--color-card`; cards
  are set off by their shadow), `--color-tile` (answer tiles, inputs),
  `--color-track` (segmented track, stat bars). Radii: `--radius-sm|md|lg|pill`. Fretboard:
  `--color-board`, `--color-board-inlay`, `--color-board-fret`.
- Status colors: `--color-success`, `--color-success-deep`, `--color-danger`.
- DS selectors like `.seg-opt:not(:has(input:checked)):hover` are fairly
  specific; overrides may need extra specificity.

## Storage

`localStorage["eminor.intervals.v2"]` and `["eminor.notes.v2"]` hold
`{ set, stats }`. Parsers in `lib/` validate every field; keep them in step
with settings changes.

## Testing

Tests live in `src/__tests__/`. `helpers/rng.ts` provides a seeded RNG;
trainers accept an `rng` prop. Node 25's global `localStorage` shadows
jsdom's, so `setup.ts` installs an in-memory Storage. jsdom has no
`dialog.showModal()` / `close()`, so `setup.ts` also shims them with the
`open` attribute.
