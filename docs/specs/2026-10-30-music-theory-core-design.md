# One music-theory core (`src/lib/theory/`)

Issue: first step of [#242](https://github.com/memestreak/frets/issues/242)
(Chords-page knowledge in Tab), laying the ground for
[#251](https://github.com/memestreak/frets/issues/251) (an arrangement's
chord set) and [#249](https://github.com/memestreak/frets/issues/249) (key,
numerals and modulation in Tab). Jeremy, 2026-10-30: "Option 3 please (one
core)", from the survey in project files
`tab-editor/chords/shared-chord-logic.md`.

## Why

Before this change the theory lived in four places:

- `src/lib/chords/chordTypes.ts`: chord types and symbols (tonal).
- `src/features/chords/naming.ts`, `chordSearch.ts`: naming notes and
  reading typed names, Chords page only.
- `src/features/explore/scales/theory.ts`: scales, modes and diatonic
  chords, with its own table of chord symbols (tonal).
- `src/features/explore/circle/circle.ts`: keys as spokes, numerals and the
  modes' parent keys.

and Tab had its own key (`{ fifths, minor }` in `clip.ts`), its own key
spelling (`spell` in `notation.ts`), and its own copies of the note-name
tables and pitch-class parsers. The Circle's key was `{ spoke, minor }`.
Two symbol tables disagreed on five chords, and the Scale lab's position
shapes named C E G♯ B as "CM7♭6" (looked up by pitch, not spelling).

Tab needs all of it: names for the notes in a column, readable typed
names, shapes in the clip's tuning, and (for #249) keys, numerals and modes.

## Layout

`src/lib/theory/` knows no guitar and is the only folder that imports tonal.

| File | Holds |
|---|---|
| `notes.ts` | `mod12`, `pitchClassOf` (ASCII or glyphs), `SHARP_NOTES` / `FLAT_NOTES`, `LETTERS` / `LETTER_PCS`, `transposeNote`, `prettyNote` |
| `intervals.ts` | `ACCIDENTAL_GLYPHS`, `semisOf`, `alterationOf`, `degreeNumber`, `intervalLabel` ("♭3"), `toneLabel` ("R", "♯9"), `intervalName` ("m3"), `intervalBetween`, `intervalWords` |
| `chords.ts` | the one chord-type table and symbols; `chordOf`, `chordFromTones`, `chordFromIntervals`, `withBass`, `formulaOf` |
| `chordNames.ts` | every name for a set of notes (was the Chords page's `naming.ts`) |
| `chordSearch.ts` | reads a typed chord name (unchanged) |
| `scales.ts` | the scale list, `scaleOf` (any spelled root), mode families, `rotateMode` |
| `diatonic.ts` | `diatonicChords` (symbols from `chords.ts`, each with its `ChordInfo`), `numeralOf` |
| `keys.ts` | `Key` `{ fifths, minor? }`, tonics, `keyOfTonic`, parallel and relative keys, `keySignature`, `keyAccidentals`, `spellPitch`, and the circle's spokes (`spokeOf`, `keyOnSpoke`, `wheelKey`) |
| `modes.ts` | the major scale's modes, `parentKey`, `modeForKey` / `keyForMode` |

The guitar stays out of the core: `src/lib/music.ts` (standard tuning, the
`Tuning` type, `isStandardTuning`, the neck) and `src/lib/chords/`
(published shapes, the voicing search, chord URLs).

What stays with a page is what only that page draws: the Circle's wheel
(cells, rings, spokes' tips, `keyWheel` / `modeWheel`), the Scale lab's
neck (`scales/neckNotes.ts`), Tab's staff (`keySigns`, staff steps).

## One key

The key is Tab's `{ fifths, minor? }`: it is how alphaTex and MusicXML
store a key and covers all fifteen signatures. The Circle's spoke is
`spokeOf(key)` (fifths mod 12), and `keyOnSpoke` gives the key the circle
names on a spoke (five flats to six sharps: F♯ major and D♯ minor at the
bottom, then D♭ and B♭ minor). `wheelKey(tonicPc, minor)` finds the circle's
key on a tonic, so the Circle's parallel of C♯ minor stays D♭ major, while
`parallelKey` (for Tab) keeps the tonic's letter where a signature can.

## One table of symbols

The Scale lab's diatonic chords take their symbols from `chords.ts` via
`chordFromIntervals`: the type with exactly the stack's spelled intervals,
else the first with the same pitches (a ♯3 over a ♯5 is the sus4 it sounds
as), else the stack's notes. Numerals add the symbol after the Roman
numeral, less the m a lower-case numeral already says, and ø7 for m7♭5.

Where the two tables disagreed (Jeremy's call pending at the time of
writing, recommended option shipped):

| Stack | Scale lab before | Chords before | Now, both |
|---|---|---|---|
| 1 3 ♯5 7 | +maj7 | maj7♯5 | maj7♯5 |
| 1 ♭3 ♭5 7 | °(maj7) | oM7 | °(maj7) |
| 1 4 ♯5 7 | maj7♯5sus4 | M7♯5sus4 | maj7♯5sus4 |
| 1 ♭3 ♯5 7 | m(maj7)♯5 | (none) | m(maj7)♯5, a new type |
| 1 4 ♯5 | sus4♯5 | (none) | sus4♯5, a new type |

The sus4♯5 is left out of naming notes (`chordNames.ts`): over a bass it
reads every inverted 6th chord as one (G B E over G as Bsus4♯5/F𝄪). The
Scale lab's words for a chord's quality ("minor 7") are kept, keyed by type.

## Tuning

`findVoicings(chord, tuning)` and `toneAt(chord, string, fret, tuning)`
take the guitar's open strings as MIDI notes, low string first, standard
by default. `ChordDiagram` takes an optional `tuning`. The published shapes
are written for standard tuning, so another tuning gets searched shapes
only. (Tab numbers strings from the high e; it reverses its open strings
when it calls these.) Capo handling is #242's question 4 and is not here.

## Not changed

Every page looks and behaves as before, except the symbols in the table
above (Scale lab and Chords page) and two new chord types in the Chords
page's Type list and `public/chord-links.txt`. No storage keys change.

## Tests

`src/__tests__/theory/` holds the core's tests (the old chord-type, naming,
search and Scale lab theory tests moved there), plus new ones for notes,
keys and the circle's spokes, `chordFromIntervals` and the shared symbols,
voicings in drop D and E♭ tuning, and `toneAt` in a tuning.
