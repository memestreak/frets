# Installable app

Jeremy, 2026-10-06: make Frets installable now; offline later.

1. `scripts/make-icons.mjs` (sharp, a dev dependency) and
   `scripts/icons/mark-full-bleed.svg`; render `public/icons/*.png`.
2. `src/app/manifest.ts` with the three icons, `force-static`.
3. `SURFACE_COLORS` in `src/lib/theme.ts`; layout gets `themeColor`
   (light/dark) and `appleWebApp.title`.
4. Tests: manifest icons exist, a maskable icon is listed,
   `SURFACE_COLORS` matches `fretwood.css`.
5. Build; check `out/` has the manifest, icons and head tags, and that
   Chromium reports no installability errors.
6. Spec, CLAUDE.md.
