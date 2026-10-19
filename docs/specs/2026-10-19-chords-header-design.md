# Chords page header

The Chords page's root picker, Type dropdown and Clear floated to the right
of the title, centred on it, with an inline Type label and no Root label.
They now follow the Scale lab's header
(`2026-10-19-scale-lab-header-design.md`): labelled from the top, the
labels level with the title's top.

## Layout

- Left: the chord's name and formula, the spelled notes under them.
- Right, top-aligned with the title: **Root** over the key picker, and
  **Type** over the dropdown (or the search box), the magnifier and Clear.
  The tops of the picker and the dropdown are level, and each label sits
  the usual 6px above its control.
- When the two don't fit on one line, the controls wrap under the notes,
  Type under Root on a phone. The labels show on phones too (Type was
  visually hidden there before).
- Nothing moves when the chord, the search box or the notes change: the
  search box has the dropdown's width and the notes line keeps its height
  when empty.

The visible "Root" label is not tied to the picker for assistive
technology, which already names itself Root. "Type" is the dropdown's (or
the search box's) `<label>`; the search box keeps its own name, Chord name.

## Choice

Five layouts were mocked behind `?mock=` (today's; this one; a row under
the title; a row above it; the controls in the notes' row, as in the Scale
lab). Jeremy picked this one on 2026-10-19.

## Implementation

`ChordHeader` lays the header out; `ChordPickers` draws the two labelled
fields and takes the page's Clear as `after`, so it sits in Type's row.
