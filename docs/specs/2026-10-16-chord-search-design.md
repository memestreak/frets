# Chord search

The Chords page picks a chord with the root tiles and the Type dropdown. A
chord whose name you already know, or have copied from a song sheet, can
now be typed or pasted instead. Settled with Jeremy on 2026-10-16.

## What it looks like

- A magnifier button sits between the Type dropdown and Clear. Pressed, it
  swaps the dropdown for a search box in exactly its place and size; the
  button shows as pressed while the box is open.
- The dropdown has one fixed width (15rem; 12rem on a phone) for every
  type, so the swap moves nothing. It no longer hugs the type it shows.
- The empty box reads `e.g. Am7, F#m7b5`. There is no help button.
- The "Type" label stays beside the box.

## Behaviour

- The magnifier, or `/` anywhere on the page but a field, a menu or a
  dialog, opens the box empty, with focus in it.
- Enter looks the name up. A chord found sets both the root and the type,
  exactly as a pick from the menus does (its first shape on the neck, one
  history entry for Back); the box turns back into the dropdown, now on
  the new type, and focus goes to the magnifier.
- Nothing found: the box stays open with what was typed, and a note floats
  just under it, over the page rather than pushing it down: `No chord
  "Hm7". Try a root then a type: Am7, F#m7b5, Cmaj9.` It goes at the next
  keystroke.
- Esc, the magnifier again, or a click anywhere else closes the box and
  drops what was typed.
- Space types a space in the box (the Arpeggio shortcut leaves fields
  alone), and `/` types a slash.
- The query is not in the URL and nothing is saved: the chord found is in
  the URL as any other pick is.

## What a name may be

Generous, so a name pasted from elsewhere is generally found if it is a
real chord (`findChord` in `src/features/chords/chordSearch.ts`):

- A root letter in either case, with `b`, `#`, `♭`, `♯` or doubles. Roots
  are spelled as the page spells them (`C#m` is D♭m, `Cb` is B).
- Then a type in any of tonal's aliases, the symbol the menu shows, or its
  name written out: `m7`, `min7`, `mi7`, `-7`, `A minor seventh`; `maj7`,
  `M7`, `Δ7`, `Δ`; `°7`, `o7`, `dim7`; `ø`, `h7`, `half-diminished`;
  `+`, `aug`; `C major`, `C dominant seventh`.
- Case is ignored except for a lone `M` or `m`: `AM7` is A major seventh,
  `Am7` and `am7` A minor seventh. Words (`maj`, `min`, `dim`, `aug`,
  `sus`, `add`, `major`, …) take any case.
- Spaces, brackets and commas are ignored (`C7(b9, #11)`), as are ordinals
  (`C 7th`).
- A slash bass is left off: `Am7/G` finds Am7 (the page has no inversions
  yet). `6/9` is a type, not a bass.
- An accidental after the root is read as the root's where that gives a
  chord: `Ab9sus` is A♭9sus4.

## Code

- `src/lib/chords/chordTypes.ts`: `ChordTypeDef` also carries tonal's
  `name` and `aliases`.
- `src/features/chords/chordSearch.ts` (pure): `normalizeType` and
  `findChord`.
- `ChordPickers.tsx`: the magnifier, the box, the miss note and the `/`
  key; `onChord` hands a found chord to the page's `pickChord`.
- `globals.css`: `.chord-type`, `.chord-search`, `.chord-search-toggle`,
  `.chord-search-miss`. The box's and the magnifier's focus outline is ink,
  not the blue ring.
