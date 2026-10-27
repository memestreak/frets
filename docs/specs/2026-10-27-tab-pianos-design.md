# A better piano for Tab playback

Issue #124. Jeremy, 2026-10-27: "a piano that isn't embarrassing. Is this practical?", then "let's
try out a few pianos". SONiVOX's piano is 11 short looped samples in 46 KB of a 977 KB General
MIDI font; this trial puts three better pianos beside it so he can listen and pick one.

## The trial

- The Sound list gets a "Piano trial" group after Piano: Piano A, B and C, each naming its source
  and size. Acoustic Grand Piano stays SONiVOX's, for comparison.
- Each trial piano is a soundfont of its own, fetched the first time it is picked (the Play button
  says Loading meanwhile) and kept for the rest of the visit. Nothing else loads more.
- Each plays as a program the list doesn't otherwise offer (120 to 122), so it shadows no other
  sound, and at about SONiVOX's loudness (a level per piano, from rendering one passage with each).

| | Source | Size | First load |
|---|---|---|---|
| A | Salamander Grand, one velocity layer, 32 kHz | 1.1 MB | about 1 s |
| B | Salamander Grand, three velocity layers, 44.1 kHz, higher quality | 3.9 MB | about 3.5 s |
| C | FluidR3 Mono's piano | 0.5 MB | about 0.5 s |

The first load is alphaTab decoding every sample, on the page's own thread: the page doesn't
respond meanwhile.

## The soundfonts

alphaTab's synthesizer reads SF2 and SF3 but plays mono samples only, so `scripts/build-pianos.py`
writes a one-preset SF3 of mono Ogg Vorbis samples. From the Salamander Grand's FLACs (one every
minor third, A0 to C8) it mixes each sample to mono, keeps ten seconds at A0 down to three by C7 with
a fade, and spreads each over the keys either side; a release of 0.35 s stands in for the damper. From
FluidR3 Mono it copies the piano preset with only its instruments and samples.

## After the trial

The piano he picks replaces program 0 (Acoustic Grand Piano), loaded when that sound is picked; the
others, the "Piano trial" group and the level table go. Other instruments can follow the same way.
