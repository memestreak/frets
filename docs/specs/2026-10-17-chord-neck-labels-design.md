# Dot labels on the Chords neck

The big neck on the Chords page gets the Scale lab's Dot labels control:
Interval, Note or None. Asked for by Jeremy on 2026-10-17 ("the same way
that the scale lab fretboard does"); the details below are the defaults
picked, since the ask left them open.

## Behaviour

- **Interval** labels each dot with its tone against the chord root (R, ♭3,
  5, ♭7), as before. **Note** labels it with the chord's spelled note (A, C,
  E, G; F♯ in F♯m7♭5). **None** leaves the dots unlabelled. The dots keep
  their degree colours and the root its square in every mode.
- With the Arpeggio on, every dot of the arpeggio is labelled as the
  shape's are, in whichever mode is chosen (Jeremy, 2026-10-19; until then
  only the frets played were labelled). Muted strings keep their × beside
  the nut whatever the labels.
- The choice is saved, as the Scale lab's is, but under its own key
  (`frets.chords.neck`, `{ labels }`): changing it on one page leaves the
  other alone. It defaults to Interval.
- It sits in the row under the neck, beside Arpeggio, so the neck's display
  controls are together; the Scale lab puts it above its neck because its
  card has a heading row there and nothing below. The neck keeps its size in
  every mode.
- The image export keeps its own Intervals (Show / Hide) option, which applies to
  the shape diagram it draws, not the neck.

## Code

- `src/components/DotLabels.tsx`: the `DotLabels` type, `isDotLabels` and
  `DotLabelsPicker`, used by both pages.
- `voicingDots` and `arpeggioDots` in `src/components/chords/chordDots.ts`
  take an optional `labels`, Interval by default.
- `src/features/chords/neckSettings.ts`: the key and its parser.
  `ChordsPage` keeps the choice beside the Arpeggio switch, so Back and
  Forward keep it.
