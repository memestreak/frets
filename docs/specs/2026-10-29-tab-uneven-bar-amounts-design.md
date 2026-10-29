# Tab: how far a bar is off

Jeremy, 2026-10-29: a bar that doesn't add up says by how much it is short
or over, as in "Bar 1 doesn't add up to 4/4: 1 beat and a 32nd short."

## The amount (his pick: beats, then note values)

`timeInWords` in `clip.ts` says a length of time the way a guitarist counts
it in a bar:

1. Whole beats first: "1 beat", "2 beats". A beat is the time signature's
   bottom number, so in 6/8 a beat is an 8th and in 2/2 a half.
2. What's left, less than a beat, as the fewest plain notes, dotted and
   double-dotted ones allowed (the same `fewestRests` that fills a bar):
   "a dotted 8th", "an 8th and a 32nd".
3. Else, when what's left is one triplet note: "an 8th triplet",
   "a quarter triplet".
4. Else, a fraction of a beat in lowest terms, one glyph where there is one:
   "⅕ of a beat", "1/7 of a beat", "11/24 of a beat".

The parts are joined like any list ("1 beat and a 32nd"), then "short" or
"over".

## Where it shows

- **The ⚠ tip under the bar** (`barErrors`): "Bar 1 doesn't add up to 4/4:
  1 beat and a 32nd short." A broken tuplet's sentence follows, as before.
- **The line under the clip and the import warnings** (`unevenMessage`, his
  pick: one clause per bar): "Bar 2 doesn't add up to 4/4: 1 beat short;
  bar 3: 1 beat short; bar 5 doesn't add up to 3/4: a 16th over." A bar in
  the same time signature as the bar named before it leaves the time
  signature out.

An emptied bar is "4 beats short" in 4/4. A clip with nothing in it yet
still says nothing.
