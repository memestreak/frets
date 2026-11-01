# Shared logic (`src/lib/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/lib/` holds pure logic, no React.
- `theory/` is the one music-theory core, for every page, and the only
  place that imports tonal. It knows nothing about the guitar.
  `docs/specs/2026-10-30-music-theory-core-design.md` says why and what goes
  where.
  - `notes.ts`: pitch classes (`pitchClassOf`), sharp and flat spellings,
    `prettyNote` (♭ ♯ 𝄪 𝄫 glyphs), `transposeNote`.
  - `intervals.ts`: degree labels (`intervalLabel`, "♭3"), chord tone labels
    (`toneLabel`, "R", "♯9"), quality-first names ("m3") and their words.
  - `chords.ts`: the one table of chord types and symbols: tonal's types
    plus add11, add9(add11), m(maj7)♯11
    (`docs/specs/2026-10-17-add11-chords-design.md`), m(maj7)♯5 and sus4♯5,
    with our groups and symbols. Also roots, `chordOf` (spelled notes, tone
    labels, which tones a voicing may leave out), `chordFromTones` (a type,
    or an unnamed chord, from a set of pitches), `chordFromIntervals` (the
    same from spelled intervals, so C E G♯ B is Cmaj7♯5), and `withBass`
    (a chord over a bass outside it;
    `docs/specs/2026-10-18-bass-outside-chord-design.md`).
  - `chordNames.ts`: every name for a set of notes (the Chords page's name
    list). `chordSearch.ts`: reads a typed chord name into a root and type.
  - `scales.ts`: the scale list, spelled scales, mode families and rotation.
  - `diatonic.ts`: chords stacked on a scale's degrees, with their numerals,
    named from `chords.ts`; `numeralOf` numbers a triad against a tonic.
  - `keys.ts`: the `Key` (sharps or flats, major or minor, as alphaTex and
    MusicXML store it) shared by Tab and the Circle of fifths; tonics,
    parallel and relative keys, signatures, the circle's spokes, and how a
    pitch is spelled in a key (`spellPitch`).
  - `modes.ts`: the major scale's seven modes and the key each is spelled
    from (`parentKey`).
- `music.ts`: the guitar: standard tuning (`TUNING`, `Tuning`,
  `isStandardTuning`), string names, `positionsOnNeck`, and the trainers'
  intervals and random picks. `fretWindow.ts`, `fretboardGeometry.ts`,
  `storage.ts`, `theme.ts`. `shortcuts.ts`: the `?` overlay's types (a page's
  groups of shortcuts), the keys every page has, how a key is drawn (⌘ on a
  Mac, Ctrl elsewhere) and which `?` press is meant for the page.
  `click.ts`: the metronome click, a synthesized wood-block tick, for Tab's
  metronome and the Metronome page's wood block.
- `chords/`: chords on the guitar. `publishedShapes.ts` holds the shapes
  guitarists play, from Haus of Chords (`data/haus-of-chords.json`, CC BY
  4.0, credited in `NOTICE.md`; re-import with
  `scripts/import-haus-of-chords.py`, see `data/README.md`).
  `voicings.ts` shows those first and otherwise searches the neck for
  playable shapes (each rule a named constant), in any tuning (standard by
  default; the published shapes only in standard tuning). It splits them
  into open, the best few moveable and all moveable, and picks the shapes
  in a five-fret position (`shapesInPosition`). `chordUrls.ts` holds the
  Chord library's URLs.

## Storage keys

`localStorage["frets.practice.intervals"]` and `["frets.practice.notes"]`
hold `{ set, stats }` (the Note trainer's set includes the mic choice);
`["frets.tuner.settings"]` holds the tuner's meter and reference sound,
for the page and the trainer's tuner alike; `["frets.explore.scales"]` holds the Scale lab's
settings; `["frets.explore.triads"]` holds Triads' root, triad, string set
and labels; `["frets.chords.export"]` holds the Export dialog's choices; `["frets.chords.neck"]` the Chords neck's dot labels; the Tab page's work: `["frets.tab.works"]` its My arrangements index (its folders, each arrangement's id, name, folder and last change, and which is open) and `["frets.tab.works.<id>"]` each one's clip (its tracks, each with its tuning, instrument and playback FX), written only on Save; `["frets.tab.draft"]` the open clip while it has unsaved changes or was never saved (with the clip it is a change of, for one never saved), so a reload brings it back. Preferences, one key per Settings section (`<app>.<page>.<section>`, each a JSON object; `docs/specs/2026-10-29-settings-design.md`): `["frets.general.appearance"]` `{ theme }` (a link's `?theme=` sets it: the boot script in `theme.ts`); `["frets.tab.playback"]` whether the Tab page's playback controls show, their volume, transposition, Hear notes and Play's options; `["frets.tab.metronome"]` the metronome, count-in and click volume; `["frets.tab.notation"]` Staff | Tab | Both, bar numbers, size, the clip's line breaks and whether the arrangement header is shown or folded; `["frets.tab.colours"]` the colour scheme and Custom's two colours; `["frets.tab.ascii"]` the rhythm line; `["frets.tab.alphatex"]` line numbers; `["frets.tab.editing"]` whether the cursor leaving a short bar fills it with rests (off by default); `["frets.tab.export"]` its Export dialog's choices; the Metronome's work, `["frets.metronome.works.current"]`, its rhythm (tempo, beats, groups, steps, swing, voices, polyrhythm), and its preferences `["frets.metronome.display"]` `{ view }` (its view switch; the page has no Settings) and `["frets.metronome.playback"]` `{ volume }` (a live control, on the page only; all in `src/features/metronome/storage.ts`). The other pages' keys are still `frets.<section>.<page>`, until each joins Settings. Preferences are written with `savePreference` (`storage.ts`), which keeps the reason a save failed for the ⚠ after the Settings gear. The parsers next to
each key validate every field; keep them in step with settings changes.
