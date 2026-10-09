# Chord lab: no Build it, an Arpeggio toggle

Date: 2026-10-09
Jeremy, 2026-10-09 (Chords project thread): remove the
Chord lab's "Build it" widget, and add an arpeggio view with a button that
space toggles, consistent with the Chord library
(`docs/specs/2026-10-06-chord-arpeggio-design.md`).

## Build it goes

The twelve tone chips, their "A chord needs two or more tones." and "No
shape plays …" notices, and their code (`ToneChips.tsx`, `.tone-chip`,
`plainToneLabel`) are removed. The Open and Moveable shape groups stay in
the left column, now under the library's colour key (`ToneKey`), which the
lab left out only because the chips named the colours. With the neck
empty, that column reads "Tap a note to see its shapes."

## Arpeggio

- The chord it shows is the one the page is showing: the name picked in
  Name it (the best one at first), or, with no name, the notes read upward
  from the lowest one, as the title and dots already do. Every tone of
  that chord's spelling, nut to fret 15, at full strength, with the
  shape's look (degree colour, interval label, square root).
- An **Arpeggio** `ToggleButton` sits under the neck, on the right, on the
  same line as the tapping hint (which moves from above the board), as the
  library's sits on the stepper line. With the arpeggio on, the hint reads
  "Arpeggio · every C, E and G up to fret 15", as the library's caption
  does.
- The button, or **space**, toggles it. Turning it off brings back the
  shape that was on the neck: the frets are kept while the arpeggio is on.
  Space behaves as in the library (`useSpaceKey`): anywhere on the page
  but a field, the nav or the footer, without clicking a focused button or
  scrolling, once per press, and it takes focus off the button it
  overrides so no focus ring appears.
- Picking another name keeps the arpeggio on and relabels it against the
  new root (C6 → Am7/C).
- Playing a note on the neck, choosing a shape (tap, ← →) or Clear turns
  it off and shows the new shape: those change the frets, and the neck
  should show what was just played. With the arpeggio on no shape diagram
  is selected, so → chooses the first, as in the library.
- With nothing on the neck the button is disabled and space does nothing.
- Not saved; the lab keeps no state.

## Parts

- `useSpaceKey` moves from `library/` to `src/features/chords/`, now that
  both pages use it.
- `arpeggioCaption(chord, maxFret)` (`src/features/chords/arpeggioCaption.ts`)
  writes the caption for both pages.
- `VoicingGroups` loses its `showKey` prop: both pages show the key.
