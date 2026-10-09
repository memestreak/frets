# Chords: published shapes first

Date: 2026-10-09
Status: approved in the project thread "Chord library shapes". Audit and
options: https://claude.ai/artifact/GxeaZWWULKswcQ4gzqSvPm (Jeremy picked
option D, Haus of Chords). Replaces the "Voicings" rules of
`2026-10-05-chord-library-design.md` for the types it covers.

## Problem

Jeremy, 2026-10-09: the library's shapes are made up, not the shapes
guitarists play. The audit agreed. The search found every legal grip and a
rough score picked among them, so the library led with odd grips
(C x-3-2-x-1-3), offered unplayable ones (F 1-0-3-2-1-1: a barre across a
ringing open string), and lost standard ones (every drop 3 grip, C9
x-3-2-3-3-3, C's D form).

## Source

[Haus of Chords](https://github.com/dersergioni/haus-of-chords) by
dersergioni: an open chord book whose data lists only shapes that at least
two independent teaching sources publish (JustinGuitar, Fender,
jazzguitar.be and others), each with its citations. 27 chord types, all 19
of the Common group among them. The data is CC BY 4.0: the app footer
credits it ("Chord shapes from Haus of Chords by dersergioni, CC BY 4.0",
both linked), and `src/lib/chords/data/README.md` says what the conversion
changed.

Other sources were checked and rejected: chords-db (MIT, has wrong
shapes), ChordPro (one shape per chord), several GPL sets, and generators
like ours.

## Import

`scripts/import-haus-of-chords.py` (standard-library Python, run with
`uv run --no-project`) reads a checkout of Haus of Chords and writes
`src/lib/chords/data/haus-of-chords.json`: per Frets chord type id, the
open shapes (each for its own root) and the moveable shapes written on C,
each with its count of independent sources. It keeps the shapes the book
counts as published (two independent sources, or the author's `keep`),
262 of them at commit 8345d0d. The JSON is committed; the app never reads
Haus of Chords at build or run time.

## Which shapes show

For a chord whose type has published shapes (`publishedShapes.ts`):

- **Open**: the published open shapes whose root is this chord's root, in
  the source's order. Most roots have none, and the group says so.
- **Moveable** (the best few): every published moveable shape slid to the
  root, as low on the neck as it goes (the F barre at fret 1, not 13),
  from the nut up. Of two shapes that differ only by one muted string, the
  one more sources publish stays, as in the Haus of Chords book
  (x-3-5-5-5-3 stays, x-3-5-5-5-x goes).
- **Show all**: every published moveable shape plus every searched one.

A chord type without published shapes (79 of the 106, and the lab's
unnamed chords) keeps the searched shapes, with these fixes:

- **Fingers**: a barre can lie on any fret, not only the lowest; an open
  string or a lower fretted note between two notes on a fret splits the
  barre; a muted string or a higher note doesn't. The index finger takes
  the lowest fret alone, so a shape whose lowest fret needs two fingers is
  unplayable.
- **Doublings**: a shape with a muted string in the middle is no longer
  dropped as a doubling of a fuller shape, so drop 3 grips stay.
- **Best few**: a searched shape harder than 6 on the easiness score stays
  out of the best few (still under Show all).
- **Open order**: easiest first, not most strings first.

The Scale lab's "In one position" card takes its core shapes from the same
lists, trying each moveable shape an octave up as well, so high positions
find the published shapes too.

## Tests

- Every imported type id exists and has the same tones as ours; every
  shape on every root has the root in the bass, only chord tones, every
  required tone, at least three strings (two for a power chord) and fits
  five frets.
- Open shapes only for their own root; the F barre at fret 1; the
  better-sourced of two mute variants; drop 3 for Cmaj7 published, and
  for C7♯11 searched.
- Fingers: barres on any fret, the barre split by the D string in C9, a
  barre across an open string rejected.
