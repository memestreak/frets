# Tab page: standard notation (issue #122)

The Tab page draws a treble staff over the tab, under it, or alone. The design
answers are Jeremy's, 2026-10-27, one question at a time.

## What is shown

- The views are **Notation | ASCII Tab | AlphaTex**. In Notation a second
  switch, **Staff | Tab | Both**, chooses the parts. The choice is the
  viewer's, saved in `frets.tab.parts` (Tab by default), and is not part of the
  clip.
- The staff is a plain treble clef. Guitar is written an octave above how it
  sounds; as in most guitar books, the clef has no 8 under it to say so
  (Jeremy dropped it, 2026-10-27).
- In **Both** the staff carries the rhythm (stems, flags, beams, rests, dots,
  tuplet numbers, ties) and the tab drops its own stems. **Tab** alone is drawn
  as before.
- With the staff shown, the time signatures (the first line's and every
  change) are drawn on the staff only, and pressed there. As in printed music,
  the first comes after the clef and the key signature, and a change inside a
  bar comes after that bar's key change. The tab lines up under the staff.
- In Both, a square bracket in front (Bravura's, its ends curling over the
  lines; Jeremy preferred it to a curly brace) and the opening line drawn
  through both join the staff and the tab as one part.
- Export (PNG, SVG, copy), the playhead and the loop follow the parts shown.

## Pitch and spelling

- A note's pitch is its open string, the capo and its fret. The tuning names
  have no octave; each string takes the octave nearest standard tuning's.
- The key signature comes from alphaTex `\ks` (`\ks G`, `\ks Bb`, `\ks Eminor`)
  and may change at any bar. No `\ks` is C major.
- Spelling in a key: a note of the key as the key spells it; in a minor key the
  raised seventh on the seventh's letter (G♯ in A minor); any other white key
  natural; any other black key sharp in sharp keys and C, flat in flat keys.
- An accidental holds to the end of its bar on its line or space. A tied note
  shows none. A chord's accidentals stand in lanes so they don't overlap.
- A dead note is an × on its open string's place.

## Setting the key

Like the time signature: a press on a drawn key signature, or the Bars
palette's ♯♭ button, opens a panel over the clip with the key from that bar on.
Major | Minor keeps the signature (G major becomes E minor). Bars after the
first have "Remove the change". A change that starts a line is drawn once, as
that line's own key signature.

The key is picked on the shared piano `KeyPicker` (Jeremy chose it over a
circle of fifths and a grid of drawn signatures): each tile names the key a
signature can write, so D♯ major is written E♭ major.

## Editing

Editing is through the tab. In Both the cursor and selection bands span the
staff and the tab, and a press on a note head on the staff puts the cursor on
its tab note. Staff alone is read-only (the palette is off).

Next, in its own PR: entering pitches on the staff (press a line or space,
step a semitone up or down, Frets picks the string and fret).

## Technique marks on the staff

Placed as printed guitar music places them (`staffMarks.ts`; Jeremy asked to
finish #122 with them, 2026-10-27):

- **At the heads:** accents (> and ^) and staccato dots, on the side away from
  the stem (over a whole note). Inside the staff a dot sits in a space.
- **Over the staff:** a vibrato's wave, clear of the heads and an upward stem.
- **On the stem:** tremolo slashes, one per beam of the speed; over a whole note.
- **Between heads:** a slur for a hammer-on, pull-off or legato slide, away
  from the stem; a straight line for a slide; ties as before. Slides into a
  note from below or above, and out of it, are short lines.
- **Heads:** a natural harmonic is a diamond, a dead note an ×, a ghost note's
  head is in brackets.
- **Between the staff and the tab** (under the staff alone): pick strokes,
  P.M. and let ring runs, P.H.
- **On the tab only, under a staff:** bends, taps and the tab's own H and P,
  slides and ties. With the staff alone, bends (arrow and amount) and taps (T)
  go on the staff.

In Both, accents, staccato and vibrato are drawn on the staff only, not over
the tab too. A press on a mark on the staff picks it as one on the tab does
(outline, Delete, its palette tool lit); a press on a head is still the note.
