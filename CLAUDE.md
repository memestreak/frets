@AGENTS.md

# Frets

Guitar fretboard app whose pages fall in two groups
(`docs/specs/2026-10-19-tools-and-practice-design.md`): Tools (the Scale lab,
Triads, the Circle of fifths, Chords, the Tuner) and Practice (the Interval
and Note trainers). Tab, `/tab`, is still being built and is in no menu yet.
Next.js 16 App Router with static export (`out/`), React 19, TypeScript
strict, Tailwind 4, Vitest, tonal (pinned to 6.4.3: 6.5.0 can't be imported
under Node).

The app has no users yet: don't keep old URLs, storage keys or saved state
working after a change.

Every feature has a design spec in `docs/specs/`, named by date and topic;
it rides in the same PR as the code. Where a spec and the prototypes in
`design_handoff/prototypes/*.dc.html` disagree, the spec wins. The
prototypes are not a reference for the look: the shipped styling is the
Fretwood design system (`docs/specs/2026-10-04-fretwood-design-system.md`).
`docs/pedagogy/` holds research on what to teach next (ideas, not specs).

## Keeping this file stable

Several threads work on this repo at once, and edits to this file conflict
with each other. Don't edit CLAUDE.md in a feature PR unless a rule,
convention or command changes. What a folder's files do is described in that
folder's `README.md`; update that instead:

- `src/lib/README.md` — shared pure logic, and every storage key
- `src/components/README.md` — shared components, hooks and the app's map
- `src/components/tuner/README.md` — the mic and the tuner
- `src/features/practice/README.md` — the trainers, and where their quiz
  rules depart from the prototypes
- `src/features/explore/README.md` — the Scale lab, Triads, the Circle of fifths
- `src/features/chords/README.md` — the Chords page and chord export
- `src/features/tab/README.md` — the Tab editor

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

- `src/app/` — routes. `layout.tsx` wraps every page in `AppShell`.
- `src/lib/`, `src/components/`, `src/hooks/` — shared by more than one
  section.
- `src/features/<section>/` — everything only one section uses.
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

Saved state lives in `localStorage` under keys named
`frets.<section>.<page>`, listed in `src/lib/README.md`. The parser next to
each key validates every field; keep it in step with settings changes.

## Testing

Tests live in `src/__tests__/`, with a feature's tests in a folder named
after it (`practice/`, `explore/`, `chords/`). `helpers/rng.ts` provides a seeded RNG;
trainers accept an `rng` prop. Node 25's global `localStorage` shadows
jsdom's, so `setup.ts` installs an in-memory Storage. jsdom has no
`dialog.showModal()` / `close()`, so `setup.ts` also shims them with the
`open` attribute.
