@AGENTS.md

# Frets

Guitar fretboard app whose pages fall in two groups
(`docs/specs/2026-10-19-tools-and-practice-design.md`): Tools (the Scale lab,
Triads, the Circle of fifths, Chords, the Tuner, the Metronome, Tab) and
Practice (the Interval and Note trainers).
Next.js 16 App Router with static export (`out/`;
`docs/adr/2026-11-02-static-export.md`), React 19, TypeScript strict,
Tailwind 4, Vitest, tonal (pinned to 6.4.3;
`docs/adr/2026-11-02-tonal-pinned.md`).

The app has no users yet (`docs/adr/2026-11-02-no-users-yet.md`).

Every feature has a design spec in `docs/specs/`, named by date and topic;
it rides in the same PR as the code. A spec wins over the prototypes in
`design_handoff/prototypes/`, and Fretwood, not the prototypes, sets the
look (`docs/adr/2026-11-02-spec-over-prototype.md`).
`docs/pedagogy/` holds research on what to teach next (ideas, not specs).

`GLOSSARY.md` defines the app's own words. `docs/adr/` records decisions
with their reasons: the ones hard to reverse, and the product stances
someone might reverse without knowing why. Each folder's `README.md`
lists the specs that shaped it (`## Specs`) and the ADRs that bind it
(`## Decisions`). Before changing an area, read the glossary, that
folder's README, and the ADRs and specs it lists; if any don't exist
yet, carry on without them. Name things in code, tests, specs and PRs by
the glossary's terms, not the words it lists under `_Avoid_`. If a
change contradicts an ADR, say so and ask before going ahead. A PR that
introduces a word the glossary lacks, or a decision that reads like an
ADR, says so in its description rather than writing either. A spec's
`## Tests` list pins the values and "no"s the implementation must test;
a PR is not done until each has one.

`/grill-with-docs` (`.claude/skills/grill-with-docs/`) interviews Jeremy
about a plan, writes the glossary and ADRs as they settle, and ends with
the spec and the README updates. `/check-docs` reports where these
artifacts have drifted from each other or the code. `plans/` is retired:
the spec's "How" section is the work order; don't add to `plans/`.

## Keeping this file stable

Several threads work on this repo at once, and edits to this file conflict
with each other. Don't edit CLAUDE.md in a feature PR unless a rule,
convention or command changes. What a folder's files do is described in that
folder's `README.md`; update that instead:

- `src/lib/README.md` — shared pure logic, and every storage key
- `src/components/README.md` — shared components, hooks and the app's map
- `src/components/tuner/README.md` — the mic and the tuner
- `src/features/tuner/README.md` — the Tuner page and its MCP App
- `src/features/practice/README.md` — the trainers, and where their quiz
  rules depart from the prototypes
- `src/features/explore/README.md` — the Scale lab, Triads, the Circle of fifths
- `src/features/chords/README.md` — the Chords page and chord export
- `src/features/tab/README.md` — the Tab editor
- `src/features/metronome/README.md` — the Metronome
- `src/features/agents/README.md` — the Agents page, guides and skills
- `src/mcp/README.md` — the MCP server, and how a page adds its tools

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run dev:https  # Same over https (self-signed), for the mic from another device
npm run build    # The MCP Apps (mcp:build), then the static export to out/
npm run lint     # ESLint (jsx-a11y at error severity)
npm test         # Vitest
npm run typecheck  # tsc --noEmit (covers tests and config files too)
npm run icons    # Re-render every icon and favicon.ico after changing the mark's SVGs
npm run mcp:build  # Every MCP App (mcp/apps/*) and the stdio server, to mcp/dist/
npm run mcp:preview  # A stand-in MCP host for the apps, at localhost:5174
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
  feature. All music theory is in `src/lib/theory/`, the only importer of
  tonal (`docs/adr/2026-11-02-one-theory-core.md`).
- `src/features/<feature>/` — everything only one feature uses.
- `src/mcp/` — Frets' one MCP server (`frets`, served at `/mcp`;
  `docs/adr/2026-11-02-one-mcp-server.md`), which every page adds its
  tools to; a page's own tools and MCP App live in
  `src/features/<page>/mcp/`. `mcp/` holds the apps' build entries (Vite,
  outside the Next.js export) and the stdio server; `functions/` the
  Cloudflare Pages Functions (`/mcp`). To add a tool, follow
  `src/mcp/README.md`.
- Code moves into `src/lib/` or `src/components/` only once a second
  feature needs it.

Agents outside the repo write for Frets from the guides and skills in
`public/` (`docs/specs/2026-10-29-agent-skills-design.md`, listed in
`public/llms.txt`). A PR that changes what a page reads from its link, or
what the Tab page draws, updates that page's guide in the same PR, and its
`public/skills/*/SKILL.md` if the rules summarised there change.

A PR that adds or changes an MCP tool lists it on the Agents page's Frets
card and in `public/llms.txt` (step 4 of `src/mcp/README.md`).

Every page's keyboard shortcuts are listed in the `?` overlay
(`docs/specs/2026-10-30-keyboard-shortcuts-design.md`): a PR that adds,
changes or removes a key updates that page's `useShortcuts` list in the same
PR (Tab: `src/features/tab/shortcuts.ts`; a palette key comes from `tools.ts`
on its own).

Every page lets go of a widget after use
(`docs/specs/2026-10-30-let-go-after-use-design.md`) and of a selection on
Esc or a press elsewhere (`docs/specs/2026-11-01-deselect-design.md`).

Third-party material (the chord shapes, the tuner's recordings) is listed
with its licence in `NOTICE.md` and credited in the README's Credits; add
both for anything new.

## Styling

- `src/styles/fretwood.css` is the Fretwood design system
  (`docs/specs/2026-10-04-fretwood-design-system.md`): its tokens (names
  as in its `tokens.json`, light on `:root`, dark under
  `prefers-color-scheme` and `data-theme`), type and the shared component
  classes (`.btn-*`, `.seg`, `.card`, `.input`). It is imported into
  Tailwind's `components` layer; app-specific component CSS is in the same
  layer: shared components' in `src/styles/components.css`, a page's own in
  a CSS file in its folder (e.g. `src/features/tab/tab.css`), each
  `@import`ed by `globals.css`. Use tokens directly, e.g. `text-(--ink-muted)`,
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

Saved state lives in `localStorage`, every key listed in `src/lib/README.md`.
Preferences follow the settings philosophy
(`docs/specs/2026-10-29-settings-design.md`): one key per Settings section,
`frets.<page>.<section>` (app-wide: `frets.general.<section>`), each a JSON
object, and every preference listed in the Settings dialog. The work lives
under `frets.<page>.works.<id>`, with the page's index at `frets.<page>.works`.
Pages not yet in Settings keep their old keys, listed in `src/lib/README.md`.
The parser next
to each key validates every field; keep it in step with settings changes.

## Testing

Tests live in `src/__tests__/`, with a feature's tests in a folder named
after it (`practice/`, `explore/`, `chords/`). `helpers/rng.ts` provides a seeded RNG;
trainers accept an `rng` prop. Node 25's global `localStorage` shadows
jsdom's, so `setup.ts` installs an in-memory Storage. jsdom has no
`dialog.showModal()` / `close()`, so `setup.ts` also shims them with the
`open` attribute.
