# Shared logic (`src/lib/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/lib/` holds pure logic, no React.
- `theory/` is the one music-theory core, for every page, and the only
  place that imports tonal. It knows nothing about the guitar.
  `docs/specs/2026-10-30-music-theory-core-design.md` says why and what goes
  where.
  - `notes.ts`: pitch classes (`pitchClassOf`), a sounding note name's MIDI
    number (`midiOf`, "E2" 40), sharp and flat spellings,
    `prettyNote` (♭ ♯ 𝄪 𝄫 glyphs), `transposeNote`.
  - `intervals.ts`: degree labels (`intervalLabel`, "♭3"), chord tone labels
    (`toneLabel`, "R", "♯9"), quality-first names ("m3") and their words.
  - `chords.ts`: the one table of chord types and symbols: tonal's types
    plus add11, add9(add11), m(maj7)♯11
    (`docs/specs/2026-10-17-add11-chords-design.md`), m(maj7)♯5 and sus4♯5,
    with our groups and symbols. Also roots, `chordOf` (spelled notes, tone
    labels, which tones a shape may leave out), `chordFromTones` (a type,
    or an unnamed chord, from a set of pitches), `chordFromIntervals` (the
    same from spelled intervals, so C E G♯ B is Cmaj7♯5), and `withBass`
    (a chord over a bass outside it;
    `docs/specs/2026-10-18-bass-outside-chord-design.md`).
  - `chordNames.ts`: every name for a set of notes (the Chords page's name
    list). `chordSearch.ts`: reads a typed chord name into a root and type
    (`findChord`), and a bass after a slash too (`readChordName`).
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
  `isStandardTuning`), string names, `spotsOnNeck`, and the trainers'
  intervals and random picks. `fretRange.ts`, `fretboardGeometry.ts`,
  `storage.ts`, `theme.ts`. `shortcuts.ts`: the `?` overlay's types (a page's
  groups of shortcuts), the keys every page has, how a key is drawn (⌘ on a
  Mac, Ctrl elsewhere) and which `?` press is meant for the page.
  `tapTempo.ts`: tap tempo (a run of presses and the tempo they keep, in a
  page's bpm range), for the Metronome's Tap, Tab's tempo panel and `show_tab`'s Tap.
  `click.ts`: the metronome click, a synthesized wood-block tick, for Tab's
  metronome and the Metronome page's wood block.
- `chords/`: chords on the guitar. `publishedShapes.ts` holds the shapes
  guitarists play, from Haus of Chords (`data/haus-of-chords.json`, CC BY
  4.0, credited in `NOTICE.md`; re-import with
  `scripts/import-haus-of-chords.py`, see `data/README.md`).
  `shapes.ts` shows those first and otherwise searches the neck for
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
and labels; `["frets.chords.export"]` holds the Export dialog's choices; `["frets.chords.neck"]` the Chords neck's dot labels; the Tab page's work: `["frets.tab.works"]` its My arrangements index (its folders, each arrangement's id, name, folder and last change, and which is open) and `["frets.tab.works.<id>"]` each one's clip (its tracks, each with its tuning, instrument, playback FX and `\chord` shapes, and its bars' Columns by Voice), written only on Save; `["frets.tab.draft"]` the open clip while it has unsaved changes or was never saved (with the clip it is a change of, for one never saved), so a reload brings it back. `["frets.tab.layout"]` `{ open, order, heights, collapsed, width }`, the Tab page's palettes: which are open, their order top to bottom (`notes`, `articulations`, `bars`, `chords`, `chat`), the heights dragged in px (48 at least; a palette not listed is as tall as its tools), whether the column is collapsed, and its width in px (224 to 560, 272 by default) (issues #454 and #431; `parseLayout` in `src/features/tab/TabRail.tsx`): kept across visits like a window's size, not a preference, so Settings doesn't list it. `["frets.tab.chordPanel"]` `{ folded }`, which of the Chords panel's sections are folded (`chords`, its list; `parseChordPanel` in `src/features/tab/ChordPanel.tsx`), kept the same way. Preferences, one key per Settings section (`frets.<page>.<section>`, each a JSON object; `docs/specs/2026-10-29-settings-design.md`): `["frets.general.appearance"]` `{ theme }`, Light when missing (a link's `?theme=` sets it: the boot script in `theme.ts`); `["frets.tab.playback"]` whether the Tab page's playback controls show, their volume, transposition, Hear notes, Hear chords (the Chords panel's toggle), Play's options, and how chords marked Downstroke or Upstroke, Strum down or up, or Rolled chord roll (`strokes`, `strums`, `rolledChords`, each with its length as a percentage of the chord); `["frets.tab.metronome"]` the metronome, count-in and click volume; `["frets.tab.notation"]` Staff | Tab | Both, bar numbers, size, the clip's line breaks, whether the arrangement header is shown or folded, whether the tuning shows its strings (`tuningDetails`), and the Chord chart and chord diagrams (`chordChart`, `chordDiagrams`); `["frets.tab.colours"]` the colour scheme and Custom's two colours; `["frets.tab.ascii"]` the rhythm line and the chord chart (`chords`); `["frets.tab.alphatex"]` line numbers; `["frets.tab.editing"]` note input mode's grid (`fixedGrid`, off: it follows note input mode's length; `grid`, a 16th by default; `gridLook`, `ruler` or `lines`, how it is drawn); `["frets.tab.export"]` its Export dialog's choices; `["frets.tab.chat"]` `{ apiKey, model, instructions, custom }`, the Chat panel's OpenRouter key and model, its edited instructions (`null` while they are the default) and its custom prompt (`parseChatPrefs` in `src/features/tab/chat/chatPrefs.ts`; issue #424): the key stays on this device and never goes into a link; the Metronome's work, `["frets.metronome.works.current"]`, its rhythm (tempo, beats, groups, steps, swing, voices, polyrhythm), and its preferences `["frets.metronome.display"]` `{ view }` (its view switch; the page has no Settings) and `["frets.metronome.playback"]` `{ volume }` (a live control, on the page only; all in `src/features/metronome/storage.ts`). The keys above that don't follow that pattern (the trainers', the tuner's, the Scale lab's, Triads' and the Chords page's) are the old ones, kept until each page joins Settings. Preferences are written with `savePreference` (`storage.ts`), which keeps the reason a save failed for the ⚠ after the Settings gear. The parsers next to
each key validate every field; keep them in step with settings changes.

## Specs

- `docs/specs/2026-10-31-metronome-design.md`: the Metronome page: four views,
  tap tempo, meter, groups and swing
- `docs/specs/2026-10-30-music-theory-core-design.md`: all music theory moves
  into src/lib/theory/, the only tonal importer
- `docs/specs/2026-10-30-keyboard-shortcuts-design.md`: ? shows the page's
  keyboard shortcuts; each page keeps its list
- `docs/specs/2026-10-29-tab-tempo-button-design.md`: the tempo in the score's
  head, with tap tempo
- `docs/specs/2026-10-29-settings-design.md`: one Settings dialog for every
  Preference, one key per Section
- `docs/specs/2026-10-18-bass-outside-chord-design.md`: a chord over a bass
  outside it gets a slash name
- `docs/specs/2026-10-17-add11-chords-design.md`: added-eleventh chord types,
  so such shapes get a name
- `docs/specs/2026-10-16-chord-search-design.md`: a typed or pasted chord name
  picks the chord
- `docs/specs/2026-10-09-published-chord-shapes-design.md`: published shapes
  (Haus of Chords) come before searched ones
- `docs/specs/2026-10-07-scale-lab-position-shapes-design.md`: the diatonic
  chords as shapes in one Position, each tile cycling its shapes
- `docs/specs/2026-10-04-practice-restructure-design.md`: shared code moves
  out of the trainers into lib, components and hooks

## Decisions

- `docs/adr/2026-11-02-no-users-yet.md`: no migrations of URLs, keys or saved
  state
- `docs/adr/2026-11-02-one-theory-core.md`: all theory in src/lib/theory/, the
  only tonal importer
