# Scale lab header

The Scale lab's root picker and Scale dropdown floated to the right of the
title, centred on the name and formula, and lined up with neither the title
nor the scale strip under it. They now sit in the strip's row, labelled from
the top.

## Layout

On a screen 1180px wide or more, the header is a grid of two rows:

```
Name and formula    (space)   Root label    Scale label
Scale strip         (space)   Root picker   Scale dropdown, Reset
```

- The strip is 480px wide (it was up to 560px), so the pickers fit beside
  it. The empty column between pushes the pickers to the page's right edge.
- The Root picker is centred on the strip's note tiles. The Scale
  dropdown's top lines up with the picker's top.
- "Root" and "Scale" end the title's row and sit 6px above their controls,
  the usual field-label gap.
- Reset stays beside the dropdown, holding its place while hidden, so a
  rotation moves nothing.

Narrower, one column: name and formula, Root label and picker, Scale label
and dropdown, then the strip. The labels show on phones too (they were
visually hidden there before).

The visible "Root" label is the Scale lab's alone; the Chords page's key
picker still has none. It is not tied to the picker for assistive
technology, which already names itself Root.

## Choice

Five layouts were mocked behind `?mock=` (today's; pickers side by side
beside a narrower strip; Root over Scale in a column; the pickers on a row
under the title; the same row above it). Jeremy picked the side-by-side one
on 2026-10-19, asked for the pickers to line up with the strip's notes
rather than the title, then for the dropdown's top to match the picker's
and the labels to come closer.

## Implementation

`ScalePickers` returns four grid cells (each label apart from its control);
`ScaleLab`'s `<header className="scale-head">` places them with the title
and strip. The `.scale-head` rules in `globals.css` hold both layouts. The
picker's 9px drop is fixed by the 480px strip: its tiles' centre is 35px
down it, and the picker is 52px tall.
