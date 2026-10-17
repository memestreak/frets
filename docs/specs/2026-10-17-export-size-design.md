# Export size and transparency

The Export options dialog on the Chords page gains two choices: how big the
image comes out, and whether it is transparent. Before, every PNG was drawn
at 4× the diagram, about 600 pixels wide, which was too big for most uses.
Settled with Jeremy on 2026-10-17 (option 1 of three sketches, with the
defaults proposed).

## What it looks like

- Two rows after Background, in the same grid and with the same segmented
  controls:
  - **Size (px wide)**: 150, 225, 300, 450, 600. On a phone the row reads
    just "Size", and the controls' options are a little narrower, so every
    row stays on one line.
  - **Transparent**: On, Off.
- A line under the preview says what comes out for the shape shown:
  `300 × 312 px, transparent`, or `… px, on white` / `… px, on dark grey`.

## Behaviour

- Size is the width of a diagram of the usual five frets. A shape that
  reaches further (one tapped on the neck) is drawn at the same scale, so
  it comes out wider: eight frets at 300 come out 446 px wide. The height
  follows, with or without the name.
- Transparent Off fills the image with what the preview shows: white
  (`#ffffff`) for Light, dark grey (`#1b1b1b`) for Dark. The two colours
  live in `BACKDROPS` (`exportStyle.ts`) and in `globals.css`; a test keeps
  them in step.
- Copy as PNG, Copy SVG, both downloads, the menu's Copy as PNG and
  dragging a shape out all use both choices.
- The SVG keeps its `viewBox` in diagram units and gets the chosen width
  and height, so it pastes at that size; Off adds a filled rectangle behind
  the diagram.
- The PNG is the SVG drawn at its own width and height (no fixed scale).
- Defaults: 300 px, transparent. Both are saved with the other choices in
  `localStorage["frets.chords.export"]`; an unknown size falls back to 300.
