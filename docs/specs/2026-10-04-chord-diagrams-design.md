# Scale lab: chord diagrams

Date: 2026-10-04
Status: approved in the project thread (mockup:
https://claude.ai/artifact/8xhPLMYNRcPNZqTAoWVJtd, option B), implemented
with this spec.

## Problem

Selecting a chord in "Chords in this scale" shows its tones on the neck,
but nothing shows how the chord is built from the scale: which scale notes
it takes and how far apart they are.

## Goal

The chords section draws the scale as a **ladder** or a **clock**. With no
chord selected every scale note takes its degree colour (as on the neck),
labelled R 2 ♭3 …; a selected chord is drawn against the scale, naming its
intervals either **from the root** or **between tones**. Two switches under
the chord cards pick each (the second only while a chord is selected); both
are saved. Defaults: Ladder, From the root.

While a chord is selected, ← and → select the previous or next chord,
wrapping round at the ends, unless focus is in a field that uses the arrows
(the scale list). Focus and the card strip's scroll follow the selection.

## Ladder

- Two octaves from the scale root, one cell per semitone (24 cells, enough
  for every diatonic stack). After a rotation it starts on the root picked
  from the dropdowns instead, so each chord keeps its cells and only the
  colours and degrees follow the new root. Scale notes are tiles with the note name, and
  their degree in the scale under them. Semitones outside the scale are
  empty squares, so a bracket's width is its interval.
- The chord's tones are filled in role colours (root, third, fifth,
  seventh; the root's tile is squarer), with their label against the chord
  root (R 3 5 ♭7) under the degree. The other tiles are muted.
- A dashed line marks the octave.
- **From the root:** a square bracket from the chord root to each tone,
  stacked so the farther the tone, the higher its bracket, each in its
  tone's colour and labelled M3, P5, m7.
- **Between tones:** a bracket per stacked third on one level, in
  `--primary`, inset so neighbours don't join, labelled M3 or m3.
- On a phone the ladder scrolls sideways and opens scrolled to the chord's
  root.

## Clock

- The twelve semitones round a circle, scale root at the top (after Rotate
  mode, the root picked from the dropdowns). Scale notes
  are dots, semitones outside the scale empty squares.
- The chord's tones are coloured dots (root square) with their role label,
  and only they are named. Nothing is drawn across the circle.
- **From the root:** concentric bracketed arcs outside the circle, from the
  root clockwise to each tone, in the tone's colour. The note names move
  inside the circle to leave room.
- **Between tones:** one arc per third outside the circle, in `--primary`,
  with the note names outside the arcs.

## Labels

- Intervals are named quality first (M3, m3, P5, d5, A5, M7, m7, d7), not
  as degrees (♭7), because the degrees are already under the tiles.
- The interval labels are bold Figtree at 12px: in the mono face at 11px,
  M and m were hard to tell apart, and 13px read as too big.
- Each diagram is an `img` whose name spells the intervals out: "D7 from
  its root D: major 3rd up to F♯, perfect 5th up to A, minor 7th up to C".

## Code

- `theory.ts`: a chord also carries `rising` (each tone's semitones above
  the scale root as the stack climbs past the octave), `fromRoot` and
  `thirds` (interval names), and `intervalWords` spells a name out.
- `chordDiagram.tsx` holds what both diagrams share: tone colours and
  labels, the intervals to annotate, the screen-reader description and the
  interval tag. `ChordLadder.tsx` and `ChordClock.tsx` draw the diagrams;
  `ChordStrip.tsx` places them and the switches.
- `frets.explore.scales` gains `chordView` (`ladder` | `clock`) and
  `chordIntervals` (`root` | `between`).
