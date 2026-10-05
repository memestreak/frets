# Chord shapes: three per line on phones

Jeremy, 2026-10-05: on phones the Open and Moveable diagrams go three per
line instead of five with sideways scrolling.

1. `globals.css`: `.shape-grid` at `max-width: 700px` (the app's phone
   breakpoint) uses `repeat(3, minmax(0, 1fr))`.
2. Update the library spec and the `VoicingGroups` comment.
3. Screenshot both Chords pages at 390px; check no sideways scroll.
