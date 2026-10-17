# Move the shape along the neck

On the Chords page, the ‹ › buttons under the neck slide the shape on it a
fret down or up, instead of stepping through the chord's shapes. The ← →
keys still step through the shapes. Asked for by Jeremy on 2026-10-17; the
details below are the defaults picked, since the ask left them open.

## Behaviour

- **‹** moves every sounding string a fret toward the nut, **›** a fret
  away from it. Open strings move too, so they become fretted, as under a
  barre: Am7 `x-0-2-0-1-0` a fret up is `x-1-3-1-2-1`.
- The chord moves with the shape: Am7 a fret up is B♭m7, keeping the type
  and the reading chosen in Name it. Roots are spelled as the Root picker
  spells them (D♭, E♭, F♯, A♭, B♭). The pickers, title, shapes and URL
  follow, and the URL is replaced, not pushed, as for a chosen shape.
  Notes with no chord name are named afresh.
- ‹ is disabled when a string is open (nothing can go below the nut), ›
  when a string is at fret 15, the last on the neck; both with nothing
  played.
- The neck scrolls to the moved shape, as for a chosen shape.
- The Arpeggio stays as it is: with it on, ‹ › walk the chord's arpeggio
  through the keys.
- The caption is unchanged: the shape's place among the new chord's
  shapes ("Moveable 2 of 9 · …"), or "Your shape · …".
- The buttons keep their size and place; their names are "Move shape down
  a fret" and "Move shape up a fret".
- ← → step through the shapes as before; one pressed after a click on ‹
  or › takes focus off the button, so no focus ring is drawn there.

## Code

- `moveShape(voicing, by, maxFret)` in `src/lib/chords/voicings.ts`: the
  moved frets, or null when they would leave the neck.
- `VoicingStepper` takes `canMoveDown`, `canMoveUp` and `onMove`;
  `ChordsPage` moves the frets and keeps the transposed chord.
