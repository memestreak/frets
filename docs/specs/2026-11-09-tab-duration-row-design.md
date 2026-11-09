# Tab: the note values on a row of their own, shortest to longest

Jeremy, 2026-11-09: "The note duration buttons in the palette should be on
their own line and should be ordered shortest to longest."

## What it does

- **The palette's Duration group has two rows.** The first holds only the
  seven note values, sixty-fourth to whole, left to right; their keys 1 to 7
  now run the same way. The second holds the Grid button (still the group's
  first tool after the note values; `2026-11-01-tab-note-input-grid-design.md`),
  then the dot and the rest.
- **The note values never wrap.** At the Rail's narrowest panel (224px,
  `2026-11-08-tab-rail-width-design.md`) seven 30px buttons don't fit, so in
  that row the buttons narrow (to 26px there) instead of breaking the row.
  From about 252px up they are 30px, as every other tool.
- Nothing else changes: the buttons' keys, tips, what they light and what a
  press does are as before. The `?` overlay lists the note values under Note
  input mode by key, so it doesn't change.

## How

- `tools.ts`: the Duration group's tools run sixty-fourth to whole, then dot
  and rest.
- `TabPalette.tsx`: a group with note values draws them in their own row
  (`.tab-palette-values`), with the Grid button and the group's other tools in
  a row under it.
- `tab.css`: `.tab-palette-values` is a one-row grid whose columns are at most
  30px and may shrink.

## Tests

- The Duration group's first row is exactly Sixty-fourth, Thirty-second,
  Sixteenth, Eighth, Quarter, Half and Whole note, in that order.
- Its second row is the Grid button, Dotted, and Rest, and no note value.
