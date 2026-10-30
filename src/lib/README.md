# Shared logic (`src/lib/`)

Moved out of CLAUDE.md; keep it current when this folder's files change.

- `src/lib/` (pure logic, no React: `music.ts`
  with tuning, names, `intervalClass` and
  `positionsOnNeck`; `notation.ts` with `prettyNote`;
  `fretWindow.ts`, `fretboardGeometry.ts`, `storage.ts`; `chords/` with
  `chordTypes.ts`, the only tonal import outside the Scale lab: tonal's
  chord types (plus add11, add9(add11) and m(maj7)♯11, which it lacks;
  `docs/specs/2026-10-17-add11-chords-design.md`) with our groups and
  symbols, roots, `withBass` (a chord over a bass outside it;
  `docs/specs/2026-10-18-bass-outside-chord-design.md`), `chordOf` (spelled
  notes, tone labels, which tones a voicing may leave out) and
  `chordFromTones` (a type, or an unnamed chord, from a set of tones);
  `publishedShapes.ts`, the shapes guitarists play, from Haus of Chords
  (`data/haus-of-chords.json`, CC BY 4.0, credited in `NOTICE.md`;
  re-import with `scripts/import-haus-of-chords.py`, see `data/README.md`);
  `voicings.ts`, which shows those first and otherwise searches the neck
  for playable shapes (each rule a named constant), splits them into open,
  the best few moveable and all moveable, and picks the shapes in a
  five-fret position (`shapesInPosition`); `chordUrls.ts`, the Chord
  library's URLs)

## Storage keys

`localStorage["frets.practice.intervals"]` and `["frets.practice.notes"]`
hold `{ set, stats }` (the Note trainer's set includes the mic choice);
`["frets.tuner.settings"]` holds the tuner's meter and reference sound,
for the page and the trainer's tuner alike; `["frets.explore.scales"]` holds the Scale lab's
settings; `["frets.explore.triads"]` holds Triads' root, triad, string set
and labels; `["frets.chords.export"]` holds the Export dialog's choices; `["frets.chords.neck"]` the Chords neck's dot labels; the Tab page's work: `["frets.tab.works"]` its My arrangements index (its folders, each arrangement's id, name, folder and last change, and which is open) and `["frets.tab.works.<id>"]` each one's clip (its tracks, each with its tuning, instrument and playback FX). Preferences, one key per Settings section (`<app>.<page>.<section>`, each a JSON object; `docs/specs/2026-10-29-settings-design.md`): `["frets.general.appearance"]` `{ theme }` (a link's `?theme=` sets it: the boot script in `theme.ts`); `["frets.tab.playback"]` whether the Tab page's playback controls show, their volume, transposition, Hear notes and Play's options; `["frets.tab.metronome"]` the metronome, count-in and click volume; `["frets.tab.notation"]` Staff | Tab | Both, bar numbers, size and the clip's line breaks; `["frets.tab.colours"]` the colour scheme and Custom's two colours; `["frets.tab.ascii"]` the rhythm line; `["frets.tab.alphatex"]` line numbers; `["frets.tab.editing"]` whether the cursor leaving a short bar fills it with rests (off by default); `["frets.tab.export"]` its Export dialog's choices. The other pages' keys are still `frets.<section>.<page>`, until each joins Settings. Preferences are written with `savePreference` (`storage.ts`), which keeps the reason a save failed for the ⚠ after the Settings gear. The parsers next to
each key validate every field; keep them in step with settings changes.
