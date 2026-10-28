# Tab: held and released bends

Jeremy's ask (2026-10-27, thread "Round-trip the Guitar Solo 3 excerpt"): a
Guitar Pro 8 excerpt must round-trip through the Tab page. Its first bar picks
a grace note, ties it into a note bent a full step, holds the bend over a tied
note and lets it down on another.

## alphaTex

As Guitar Pro and alphaTab write it, on one string:

    17.1.8{gr} -.1{b (0 4) v}.2 -.1{b (4 4) v}.4 -.1{b (4 0)}.8 15.1.8

- A bend on a tied note (`b (0 4)` on `-`) bends the sounding note; nothing is
  picked again.
- On a tied note after a bent one, `b (4 4)` holds the bend and `b (4 0)` lets
  it down (`bendCarries` in `clip.ts`). A note still sounding can't be bent
  before it is picked, so a tied "pre-bend" can only mean this. With no bent
  note before it, a tied `b (4 4)` stays a pre-bend.
- The release is written `b (4 0)` on a tie, not `b (4 4 0)`, so the text
  comes back as written.

## Tab

- The bend's arrow and label as before, over the first bent note.
- A hold: a dashed line at the arrow's height, on to the held note, whose
  number stays in brackets.
- A release: the dashed line, then a curved arrow down to the string. The
  note's number is not printed, as Guitar Pro prints it.
- A press on the dashed line or the arrow picks that note's bend.

## Staff

- A tied note in a bend is drawn at the pitch the bend reaches, in brackets
  (`bentSemitones`), spelled in the key with the bar's accidentals, never
  Guitar Pro's C♭ and ♮A (Jeremy's pick, option 1).
- A tie between two heads at different pitches (into the bend, out of it) is
  a straight line between them; a tie at one pitch keeps its arc.
- A picked bend keeps its head at the picked pitch. With the staff alone, the
  bend's arrow stays; a hold or release draws none, its bracketed head says it.

## Playback

alphaTab's MIDI generator plays the written text: one note on, the bend up
across the bent note, held, and let down (`heldBends.test.tsx`).

## Not in this PR

8va lines, one arc over a legato run, unbroken vibrato over the tab, and tie
arcs left off the tab in Both: the later PRs in the same plan.
