# Triads

A new Explore page, `/explore/triads`, that teaches the guitarist's triad
skill: play any triad on any three neighbouring strings, in all three
inversions, and move between them up the neck. Asked for by Jeremy on
2026-10-18, who settled each choice below in the "Teaching triads on
guitar" thread from mocks; details he left open are marked as defaults.

## What the page shows

- **Pickers, each labelled (Jeremy):**
  - **Root**, under the title "Triads": `KeyPicker`, the standard key
    picker (Jeremy). Roots are spelled one way per pitch, as on the
    Chords page (D♭, E♭, F♯, A♭, B♭; default).
  - **Triad** and **Strings**, two columns of buttons just right of the
    title block, top-aligned (Jeremy): Major / Minor / Dim / Aug, and
    e B G / B G D / G D A / D A E, high strings first and named high to
    low, in the caption too (Jeremy).
  - On a phone the columns wrap under the title block.
- **One string set across the whole neck** (frets 0–15, as in the Scale
  lab); the three other strings fade.
- **Every grip** of the triad on that set: each inversion, wherever it fits
  on the neck, the open-string grips included. A grip is the three tones
  in close position, one per string, the bass on the lowest string, within
  the four-fret stretch the chord shapes use (`MAX_SPAN`).
- **Each grip is joined by a wide, faint band** behind its dots (Jeremy
  preferred this to a thin blue line), and named above the neck: Root, 1st,
  2nd.
- **Dots** are coloured by degree, the root square, as on the Chords
  page, and labelled by the Interval / Note / None switch.
- **Under the neck, as on the Chords page (Jeremy):** the caption on the
  left; the Interval / Note / None switch and an **Arpeggio** button on
  the right. The Arpeggio (or space) shows every tone of the triad from
  the nut to fret 15 on all six strings; with a grip picked, only its
  dots keep their labels. Not saved.
- **The caption:** "C major on the e-B-G strings. Tap a grip
  to name it." Augmented's grips repeat every four frets, which the neck
  shows without comment.

## Picking a grip

- Tapping a dot of a grip picks it: the other grips, their bands and their
  names fade, and the caption names it: "1st inversion, C/E · 3rd in the
  bass" ("Root position, C · root in the bass" for root position).
- Tapping the picked grip, a fret with no grip, or Esc clears the pick.
  Where two grips share a dot, a tap picks the one not yet picked
  (default).
- A new root, triad or string set clears the pick. The neck scrolls to a
  picked grip on narrow screens.

## Saved

`localStorage["frets.explore.triads"]` holds the root, triad, string set
and dot labels; the pick is not saved.

## Code

- `src/features/explore/triads/triads.ts` (pure): the triad types, string
  sets, `triadGrips(chord, lowString)` and the caption text.
- `settings.ts` beside it: the saved settings and their parser.
- `Triads.tsx`: the page, loaded client-only from `ExploreLoaders`.
- `Fretboard` gains `links`: bands behind the dots, each with an optional
  name drawn above the board (the board grows to make room) and an
  opacity. Their colour is `BOARD.link`, the string colour.
- The Chords page's one-spelling-per-pitch root map moves to
  `chordRootOf` in `src/lib/chords/chordTypes.ts`, now that two sections
  use it.
- `sections.ts` and `PageIcon.tsx` gain the page, after the Scale lab.
