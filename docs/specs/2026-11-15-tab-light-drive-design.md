# Tab distortion: light drive

Jeremy, 2026-11-15 ([issue:frets#506](https://github.com/memestreak/frets/issues/506)):
"I like our distortion sound but I wanted to have more range on the lower
end. I like the ability to add harmonics to a basically clean sound."

The distortion itself is `docs/specs/2026-10-28-tab-playback-effects-design.md`;
this spec is what changed at Drive's low end.

## Before

Drive drove the first shaper from 6 dB at its lowest. On a sine at the
clean riff's level (RMS 0.09) that is already 6.7% distortion, and the amp's
filters (lows cut at 140 Hz, the 900 Hz push, the cabinet) were all on, so
the step from Drive 0 to 1% was a jump from clean to crunch.

## Now

- **Drive's range** is -12 dB to 46 dB into the first shaper, evenly in dB.
  The old range, 6 to 46 dB, is the knob's top 69%: from about 31% up,
  Drive sounds as it did from its lowest to full.
- **Light drive** is the knob below 31%. Measured in Chromium on a 220 Hz
  sine at RMS 0.09 (`EffectsChain` in an `OfflineAudioContext`):

  | Drive | Into the shaper | Distortion | 2nd harmonic | 3rd harmonic |
  |---|---|---|---|---|
  | 1% | -11 dB | 1.3% | -38 dB | -66 dB |
  | 10% | -6 dB | 2.1% | -34 dB | -56 dB |
  | 20% | 0 dB | 3.7% | -29 dB | -44 dB |
  | 31% | 6 dB | 6.7% | -25 dB | -30 dB |

  The curve's lean makes the second harmonic lead, which is the warm edge of
  a valve amp starting to break up.
- **The amp's colour fades in with Drive** (mock a): every filter around the
  shapers, the Tone low-pass and the cabinet are flat at the lowest Drive
  (high-passes at 20 Hz, low-passes at 20 kHz, boosts and dips at 0 dB) and
  move evenly in pitch and dB to their full settings at 31%. So Drive 1% is
  the clean sound with a trace of harmonics, not the cabinet's, and turning
  Drive up from 0 has no jump. Tone does less the lower Drive is, and
  nothing at its lowest.
- **Loudness:** at the lowest Drive the shaper is nearly a straight line, so
  the make-up gain undoes the drive (1 / (gain × the curve's slope)); from
  31% up it is the old make-up; between, the two meet evenly in dB. Measured
  as above, the level stays within 1 dB of the clean sound from 0% to 31%.
- **The second stage** keys off the distorted range, so it still starts at
  the old halfway, now about 66%.
- **The default Drive** is 66%, the sound of the old 50%. The built-in
  samples' Drive values moved the same way (0.87 → 0.91, 0.5 → 0.66), so
  they sound as they did.

## Mocks (until Jeremy picks)

- **a** (also with no mock): the amp's colour fades in with Drive, as above.
- **b** (`?mock=b`): the amp's colour is at full from the lowest Drive, as
  before; only the drive into the shaper reaches lower. Its make-up stays the
  old one stretched down, as the cabinet's bumps make up the rest.

The sample `samples/light-drive.atex` (`/tab#example=light-drive`) has a
clean electric riff at Drive 5% with numbered steps to try.

## Tests

- Drive's gain is -12 dB at 0, 17 dB at 50% and 46 dB at full; 6 dB is at
  about 31% and 26 dB at about 66%.
- At the lowest Drive, gain × the curve's slope × make-up is 1; at 31% the
  make-up is the old 0.19, at full 0.19 / 2.2; it falls all the way, by no
  more than 1.5 dB a percent.
- The amp's colour is 0 at the lowest Drive, half at -3 dB, full at 31% and
  above.
- The second stage leaves the sound alone up to 66% and pushes 12 dB at
  full.
- The default FX line writes `drive=0.66`.
