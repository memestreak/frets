# Interval trainer: fixed-size board

Spec: `docs/specs/2026-10-09-interval-fixed-board-design.md`.

- `Fretboard.tsx`: `inPlay` prop. Shade the spans left and right of it
  (clip path on the fill), fade those fret numbers, draw tap cells and clamp
  arrow-key focus only inside it.
- `fretboardGeometry.ts`: fret numbers carry their fret, `f`.
- `theme.ts`: `BOARD.shade`.
- `fretWindow.ts`: `MAX_FRET` 15.
- `IntervalTrainer.tsx`: board 0 to `MAX_FRET` with `inPlay` from the
  settings; fret inputs bounded by `MAX_FRET` and `MIN_WINDOW_SPAN`.
- Tests: Fretboard shading and cells; trainer viewBox unchanged with a
  narrow range; fret window clamps at 15.
