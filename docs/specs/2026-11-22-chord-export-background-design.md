# Chord export: a Background choice, a bigger fret number and ×

Asked 2026-11-22 (Jeremy): "The export option "Transparent" that allows
on/off, should be renamed to "Background" with the options being white and
transparent. Also, I like the fret number bigger and a little closer to the
diagram. I'd like the X for unused strings a little larger as well."

This changes the Export dialog of
`docs/specs/2026-10-15-copy-chord-diagram-design.md` and
`docs/specs/2026-10-17-export-size-design.md` (used by the Chords page, the
Scale lab and Tab's chords, `docs/specs/2026-11-21-tab-chord-export-design.md`),
and the small diagram of
`docs/specs/2026-10-16-chord-diagram-fret-label-design.md`. Those specs
now say what is true here.

## What changes

| | Before | After |
|---|---|---|
| Export dialog row | **Transparent**: On, Off | **Background**: White, Transparent |
| Starting fret number | 9 units, baseline 22 under the board | 12 units, baseline 19 under the board |
| × on a muted string | 15 units | 18 units, as big as the neck's |
| Band under the board | 28 units | 23 units |

- Background's default is still Transparent. The saved field in
  `frets.chords.export` stays `transparent` (true for Transparent); only the
  label and the options change, as the Tab export dialog's Background does.
- The number's top clears a dot on the low string (8.5 units under it) by
  about 2 units, so it sits closer to the board than before without
  touching a dot in its column.
- `ChordDiagram` draws every small diagram, so the number and × change on
  the Chords page, the Scale lab's cards, Tab's Chord set and chord editor,
  and in every export, alike. Tab's diagrams under chord names and in the
  Chord chart are drawn by Tab's own grid and don't change.
- The shorter band makes each diagram 5 units shorter: at 300 px wide an
  image with the name is 300 × 302 px (was 312); with no name, 249 (was 259).

## Tests

- The dialog's Background row offers White and Transparent, Transparent
  pressed by default; picking White saves `transparent: false` and the line
  under the preview says "on white".
- `diagramSvg` at 300 px: `viewBox="0 0 148 149"`, `height="302"`; with no
  name `148 123`, `249`; 150 / 225 / 450 / 600 px give heights 151 / 227 /
  453 / 604.
- `ChordDiagram`: the fret number is at font size 12, its baseline 19 under
  the low string; × is at font size 18.
