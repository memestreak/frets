# E minor mark

Jeremy, 2026-10-06: the Frets icon and favicon should show an E minor
chord, because eminor.net is his domain. Of four drawings he picked the
one laid out like the eminor.net logo.

## The mark

The open E minor chord (0 2 2 0 0 0) as an upright chord chart on the
rosewood tile: six vertical strings with low E on the left, the nut along
the top, three frets below it. Rings above the nut mark the four open
strings; the two fretted notes sit at the second fret on the A string
(the root, a square in `--degree-root`) and the D string (the fifth, a
circle in `--degree-fifth`). Roots are square, open or fretted, as in the
Chords section's diagrams.

This departs on purpose from the app's sideways diagrams (low E at the
bottom, nut on the left): the mark follows the eminor.net logo instead.

## Where it is drawn

- `BrandMark` (the nav), from the board and degree tokens, so it follows
  the theme.
- `src/app/icon.svg`, the same drawing with the light theme's values.
- `scripts/icons/mark-full-bleed.svg`, the mark shrunk onto a square
  tile.

`npm run icons` renders every raster icon from the two SVGs: the 192 and
512 manifest icons and `favicon.ico` (16, 32 and 48px) from `icon.svg`,
and the maskable icon and the 180px `apple-icon.png` from the full-bleed
one (iOS rounds the corners itself). Before this change `favicon.ico` and
the Apple icon came from a separate script and a vendored PNG of the old
black-and-white logo, and `favicon.ico` still showed it; both are gone.
