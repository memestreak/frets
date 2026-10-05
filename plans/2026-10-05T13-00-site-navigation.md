# Site navigation

Spec: `docs/specs/2026-10-05-site-navigation-design.md`.

1. `src/components/sections.ts`: drop `Section.href`; `locate` matches a
   page href exactly and returns its section.
2. Delete `src/app/practice/page.tsx` and `src/app/explore/page.tsx`; the
   home page's section headings become plain text.
3. `src/components/icons.tsx`: optional `size` on the icon frame; add
   `MenuIcon`, `SunIcon`, `MoonIcon`, `ThemeAutoIcon`.
4. `src/components/ThemeSwitch.tsx`: one icon button cycling auto, light,
   dark.
5. `src/components/AppNav.tsx`: brand, location, theme button, Menu button
   and the panel. Open state is the pathname it was opened on, so a page
   change closes it without an effect. Esc, outside pointer-down and the
   Menu button close it; keydown inside the nav stops propagating while
   open.
6. Tests: rewrite `AppNav.test.tsx`, `ThemeSwitch.test.tsx`,
   `sections.test.ts`.
7. Update `CLAUDE.md` (routes, `AppNav` description).
8. Screenshots at 1280px and 390px in both themes, menu open and closed.
9. `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`.
