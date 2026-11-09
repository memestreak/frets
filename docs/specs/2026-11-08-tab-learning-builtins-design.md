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
- **Songs** (`songs/`): four short original songs in different styles,
  8 to 11 bars, each with sections, a tempo, chord names and real guitar
  parts: a melody or lead line, techniques, and repeats. Jeremy,
  2026-11-08, on a first draft: the songs were "way too simple", no
  campfire song and no plain blues.
  - `morning-light` "Morning Light": fingerstyle in C, Travis picking
    with a melody on top (C Em/B Am7 Fmaj7 Dm7 G), a slide and a
    hammer-on, repeat with first and second endings, harmonics to end;
    76 bpm.
  - `night-drive` "Night Drive": E minor rock on two tracks. Rhythm: a
    syncopated palm-muted riff with power-chord stabs, a verse, a driving
    chorus ending on B7; distortion FX. Lead: a fill, then bends,
    vibrato and a triplet run over the chorus; 132 bpm.
  - `cold-brew` "Cold Brew": funk in E minor: Em9 and A13 sixteenth
    strums with muted strums, a single-note riff, a stop-time break with
    half-step chord slides, a Cmaj9 Bm7 Am7 B7♯9 bridge; 100 bpm.
  - `harbour-lights` "Harbour Lights": a jig in 6/8 in DADGAD tuning,
    melody against open drones, a pull-off and a grace note, harmonics
    to end; 150 bpm.

## Rules

- **Originals only.** Every song and riff here is written for Frets; no
  copyrighted song or recognisable melody.
- **Tests, not samples.** Like every folder but `samples/`, each file
  reads with no warnings, every bar full, and writes back exactly
  (`examples.test.ts`). They are written in the form Frets writes.
- **Only what Frets draws.** Chord names and diagrams, stroke marks,
  ties, dead notes, palm mute, bends, slides, hammer-ons, harmonics,
  grace notes, tuplets, tunings, tracks, sections, tempo, repeats, texts, FX.
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
