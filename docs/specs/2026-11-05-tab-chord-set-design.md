# Tab: the Chord set in the clip

Issue [#367](https://github.com/memestreak/frets/issues/367), step 1 of the
chords-in-Tab build order (planning doc
https://claude.ai/artifact/R4ffGZLV63TiViD2Hj3mr5, approved by Jeremy
2026-11-05). Taken from #251 items 1 and 5 and #242 option 2. It blocks
#251 and #242, and through them #364, #295 and #249.

Every later chord feature (the chord panel, diagrams in the page and the
exports, drawing a shape, rendering a chord into the staff) needs two
things this step gives: a shape stored with each chord, and the meaning of
a chord name. Nothing new is drawn and no control changes: the chord name
field (key `C`) is as it was.

## What

- **The Chord set.** Each track has one: every chord it names, each a name
  and, once given, a shape. The shapes are the track's alphaTex `\chord`
  definitions, read and written with every property alphaTab 1.8.4 reads:
  the frets per string, `firstfret`, `barre`, `showdiagram`,
  `showfingering` and `showname`. A property not written stays unwritten,
  so a definition writes back as it was.
- **Symbols point at entries by name.** A column's chord symbol is still
  its name (`Column.chord`, alphaTex `ch "Am7"`). It points at the entry of
  that name in its track's set, matched exactly, case and all: "AM7" and
  "Am7" are different chords.
- **Typed names join the set.** A name typed over a column that the set
  hasn't got is an entry with no shape, for as long as a column carries
  it. Typing a name the set has points at that entry. So the set always
  matches what's on the page.
- **Names are understood.** Each entry's name is read into a root, a type
  and, for a slash chord, a bass (`readChordName`, beside `findChord` in
  `src/lib/theory/chordSearch.ts`). A name that isn't a chord ("N.C.",
  "Hendrix chord") stays plain text, with no warning.

## Decided

From the 2026-11-01 evaluation
(https://claude.ai/artifact/Ws7FyE8hxitmqvU7kj7hUa):

- Q2: each track owns its Chord set.
- Q3: when a column's notes stop matching its chord's shape, the stored
  shape wins and the symbol stays. (Nothing compares them yet.)
- Q4: shapes are stored as fretted on the instrument as tuned, counted
  from the capo.
- Q7: unused chords are kept in the set.

Settled while building (my calls, open to change):

- **Two definitions with one name** are both kept, in the order written;
  every symbol of that name points at the last, as alphaTab links them.
  alphaTex's `ch` names a chord and can't say which of two it means, so
  choosing a shape per column waits for a later step.
- **A name with no shape is kept only while a column names it.** It is
  written as its `ch` alone, as before; only a definition is written as a
  `\chord` line. An unused chord is kept when it has a definition (Q7), so
  a mistyped name doesn't linger in the set once it's cleared.
- **Symbols are read as the beat writes them**, from the parse tree, not
  through alphaTab's chord list: alphaTab files chords under their name in
  lower case, so `ch "AM7"` then `ch "Am7"` came back as two "AM7"s.
- **Where the definitions go**: with the track's `\tuning` and `\capo`,
  one line a chord, wherever the text had them (a later bar's `\chord`
  too).
- A `\chord` giving fewer than six strings has the rest not played; more
  than six are named in the line under the clip and the first six read. A
  negative fret is a string not played, written back as `x`.

## Model

- `ChordDef` (`src/features/tab/chordSet.ts`): `name`, `frets?` (six, high
  e first as the clip's strings, `null` not played; none when the
  definition gives no strings), `firstFret?`, `barre?`, `showDiagram?`,
  `showFingering?`, `showName?`.
- `Track.chords?: ChordDef[]`, carried by a `Part` like the capo and FX,
  so edits, undo, storage, links and copies keep it.
- `chordSet(track)`: the entries, definitions first in the order written,
  then names only typed, in the order the columns come; each with its
  definition (if any), how many columns use it, and its reading.
- `chordDefOf(chords, name)`: the definition a symbol points at.

## How

- `chordSet.ts`: the types, `chordSet`, `chordDefOf`, `chordDefTex` (the
  `\chord` line) and `isChordDef` (storage).
- `alphatexRead.ts`: a `\chord` tag in any of a track's bars becomes a
  `ChordDef` from the parse tree (no longer "Kept but not drawn yet"); a
  beat's `ch` is read from the tree as written.
- `alphatex.ts`: `trackLines` writes each definition after `\tuning` and
  `\capo`:
  `\chord ("Am7" 0 1 0 2 0 x) {firstfret 1 barre 1 showdiagram false}`,
  properties in that order, `barre` in brackets only for more than one
  fret.
- `clip.ts`: `Track.chords`, `Part.chords`, `TRACK_FIELDS`, and
  `parseClip` checks each stored definition.
- `src/lib/theory/chordSearch.ts`: `readChordName`.
- Built-in arrangement `song_structure/chord-shapes.atex`: every property,
  an unused chord, and a name with no shape.
- `public/tab-alphatex.txt` (Chord shapes) and
  `public/skills/frets-tab/SKILL.md` tell agents to write `\chord` with the
  shape.

## Later

- The chord panel (#251), diagrams over names and in exports (#242),
  drawing a shape, rendering a chord into the staff (#364), the lead
  sheet view (#295), theory tools (#249).
- Picking which of two same-named shapes a column uses (needs a way to
  say so in alphaTex).
- Chord diagrams from Guitar Pro and MusicXML imports.

## Tests

- Round-trip: a clip with `\chord` definitions (every property) reads and
  writes back unchanged, with no warning; the built-in
  `chord-shapes.atex` is one.
- A `\chord` with no `ch` reference is kept (unused chord).
- Two definitions with the same name and different shapes both survive;
  `ch` of that name points at the last.
- Typing a new name adds an entry with no shape; typing an existing name
  links to it; clearing a typed name takes it out of the set, while a
  definition stays.
- `readChordName`: "Am7" is A m7; "C/G" is C major over G; "F#m7b5" is
  F♯ m7b5; "N.C." and "Hendrix chord" are null, and "N.C." reads with no
  warning.
- Multi-track: each track's set stays on its own staff.
- `ch "AM7"` and `ch "Am7"` read as written.
- Fewer than six strings: the rest not played; a negative fret is `x`;
  more than six: named, the first six read.
- A `\chord` with no strings is kept as written.
- A stored set survives `parseClip`; a definition with the wrong number of
  frets is refused.
