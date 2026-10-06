# Chords: the Chord library

Date: 2026-10-05
Status: approved in the project thread "Chords". Proposal:
https://claude.ai/artifact/BGzuhxPvDxfa4txgSyjmM1, working mocks:
https://claude.ai/artifact/RwDFXnXusztR7FnoRveULR. Implemented with this
spec. The Chord lab (name tapped notes, build a chord from tone chips) is
the next slice, with its own spec.

## Problem

Frets shows chords only inside a scale (the Scale lab's diatonic chords).
There is no way to look up a chord on its own and see how to play it.

## Goal

A new **Chords** section (`/chords`) whose first page, **Chord library**
(`/chords/library`), answers "how do I play this chord?": pick a root and
a chord type, see the chord's notes and formula, and every good way to
play it, as small diagrams and on the full neck.

## Page

One column, like the Scale lab:

1. **Title line.** `h1` is the chord symbol, then its formula in
   parentheses ("Am7 (1 ♭3 5 ♭7)"); Root and Type dropdowns sit on the
   right of the same line. The spelled notes ("A C E G") are on the line
   below.
2. **On the neck.** The full neck, frets 0–15, showing only the chosen
   voicing (no other chord tones). Dots are labelled by interval and take
   their degree colours; the root is a square. Under it, ‹ › step through
   the voicings, with a caption such as "Moveable 2 of 9 · root on E ·
   frets 5–7". The open groups come first, then the moveable ones.
3. **Open** and **Moveable**: two groups of small diagrams, five per line,
   wrapping onto as many lines as needed. Tapping one puts it on the neck;
   ← and → select the previous or next shape, in the order shown. The
   selected shape sits on the sunken surface with a ring; hovering changes
   nothing.
   The diagrams carry no fret-number text (no `x-0-2-0-1-0`). An empty
   group says so ("No open shape for this chord.") rather than
   disappearing.
4. Under Moveable, when more shapes exist than the best few shown, a
   **Show all N shapes** link lists them all; it then reads **Show the best
   few**.

On phones (700px wide or less) the neck scrolls sideways, as elsewhere,
and the diagrams go three per line, wrapping, so they stay readable
without scrolling (Jeremy's pick, 2026-10-05).

## Diagrams

Small horizontal chord charts: low E at the bottom, five frets, the nut
drawn when the shape starts at fret 1 and the starting fret number under
the first column otherwise, × left of a muted string, a ring left of the
nut for an open string. Dots take the degree colour of their tone (9 takes
the 2's colour, 11 the 4's, 13 the 6's) and carry no text; the root is a
square. A key above the groups names the colours. See
`2026-10-06-simpler-chord-diagrams-design.md`.

## Chord types

All of tonal's chord types (106 in 6.4.3), so the library covers anything
tonal can name. The Type dropdown groups them:

- **Common**: major, m, 7, maj7, m7, m7♭5, dim, dim7, aug, sus2, sus4, 6,
  m6, 9, m9, maj9, add9, 7sus4, 13.
- Every other type goes in the first group that fits: **Triads** (three
  notes or fewer), **Altered** (has a ♭9, ♯9, ♯11 or ♭13), **Extended**
  (has a 9, 11 or 13), **Sixths and sevenths** (the rest).

Symbols are tonal's first alias with real ♭ and ♯, except the major triad
(no symbol: "C") and the minor-major seventh ("m(maj7)"). The dropdown
shows the symbol and, where tonal has one, the name: "m7 · minor seventh".
Notes are spelled by tonal (`Chord.getChord`).

Roots: twelve, one spelling each: C D♭ D E♭ E F F♯ G A♭ A B♭ B.

## Voicings

Generated, not hand-entered. A voicing is one fret or a mute per string.

**Playable** means all of:

- the root is the lowest note;
- every note is a chord tone, and every required tone is there;
- at least three strings sound, with at most one muted string between
  the lowest and highest;
- the fretted notes span at most four frets (five fret positions), so
  stretches such as x-x-7-5-x-3 are allowed (Jeremy, 2026-10-06);
- at most four fingers: one per fretted note, except that the notes on the
  lowest fret count as one (a barre).

**Required tones**: all of the chord's tones, except that the 5th may be
left out of chords with four or more notes, and in chords with an 11th or
13th the tones below it may be left out (the 9th; and the 11th in a 13th
chord). The root is always there, in the bass.

**Open** shapes ring at least one open string, stay within the first four
frets, and have no muted string in the middle. **Moveable** shapes have no
open strings. Shapes that mix open strings with high frets are left out.

**The best few** (shown by default): among moveable shapes, the easiest one
for each bass note (string and fret) and each number of strings. Among
open shapes, those that don't merely double a note of a fuller open shape.
**Show all** lists every playable moveable shape except those that only
double a note of a fuller one.

**Easiest** is the lowest score: fingers + span in frets + 3 × muted
strings in the middle − half the number of strings sounding. Open shapes
are listed with the most strings first; moveable shapes from the nut up.

All of these numbers are named constants in `voicings.ts`.

## Code

- `src/features/chords/`:
  - `chordTypes.ts`: the only file here that imports tonal. Chord types,
    groups, symbols, roots, `chordOf(root, typeId)` (spelled notes,
    formula, each tone's label and semitones, and which tones are
    required).
  - `voicings.ts`: pure voicing search (`findVoicings`), the easiness
    score, and captions.
  - `ChordDiagram.tsx` (one small diagram), `VoicingGroups.tsx` (Open and
    Moveable, five per line or three on phones, Show all) and `chordDots.ts` (voicing → neck
    dots): shared with the Chord lab to come.
  - `library/`: `ChordLibrary.tsx` (the page, the only stateful component),
    `ChordPickers.tsx`, `VoicingStepper.tsx`, `chordUrls.ts` (slugs).
  - `ChordsLoaders.tsx`: client-only loader, like the other sections'.
- Moved for a second user: `prettyNote` to `src/lib/notation.ts`, and the
  degree-number colours (`DEGREES`) to `components/fretboard/theme.ts`.
- `sections.ts` gains a `CHORDS` section; `/chords` gets an index page like
  `/practice` and `/explore`.

## URL

Each chord has its own URL on the one page:
`/chords/library?chord=am7b5`. The slug is the root and the type in lower
case; a capital M is written `maj` (four types differ from another only by
it: `amaj7b5` vs `am7b5`) and `#` is written `sharp` (`fsharpm7`,
`c7sharp9`). Picking a root or type pushes the new chord's URL, so links
and Back work. With no `chord`, or one it doesn't know, the page shows
Am7. Nothing is saved in localStorage; the selected voicing and Show all
are not in the URL. (The page is static, so the chord is read in the
browser; a path such as `/chords/library/am7b5` would have needed 1,272
prebuilt pages or a host rewrite rule.)

## Tests

- chordTypes: every tonal type is listed once; groups; symbols; spelled
  notes (Cm7, F♯°7, B♭13); required tones.
- voicings: well-known shapes appear (open C, open Am7, E-shape and
  A-shape barres); every voicing obeys the playable rules; the best few
  are a subset of all; open and moveable don't overlap.
- URLs: slugs as above; every root and type has its own slug of letters
  and digits that reads back; unknown slugs fall back to Am7.
- ChordLibrary: opens on the default chord; shows the chord the URL
  names; changing root and type pushes its URL; tapping a diagram puts it on the neck; ‹ › step;
  Show all adds shapes.
