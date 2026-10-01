@AGENTS.md

# Frets

Guitar fretboard trainers (Intervals, Notes). Next.js 16 App Router with
static export (`out/`), React 19, TypeScript strict, Tailwind 4, Vitest.
Spec and prototypes: `design_handoff/README.md` and
`design_handoff/prototypes/*.dc.html` (their `<script data-dc-script>` logic
is the reference for quiz rules).
The prototypes remain the reference for quiz rules, not for the look: the
shipped styling follows `docs/specs/2026-10-01-soft-ui-design.md`.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Static export to out/
npm run lint     # ESLint (jsx-a11y at error severity)
npm test         # Vitest
```

In the Claude Code sandbox, `npm install` needs `--cache "$TMPDIR/npm-cache"`,
and `next build` / `next dev` must run unsandboxed (Turbopack's PostCSS worker
binds a local port).

## Layout

- `src/lib/` — pure logic, no React: `music.ts` (tuning, names,
  `intervalClass`), `intervals.ts` / `notes.ts` (settings, question
  generators taking an injectable `rng`, settings parsing), `quizFlow.ts`
  (shared miss/solve/pause scoring), `stats.ts`, `fretWindow.ts`,
  `fretboardGeometry.ts`, `storage.ts`.
- `src/components/intervals|notes/` — each trainer is a `useReducer` over a
  pure reducer (`intervalState.ts`, `noteState.ts`). Random questions are
  generated in the component and passed in actions, so reducers stay pure.
- `src/components/fretboard/` — shared SVG `Fretboard` (rounded fingerboard
  fill, roving-focus tap cells, arrow keys) and `theme.ts` (only the `maple`
  theme ships).
- `src/components/quiz/` — header, answer card/grid, board frame with
  hold-for-hint, settings drawer parts.
- `src/hooks/` — `useQuizKeyboard`, `useAutoAdvance`, `usePersist`.
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
jsdom's, so `setup.ts` installs an in-memory Storage.
