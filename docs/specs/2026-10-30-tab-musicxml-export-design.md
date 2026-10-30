# Tab: MusicXML export

Issue #241. Jeremy asked (2026-10-30) to download a Tab arrangement as
MusicXML, so it opens in MuseScore, Guitar Pro, Sibelius, Dorico and the
like. alphaTab 1.8.4 has a MusicXML importer but no writer, so Frets writes
the file itself from its own clip (`musicxml.ts`, pure, no new dependency),
which also makes the file say what Frets draws.

## Decisions (Jeremy, 2026-10-30)

1. **Both staves, always.** Every track is written with a notation staff and
   a tab staff, whatever Staff | Tab | Both shows. The app that opens the file
   decides what to display.
2. **`.musicxml` only** (uncompressed MusicXML 4.0, partwise). Compressed
   `.mxl` needs a zip writer; it can come later.
3. **MusicXML first.** A `.gp` export through alphaTab's `Gp7Exporter` is a
   separate follow-up PR.
4. **MusicXML is in both places** the clip is saved from: Download MusicXML in
   the Export dialog's "As text" row, after Download ASCII, and MusicXML… in
   the Notation view's save list, after alphaTex….

With it, the header's **Export options** button is called **Export**.

## The file

- **The whole clip, every track**, as Download alphaTex is: each track is a
  `score-part` and a `part`, named as its `\track` names it ("Guitar", or
  "Guitar 2" and so on when unnamed), with its General MIDI program
  (`midi-program` is the program + 1, as MusicXML counts) on its own MIDI
  channel, skipping 10.
- **Staves:** `staves 2`. Staff 1 is a treble clef an octave down (`clef G 2`,
  `clef-octave-change -1`); staff 2 is `TAB` with six lines, the track's
  `staff-tuning` (lowest string line 1, each string named as the tuning names
  it) and its `capo`. Each note is written twice, once on each staff (voice 1
  and voice 5, a `backup` between), as linked staff-and-tab parts are.
- **Pitch:** spelled in the bar's key as the staff draws it (`spell` in
  `notation.ts`), at the pitch the note sounds with the octave clef, the capo
  included. A guitar with every string tuned alike ("tune down 1/2 step") is
  written as fingered in standard tuning, as Frets and guitar books draw it,
  with a `transpose` (`chromatic` -1) that says how it sounds; the tab
  staff's tuning is the real one. A fret is counted from the capo, as Frets
  writes it.
- **Accidentals:** written as Frets shows them: only where the key and the bar
  so far don't already say it, on staff 1 only.
- **Divisions:** the fewest ticks to a quarter that make every note and bar a
  whole number (1 for quarters, 2 for eighths, 3 once there are eighth
  triplets), not Frets' 3548160 to a whole note.
- **Beams** as Frets beams them (`beamGroups`, now taking any columns, not only
  laid-out ones), with a second beam and so on for sixteenths and shorter.
- **The score's marks** (tempo, section, "Free time") go in the first part
  only; signatures, repeats, endings and bar lines go in every part.

## What maps

| Frets | MusicXML |
|---|---|
| Title, `\artist`, `\words`, `\music` | `work-title`; `creator` composer, lyricist, artist; `credit` title, subtitle (the artist) and the "Words & Music by" lines, placed at the top of an A4 page (`defaults`), as MuseScore puts a credit in the score's head only when it is in the page's top half |
| Time and key signatures | `attributes/time`, `key` (fifths, mode), from the bar that changes them |
| Repeats, endings, `\db` | `barline`: `heavy-light` + `repeat forward`, `light-heavy` + `repeat backward times`, `ending start` / `stop` (before a repeat's end) / `discontinue`, `light-light`; the last bar `light-heavy` |
| Free time (`\ft`) | the bars' closing lines `dashed`, "Free time" words on the first; the time signature stays, as alphaTab needs it for the bar's length |
| Tempo, its label | `metronome` quarter = bpm, `sound tempo`, the label as words |
| Section | `rehearsal` (its marker, boxed) and its text as words |
| `\multiBarRest` | `measure-style/multiple-rest` at the first bar of each run Frets draws as one (`multiRests`) |
| Line breaks (`\systemsLayout`) | `print new-system="yes"` |
| Durations, dots, tuplets | `type`, `dot`, `time-modification` + `tuplet` start / stop |
| Grace notes | `grace` (`slash="yes"` before the beat), no duration |
| Rests, empty bars | `rest`; an empty bar `rest measure="yes"` |
| Ties | `tie` + `tied` start / stop |
| String and fret | `technical/string` (1 the high e), `fret`, staff 2 only |
| Hammer-on, pull-off | `hammer-on` / `pull-off` start ("H", "P") and stop |
| Slides from the note before (`sl`, `ss`) | `slide` start / stop |
| Slide in from below / above, out down / up | `scoop`, `plop`, `falloff`, `doit` |
| Bend, pre-bend, release, held bend pushed on, let down part way | `bend` with `bend-alter` in semitones, `pre-bend`, a second `bend` with `release` |
| Whammy bar | `bend` to its deepest point with `with-bar` |
| Natural, artificial harmonic | `harmonic` `natural`, `artificial` |
| Pinch harmonic | "P.H." words |
| Tap | `tap` |
| Vibrato | `ornaments/wavy-line` over each run on a string |
| Tremolo picking | `tremolo` (1, 2 or 3 slashes) |
| Mordents | `inverted-mordent` (upper), `mordent` (lower) |
| Accents, staccato | `accent`, `strong-accent`, `staccato` |
| Fermata | `fermata`: short `angled`, medium `normal`, long `square` |
| Pick strokes | `down-bow`, `up-bow` |
| Wah closed "+", open "o" | `stopped`, `open` |
| Dead note, ghost note | `notehead x` (its open string's pitch, fret 0), `notehead parentheses` |
| Palm mute, let ring | "P.M." and "let ring" words with dashes over the run |
| Hairpins | `wedge` crescendo / diminuendo, stop |
| 8va, 8vb, 15ma, 15mb | `octave-shift` (down 8 for 8va, as MusicXML counts) |
| Chord names | `harmony`: root, `kind` (the suffix as written kept as its `text`, so it reads as typed; `other` for one MusicXML has no kind for) and a slash's bass; a name that doesn't start with a note (N.C.) as words |
| Text (`txt`) | words above |

Marks of a whole column (accents, staccato, the fermata, mordents, tremolo,
strokes, the wah) are written once, on the chord's first note, on staff 1.
The guitar's own marks (joins, bends, harmonics, taps, vibrato) are on
both staves.

## What the file leaves out

- **The FX**, which belong to Frets' playback.
- **alphaTex Frets keeps without drawing** (`extra`, `header`), other than
  the credits.

When a clip has either, a small red ⚠ after Download MusicXML says so on
hover ("The MusicXML file leaves out the FX."), as the Sound list's ⚠ does
(`musicXmlLosses`). Nothing is said of the approximations (the whammy bar's
shape, a held bend's later heights): the file still says what is played.

## Tests

`src/__tests__/tab/musicxml.test.ts`:

- Every built-in arrangement's file is valid against the MusicXML 4.0 XSD
  (`src/__tests__/tab/musicxml/`, run through `xmllint-wasm`, a dev
  dependency).
- alphaTab's own `MusicXmlImporter` reads every built-in's file back as the
  same beats: lengths, dots, tuplets, grace notes, rests, strings, frets and
  ties, every track, and the same tuning. Two importer quirks are worked
  around in the test, not the file: it loses ties under a `transpose`, so it
  reads the file without one, and it pads a bar of 5-, 6- or 7-tuplets with a
  256th rest.
- Each mapping above is checked in the XML itself, as the importer drops
  some (hammer-ons, natural harmonics, dead notes).

## Checked in MuseScore

MuseScore 4's importer (read in its 4.5.2 source) sets each note's string and
fret from `technical` on a staff whose clef is `TAB`, and places credits by
their `default-y`. MuseScore 3.2 (the one a Linux package offers) ignores
the string when a fret is given and lays the tab out from the pitches, so
its tab differs from Frets'; that is its importer, fixed in 3.6.

## Later

- `.mxl` (compressed).
- `.gp` export (its own PR).
- MusicXML import, through alphaTab's importer.
