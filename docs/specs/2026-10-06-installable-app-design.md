# Installable app (home screen)

Date: 2026-10-06
Status: approved in the project thread about installing Frets. Jeremy
picked "install now, offline later": this slice makes the app installable;
offline use (a service worker) is a later slice.

## Problem

Frets can only be used as a browser tab. On an iPhone, "Add to Home
Screen" gives the right icon but opens a Safari tab; Android Chrome
offers no install at all, because there is no web app manifest.

## Goal

People can install Frets and launch it like an app: its own icon and
name, full screen, no address bar.

- **Android (Chrome):** "Install app" in the menu (and Chrome's own
  install prompt when it chooses to show one). The app opens in its own
  window and appears in the app drawer.
- **iPhone (Safari):** Share → "Add to Home Screen". It opens full screen
  with a normal status bar.
- **Desktop Chrome/Edge:** the install icon in the address bar.

Frets shows no install button or banner of its own.

## What ships

- `src/app/manifest.ts`, emitted as `/manifest.webmanifest`: name and
  short name "Frets", `start_url` and `scope` `/`, `display: standalone`,
  background and theme colour the light `--surface`, and three icons.
  `dynamic = "force-static"` because the static export needs it.
- Icons in `public/icons/`: `icon-192.png` and `icon-512.png` (the
  rounded mark, `purpose: any`) and `maskable-512.png` (the mark on a
  square background, shrunk to fit Android's maskable safe circle,
  `purpose: maskable`). `npm run icons` (`scripts/make-icons.mjs`, sharp)
  renders them, `src/app/apple-icon.png` and `src/app/favicon.ico` from
  `src/app/icon.svg` and `scripts/icons/mark-full-bleed.svg`; the output
  is committed. The mark itself is in
  `docs/specs/2026-10-06-e-minor-mark-design.md`.
- Layout metadata: `appleWebApp.title` "Frets" (the label under the iOS
  icon; Next also emits `mobile-web-app-capable`), and `theme-color`
  metas for light and dark (the status bar colour in the installed app).
- `SURFACE_COLORS` in `src/lib/theme.ts` holds `--surface` for both
  themes, for these two places that can't read CSS tokens; a test checks
  it matches `fretwood.css`.

## Limits

- No service worker, so the installed app needs a connection, like the
  site. It always shows the latest deploy.
- `theme-color` follows the system theme, not the in-app Light/Dark
  choice: a meta tag can't see it. With the system light and the app set
  to Dark, the Android status bar stays cream.
- An installed app has no browser back button. Every page is reachable
  from the nav, so nothing is stranded.
