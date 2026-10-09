# Interval trainer: the root stays at or below fret 10

An interval question's root (the starting note) never sits above fret 10,
in Name it and Find it alike. The target may still land above fret 10, up
to the fret window's highest fret, so the box around the root
(`2026-10-01-interval-ranges-design.md`) is unchanged.

- `ROOT_MAX_FRET = 10` in `features/practice/intervals/intervals.ts`.
- `rootMaxFret(set)` is the highest root fret for the fret window: 10, or
  the window's highest fret when that is lower, or the window's lowest fret
  when the window starts above 10 (Lowest fret goes up to 23), so a window
  like 12–17 still has questions, all rooted on fret 12.
- The generator only lists roots from the window's lowest fret to
  `rootMaxFret`. Judging, the hint and the board are unchanged.
- Not a setting; nothing in storage changes. The Note trainer has no root
  and is unaffected.
