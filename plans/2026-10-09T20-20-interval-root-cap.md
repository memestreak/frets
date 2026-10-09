# Interval root at or below fret 10

Spec: `docs/specs/2026-10-09-interval-root-cap-design.md`.

- `intervals.ts`: add `ROOT_MAX_FRET` and `rootMaxFret`; `candidates`
  loops root frets up to `rootMaxFret(set)`.
- Tests: `rootMaxFret` cases; generated roots never above 10 while some
  targets are; a window starting at 12 roots every question on fret 12.
