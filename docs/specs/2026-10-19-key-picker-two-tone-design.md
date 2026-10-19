# Two-tone key picker

The key picker (`docs/specs/2026-10-16-key-picker-design.md`) on the Scale
lab, Triads and the Chords page looked plain: seventeen tiles all in one
colour. Its sharps and flats now sit a shade darker than the naturals, like
a piano's black keys, so the row reads as a keyboard at a glance.

## What it looks like

- Naturals stay `--surface-raised`; the half-height sharp and flat tiles are
  `--surface-sunken`, both with the `--line` border.
- Hover darkens a tile one step: a natural to `--surface-sunken`, a sharp or
  flat to `--line`.
- The picked tile is unchanged: `--primary` on `--on-primary`, whichever
  kind of key it is.
- Flat, like the rest of the app: no gradients and no shadows. Only colours
  change, so every tile keeps its size and nothing moves on hover or pick
  (the row is 336×52 in every state, in both themes).
- The focus outline is unchanged.

Four flat versions were mocked (this two-tone row, fret-marker inlay dots on
the naturals, the keys in a rosewood bed with a brass pick, and a brass bar
under the picked key), after a first round with gradients and soft shadows
was turned down as not flat enough. Jeremy picked the two-tone row on
2026-10-19.

## Code

Only `.key-tile-half` and its hover rule in `globals.css` change;
`KeyPicker.tsx` is untouched, so all three pages follow.
