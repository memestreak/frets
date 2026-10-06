# Breadcrumb navigation

Jeremy, 2026-10-06: option A from
https://claude.ai/artifact/Ri1o1uVNMnvJLqXiaehcRB.

1. `AppNav`: `nav[aria-label=Breadcrumb] > ol` of Frets, section, page from
   `locate`; last crumb `aria-current`, not a link; wordmark `sr-only`
   below `sm`.
2. `ThemeSwitch`: one icon button cycling Auto, Light, Dark; three icons in
   `icons.tsx` (Icon frame takes a size).
3. Tests: AppNav crumbs at Home, section page and page; ThemeSwitch cycle.
4. Spec, CLAUDE.md (AppShell line, sections line).
5. Lint, typecheck, tests, build; screenshots at 1280px and 390px in both
   themes; no horizontal scroll.
6. Close PR #26.
