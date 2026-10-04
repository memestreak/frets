# Scale lab: first slice

Date: 2026-10-04
Status: approved in the project thread, implemented with this spec.

## Problem

Fretwood's Scale Lab prototype
(https://claude.ai/artifact/YCo1CiAnXBksmyC9HV4R8v) and its UI options
canvas (https://claude.ai/artifact/49bYSBxWTgBuCqUa4pFGv5) describe a page
for exploring scales and their diatonic chords. Frets has only the Practice
quizzes, and its music model (`src/lib/music.ts`) knows pitch classes but
not spelled notes or intervals.

## Goal

A first slice of the Scale lab: pick a root and a scale, see its notes,
formula and steps, see it on the neck, and see its diatonic chords, with
any chord drawn over the scale. As with `design_handoff/`, the prototype is
the reference for behaviour; the look is Fretwood as the app applies it
(`2026-10-04-fretwood-design-system.md`).

## Where it lives

- A new section, **Explore** (`/explore`), with one page, **Scale lab**
  (`/explore/scales`): one entry in `src/components/sections.ts` plus routes.
- Code in `src/features/explore/scales/`. It renders client-only, like the
  trainers, because its initial state reads localStorage.

## Page

One column, as in the prototype:

1. **Title and facts.** The `h1` is the scale ("A Dorian", "A natural
   minor"), or "D7 in A Dorian" with a chord selected. Below it: Notes,
   Formula and Steps (Steps only without a chord; with one, Notes and
   Formula are the chord's), in JetBrains Mono.
2. **Root and scale.** A native `<select>` with one `<optgroup>` per family
   (list below), and the chromatic root row with split black keys (canvas
   "Root picker" option A): 17 spellings, the naturals plus a ♯ and a ♭ for
   each black key. Under them, the formula as 12 semitone chips, coloured
   by degree; the semitones the scale skips are outlined. The chips are
   read-only in this slice and hidden from assistive tech (the facts carry
   the formula as text).
3. **On the neck.** Frets 0–15 on the shared `Fretboard`, display-only.
   Dot labels Interval / Note / None. The root is a square ("R"); every dot
   takes its degree colour. On phones the board scrolls sideways, as in the
   trainers.
4. **Chords in this scale.** A seven-card strip (canvas "Diatonic chords"
   option B) with Triads / Sevenths and ♭III style / III style. A card shows
   the numeral, the symbol and the quality. Tapping a card selects it and
   tapping it again clears it. While a chord is selected the neck shows
   only its tones, labelled and coloured by their interval to the chord root
   (R 3 5 ♭7); the scale's other notes are hidden. (The prototype keeps them
   as small grey dots; on review they read as clutter.) Changing the root
   or scale clears the chord;
   changing size or numerals keeps it. A selected chord is also drawn
   against the scale as a ladder or a clock
   (`2026-10-04-chord-diagrams-design.md`).

Defaults on first visit: A Dorian, Sevenths, ♭III style, Interval labels.

### Scales

| Family | Scales |
| --- | --- |
| Major modes | Ionian (major), Dorian, Phrygian, Lydian, Mixolydian, Aeolian (natural minor), Locrian |
| Melodic minor modes | Melodic minor, Dorian ♭2, Lydian augmented, Lydian dominant, Mixolydian ♭6, Locrian ♮2, Altered |
| Harmonic minor modes | Harmonic minor, Locrian ♮6, Ionian ♯5, Dorian ♯4, Phrygian dominant, Lydian ♯9, Ultralocrian |
| Pentatonic and blues | Major pentatonic, Minor pentatonic, Minor blues |

## Rules

- **Spelling.** Notes come from tonal's `Note.transpose`, so seven-note
  scales spell one letter per degree, with ♭ ♯ 𝄪 𝄫 glyphs (G♯ major has
  F𝄪). Interval labels are degrees against the major scale: ♭3, ♯4, 𝄫7.
- **Altered** is spelled 1 ♭2 ♭3 ♭4 ♭5 ♭6 ♭7. tonal spells it
  1 ♭2 ♯2 3 ♯4 ♭6 ♭7, with two 2s and no 5, which would misname its
  stacked chords.
- **Diatonic chords** exist only for seven-note scales: each degree stacks
  every other scale note (three for triads, four for sevenths). In smaller
  scales alternate notes are not thirds, so the panel says why there are
  none. (The prototype stacks any scale of five or more notes.)
- **Chord symbols** come from our own table keyed by the third, fifth and
  seventh, not tonal's chord detection: C, Cm, C°, C+; Cmaj7, C7, Cm7,
  Cm(maj7), Cm7♭5, C°7, C+maj7, C+7. Every chord of every listed scale on
  every root is in the table (a test checks this). A stack outside it would
  show its notes.
- **Numerals.** ♭III style numbers a chord by its root's degree against the
  major scale (♭III, ♯iv°); III style by its position in the scale. The case
  follows the third (lower case when it is minor or diminished); the suffix
  follows the table: °, +, maj7, 7, ø7, °7, (maj7), +maj7, +7.
- **Degree colours** (canvas "Scale-view colours" option A): degree 1 root,
  2 second, 3 third, 4 extension, 5 fifth, 6 sixth, 7 seventh.

## Theory code

- **tonal 6.4.3**, pinned exactly. 6.5.0 (2026-09-28) points its `main`
  field at a file the package doesn't ship, so Node and Vitest can't import
  it.
- `theory.ts` is the only file that imports tonal. It is pure: the root and
  scale tables, `scaleOf`, `diatonicChords` and `neckNotes` (standard tuning
  from `src/lib/music.ts`). `src/lib/music.ts` stays pitch-class only.

## Shared code

- `Fretboard`'s `label` names a display-only board for screen readers
  ("A Dorian on the fretboard").
- JetBrains Mono 500 (latin, SIL OFL) is self-hosted like the other faces,
  as `--font-mono`.

## Saved state

`localStorage["frets.explore.scales"]` holds
`{ root, scale, chordSize, numerals, labels }`, parsed field by field like
the trainers' settings. The selected chord is not saved.

## Later slices

1. Editable formula: tap chips to add or remove degrees, ⇄ respelling and
   scale detection ("Also called", custom scales).
2. Position view: a draggable window and ‹ › stepper, and the phone fret
   window (canvas "Mobile" A and D).
3. Playback: the plucked-string synth, Up / Down / Strum, tempo and loop.
4. Tunings and left-handed (makes `TUNING` a parameter app-wide).
5. Searchable scale library, chord shapes, ninths.
