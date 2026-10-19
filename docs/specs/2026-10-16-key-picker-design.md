# Key picker

The Scale lab and the Chords page picked their root from a dropdown. Both
now pick it from a row of tiles laid out like a piano's keys, beside the
Scale or Type dropdown that stays as it was.

## What it looks like

Twelve columns, one per pitch class, C to B. A natural is one full-height
tile; between the naturals, each sharp sits over its flat as two half-height
tiles (C♯ over D♭). That is seventeen tiles, the Scale lab's seventeen roots
in their order.

- The picked tile shows by colour alone (`--primary` on `--on-primary`);
  every tile keeps its size, so nothing moves when the pick changes.
- The sharps and flats are a shade darker than the naturals
  (`docs/specs/2026-10-19-key-picker-two-tone-design.md`).
- The row is 336px wide, narrowing with the page on a phone, where it wraps
  onto a line of its own above the dropdown.
- A visible "Root" label sits above the tiles on both pages
  (`docs/specs/2026-10-19-scale-lab-header-design.md`,
  `docs/specs/2026-10-19-chords-header-design.md`). The group is labelled
  Root for assistive technology.

Three versions were mocked (a full-width row under the title, a button that
opens the keyboard, and this compact inline row); Jeremy picked the inline
row on 2026-10-16.

## Behaviour

- A radio group: one tab stop, on the picked tile. The arrow keys move
  through the tiles in reading order (C, C♯, D♭, D, …), wrapping at the ends,
  and pick as they go, as native radios do.
- Scale lab: a tile picks that root, exactly as the dropdown did.
- Chords page: chord roots have one spelling each (C D♭ D E♭ E F F♯ G A♭ A
  B♭ B). A tile the chords spell the other way picks its enharmonic: C♯ picks
  D♭, G♭ picks F♯, and the D♭ tile is the one marked (`resolve`). The arrow
  keys skip a tile that would pick the root already picked, and focus
  follows the marked tile.
- The Circle of fifths is unchanged: its key is picked on the wheel.

## Code

`src/components/KeyPicker.tsx` (shared by Explore and Chords), styled by
`.key-picker`, `.key-col` and `.key-tile` in `globals.css`. `ScalePickers`
and `ChordPickers` place it where their Root dropdowns were.
