# Tab: built-in chord types, progressions, strumming patterns and songs

Asked 2026-11-08 (Jeremy, issue #434): "a few more categories of built-in
arrangements. … arrangement with different types of chords, in common
chord progressions, and strumming patterns. … a folder that has a few very
short but realistic simple songs."

Until now the built-ins showed what Frets draws, one feature per file.
These four folders are for learning guitar: each file is something a
player would practise.

## What

Four new folders in `src/features/tab/builtin_arrangements/`, listed under
Arrangements… → Built-in like the others:

- **Chord types** (`chord_types/`): one file per family, every chord named
  with its diagram, a short text naming the family.
  - `major-minor`: open C G D A E, Am Em Dm, barre F and Bm.
  - `sevenths`: dominant 7 (G7 C7 D7 A7 E7 B7), major 7 (Cmaj7 Fmaj7),
    minor 7 (Am7 Em7 Dm7), half-diminished (Bm7♭5).
  - `sus-add`: D Dsus4 D Dsus2, A Asus4 A Asus2, C Cadd9, Esus4 E.
  - `sixths-ninths`: C6 G6 A6, E9 C9 D9.
  - `diminished-augmented`: C Caug Am, Cdim7 G, G#dim7 Am.
  - `power-chords`: E5 A5 G5 C5 D5 (root, fifth, octave).
  - `slash-chords`: G D/F# Em C/G Am Am/G C G/B.
- **Progressions** (`progressions/`): one bar per chord in quarter-note
  downstrokes, the Roman numeral as a short text under each new chord.
  - `one-four-five`: I–IV–V in G.
  - `pop-progression`: I–V–vi–IV in C.
  - `fifties-progression`: I–vi–IV–V in C.
  - `six-four-one-five`: vi–IV–I–V in C.
  - `two-five-one`: ii–V–I in C, with movable jazz voicings.
  - `minor-rock`: i–♭VII–♭VI–♭VII in A minor.
  - `andalusian-cadence`: i–♭VII–♭VI–V in A minor.
  - `twelve-bar-blues`: 12-bar blues in A, without the quick change
    (I7 ×4, IV7 ×2, I7 ×2, V7 IV7 I7 V7).
- **Strumming** (`strumming/`): stroke marks on every
  strum, the counting as a short text on the first bar.
  - `all-downstrokes`: quarters.
  - `down-up-eighths`: eighths, down on the beat, up on the "and".
  - `folk-strum`: D DU UDU, the missed down on 3 written as a tie.
  - `funk-sixteenths`: E9 sixteenths with muted (dead-note) strums.
  - `waltz-strum`: 3/4 bass, strum, strum.
  - `six-eight-strum`: 6/8 D D U D D U.
  - `reggae-chops`: rests on the beat, a short chop on each "and".
  - `palm-muted-eighths`: palm-muted power chords, the last one ringing.
- **Songs** (`songs/`): four short original songs, 8 to 13 bars, each with
  sections, a tempo, chord names and a riff or picked line.
  - `campfire-in-g` "Campfire in G": picked intro, folk-strum verse
    (G Em C D), half-bar chorus, 100 bpm.
  - `back-porch-blues` "Back Porch Blues": a 12-bar boogie shuffle in A on
    the clean electric, with an ending hit, 96 bpm.
  - `morning-light` "Morning Light": a fingerpicked ballad in C
    (C Am F G twice), let ring, 72 bpm.
  - `night-drive` "Night Drive": a palm-muted E minor riff, repeated,
    then a power-chord chorus, with distortion FX, 128 bpm.

## Rules

- **Originals only.** Every song and riff here is written for Frets; no
  copyrighted song or recognisable melody.
- **Tests, not samples.** Like every folder but `samples/`, each file
  reads with no warnings, every bar full, and writes back exactly
  (`examples.test.ts`). They are written in the form Frets writes.
- **Only what Frets draws.** Chord names and diagrams, stroke marks,
  ties, dead notes, palm mute, sections, tempo, repeats, texts, FX.
- File names are unique across all folders, as before.
- `articulations/strumming.atex` stays: it shows the stroke marks as a
  feature, not a pattern to practise.

## Tests

- Every new file reads with no warnings, every bar full, its title as
  listed above, and writes back as written (`examples.test.ts`, which
  covers every folder but `samples/` already).
- The four folders show in Arrangements… as "Chord types",
  "Progressions", "Strumming" and "Songs".

## How

Add the files; nothing else lists them (`builtin_arrangements/README.md`).
