# Chords: the Chord lab

Date: 2026-10-05
Status: approved in the project thread "Chords" (the lab mock in
https://claude.ai/artifact/RwDFXnXusztR7FnoRveULR). The second page of the
Chords section, after the Chord library
(`docs/specs/2026-10-05-chord-library-design.md`), whose parts it reuses.

## Problem

The library answers "how do I play this chord?". Guitarists also ask the
opposite: "what is this shape I'm playing?", and "what happens if I add a
9th to it?".

## Goal

`/chords/lab` does both on one page:

- **Name it**: tap notes on the neck, see every name for them.
- **Build it**: toggle tones above the root, and the lab puts a shape for
  the new chord on the neck.

Progressions and voice leading come later.

## Page

1. **Title line.** `h1` is the chosen name and its formula ("C (1 3 5)"),
   with the spelled notes below, as in the library. A **Clear** button sits
   on the right. With no name, the title reads "No name" and the formula
   counts from the lowest note.
2. **The neck**, frets 0–15, tappable. One note per string: tapping a fret
   plays it on that string, tapping the same fret again mutes the string.
   Fret 0 is the open string. Dots are labelled against the chosen name's
   root and take degree colours (the root square), as in the library.
   Muted strings are drawn faint. It opens on an open C (x-3-2-0-1-0).
3. Two columns (one on phones):
   - **Name it** (right): every name for the notes, best first, each a
     button with a line saying why ("root in the bass", "♭3 in the bass",
     "no 5"). Picking one relabels the dots, chips and title against its
     root. With fewer than two different notes it says "Tap two or more
     notes to name them."; when nothing fits, "No chord name fits these
     notes."
   - **Build it** (left): twelve tone chips, R to 7, the root fixed on.
     Toggling a chip changes the set of tones; the lab finds shapes for
     the new chord (the library's search) and puts the first one on the
     neck. If no shape plays that set, the neck stays and a line says so.
     Under the chips, the library's **Open** and **Moveable** groups for
     the chosen chord; tapping one puts it on the neck.

## Naming

For each note played as a candidate root, the tones above it (as
semitones) are compared with every chord type tonal knows:

- **Exact**: the same tones. Some sets have two names (`11` and `9sus4`);
  both are listed.
- **Missing optional tones**: when no type matches a root exactly, a type
  whose required tones are all there and whose extra tones are only the
  optional ones (the library's rule: the 5th, and the 9th or 11th under a
  higher extension) names it with what's missing: "C7 (no 5)". Only the
  types missing the fewest tones are kept.
- A root that isn't the lowest note gives a slash chord: "C/E".

Order: exact names before ones missing a tone; then common types before
the rest (so E G C reads C/E before Em♯5); then root in the bass; then the
chord type's place in the Type list. Some types already leave a tone out
(tonal's `7no5`, `9no5`, `13no5`); those are exact matches.

Two notes a fifth apart are a power chord ("C5", tonal's `5` type); other
two-note sets have no name.

Notes that no type fits get no name; the chips and dots are then labelled
against the lowest note with plain interval names (♭2, ♭5, ♭6 for the
black-key tones).

## Code

- `chordTypes.ts` gains `ChordTypeDef.semis` (sorted semitones, used for
  matching) and `chordFromTones(rootPc, semis)`: the type with exactly
  those tones, or an unnamed chord labelled with plain interval names.
- `naming.ts` (new, no tonal): `nameNotes(pcs, bassPc)` returns
  `ChordName[]` (`symbol`, `why`, `chord`). No React.
- Shared with the library, moved up to `src/features/chords/`:
  `ChordHeader.tsx` (the title line, with a slot on the right).
- `lab/`: `ChordLab.tsx` (the page, the only stateful component: frets,
  chosen name, Show all, a notice), `NameList.tsx`, `ToneChips.tsx`.
- Route `src/app/chords/lab/` (prerendered: the lab reads no storage or URL);
  `sections.ts` lists it.

## Saved state

None, and no URL: the lab opens on an open C each time, and a shape
isn't linkable (Jeremy, 2026-10-05).

## Tests

- naming: C E G (and its inversions), Am7 = C6, C E B as Cmaj7 (no 5), the
  two names for `11`/`9sus4`, C G as C5, a cluster with no name.
- chordFromTones: a known type, an unnamed set.
- ChordLab: opens on C; tapping a fret names the new chord; tapping again
  mutes; picking a name relabels; toggling a chip puts a shape for the new
  chord on the neck; Clear.
