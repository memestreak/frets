# Every tile's shapes, and Open in Chords

In the Scale lab's Diatonic chords card, every tile cycles its chord's
shapes, selected or not, and the shapes' menu opens a chord on the Chords
page. Before, the ‹ n of m › stepper and the "Bm7 in the Chord library →"
line showed only for the selected chord. Asked for by Jeremy on
2026-10-18; he picked mock D of four (a link under each tile, an icon
beside the stepper, the chord's name as the link, or the menu only),
wanting the link in the menu "instead of a permanent link below the
chord".

## Behaviour

- **Stepper on every tile.** A tile with two or more shapes in the
  position shows ‹ n of m › under it, always; one with a single shape
  shows "1 shape"; one with none, nothing. The space is as tall as the
  stepper either way.
- Stepping a tile that isn't selected changes that tile's shape only: it
  selects nothing, and the neck keeps showing the selected chord. Stepping
  the selected tile moves the neck's shape too, as before. ↑ ↓ still step
  the selected chord's shapes. Each tile keeps its pick while the scale,
  chord size and position stay, as before.
- The buttons are named for the chord: "Previous Bm7 shape", "Next Bm7
  shape".
- **The menu.** Right-click, a long press or Shift+F10 on a tile's shape
  opens the Chords page's shape menu: **Open in Chords**, Copy as PNG and
  Export options…. Open in Chords goes to the chord on the Chords page on
  the shape the tile shows (`/chords?chord=am7&shape=5-7-5-5-5-5`).
  Opening the menu selects nothing. A chord the Chords page has no type
  for gets no Open in Chords; a tile with no shape here gets no menu.
  With a mouse, a shape also drags out as a PNG, as on the Chords page.
- The menu is now named "Shape", not "Export shape", on both pages.
- **No library line.** The line under the tiles always reads "Tap a chord
  to see it on the neck. Right-click or long-press one to open it in
  Chords or copy it."
- Nothing moves when a chord is selected or a shape stepped (measured in
  the browser: every tile and the card keep their size).

## Code

- `src/features/chords/export/` moves to `src/components/chords/export/`,
  as a second section now uses it.
- `useShapeExport`'s `triggerProps(shape, { drag, items })`: `items` are
  the page's own menu items for that shape, above the export ones.
- `PositionShapes` draws the stepper on every tile and gives each shape
  the menu, with Open in Chords pushing `libraryHref`.
  `onShapeIndex(chordIndex, index)` picks a shape for any chord.

Supersedes the library line in
`2026-10-13-one-diatonic-chords-card-design.md` and the selected-only
stepper in `2026-10-07-scale-lab-position-shapes-design.md`.
