# Source code and build commit footer

## Goal

Show a small footer at the bottom of every Frets page, matching the one in
xox (`~/repos/xox/src/app/Sequencer.tsx:100`):

```
                 SOURCE CODE          BUILT AT COMMIT ABCD123
```

- `SOURCE CODE` links to https://github.com/memestreak/frets (public repo),
  opening in a new tab.
- `BUILT AT COMMIT <short hash>`: the hash links to
  `https://github.com/memestreak/frets/commit/<hash>` in a new tab. When no
  hash is available it reads `dev` as plain text, with no link.

## What already exists

- `next.config.ts` is identical to xox's: it runs
  `git rev-parse --short HEAD` at build time and exposes the result as
  `process.env.NEXT_PUBLIC_COMMIT_HASH` (falling back to `dev`). Nothing in
  `src/` reads it yet. No config change is needed.
- `src/components/AppShell.tsx` wraps both trainers in a
  `flex min-h-screen flex-col` column with `<main className="... flex-1">`,
  so a `<footer>` added after `<main>` sits at the bottom of the viewport on
  short pages and below the content on long ones.

## Design

- New component `src/components/AppFooter.tsx`, rendered by `AppShell` after
  `<main>`. It is a server-safe component with no state.
- Layout: same as xox, a three-column grid with an empty first cell, the
  link centred and the commit right-aligned, inside the same
  `mx-auto w-full max-w-[1240px] px-5` box as `<main>` so the edges line up
  with the cards. Below `sm` the two items stack, centred, so the commit
  text never wraps awkwardly at phone width.
- Type: 10px, uppercase, bold, `tracking-[0.2em]`, as in xox. Barlow
  throughout (Frets ships no mono face, so the hash is not monospaced).
- Colour: `text-(--color-neutral-700)` on the white page (about 6.6:1;
  `neutral-600` would be about 4.3:1, under AA for text this small). The
  link goes to `--color-accent` on hover and keeps the default focus ring.
- Link attributes: `target="_blank" rel="noopener noreferrer"`.

As built, the links also need `text-inherit` (the design system colours
every `<a>` with the accent) and the source link needs
`justify-self-center` so it does not stretch across its grid cell.

Original sketch of the component (before the hash became a link):

```tsx
export function AppFooter() {
  return (
    <footer className="mx-auto grid w-full max-w-[1240px] gap-y-1 px-5 pt-3 pb-5 text-center text-[10px] font-bold tracking-[0.2em] text-(--color-neutral-700) uppercase sm:grid-cols-3 sm:items-center">
      <div className="max-sm:hidden" />
      <a
        href="https://github.com/memestreak/frets"
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-(--color-accent)"
      >
        Source Code
      </a>
      <span className="sm:text-right">
        Built at commit {process.env.NEXT_PUBLIC_COMMIT_HASH ?? 'dev'}
      </span>
    </footer>
  );
}
```

## Steps

1. Branch `footer-source-commit` in a worktree under `.worktrees/`.
2. Test first: `src/__tests__/AppFooter.test.tsx`
   - a link named "Source Code" has the frets GitHub `href`, `target` and
     `rel`;
   - the text "Built at commit dev" is shown when the env var is unset;
   - with `vi.stubEnv('NEXT_PUBLIC_COMMIT_HASH', 'abcd123')` the text shows
     that hash.
3. Add `AppFooter.tsx` and render it in `AppShell.tsx`.
4. No deploy change: `DEPLOYMENT.md` already records that Cloudflare Pages
   clones the repo, so `git rev-parse` works there. After the PR's preview
   deploy, confirm the footer shows a real hash rather than `dev`.
5. `npm test`, `npm run lint`, `npm run build` (unsandboxed); confirm the
   real hash appears in `out/intervals.html`.
6. Browser check with Playwright on both `/intervals` and `/notes` at
   desktop and ~400px width: footer at the bottom, aligned with the cards,
   link hover and keyboard focus visible. Shut the dev server down after.
7. Add a line to the `Layout` section of `CLAUDE.md` for `AppFooter`.
8. Rebase on `origin/main`, re-verify, open the PR.

## Out of scope

- A footer on the settings dialog or any dark theme treatment.
