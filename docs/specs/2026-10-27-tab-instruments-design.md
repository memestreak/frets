# Better instruments for Tab playback

Issue #124. Jeremy, 2026-10-27: "a piano that isn't embarrassing. Is this practical?", then "let's
try out a few pianos". SONiVOX's piano was 11 short looped samples, 46 KB of a 977 KB General MIDI
font.

## The trial

Three pianos sat in a "Piano trial" group of the Sound list, each loaded when picked:

| | Source | Size | First load |
|---|---|---|---|
| A | Salamander Grand, one velocity layer, 32 kHz | 1.1 MB | about 1 s |
| B | Salamander Grand, three velocity layers, 44.1 kHz, higher quality | 3.9 MB | about 3.5 s |
| C | FluidR3 Mono's piano | 0.5 MB | about 0.5 s |

He picked B ("lets use piano B").

## The piano

- Acoustic Grand Piano (program 0) is now the Salamander Grand, B above. Its soundfont is fetched
  the first time that sound plays or is picked (Play says Loading meanwhile) and kept for the visit;
  it wins over SONiVOX's piano. No other sound loads more.
- It plays at about SONiVOX's loudness: a level for it, from rendering one passage with each.
- Its first load is alphaTab decoding every sample on the page's own thread, a few seconds in which
  the page doesn't respond.
- `OWN_FONTS` in `playback.ts` lists the sounds with a soundfont of their own, so other instruments
  can follow the same way.

## The soundfont

alphaTab's synthesizer reads SF2 and SF3 but plays mono samples only, so `scripts/build-soundfonts.py`
writes a one-preset SF3 of mono Ogg Vorbis samples. From the Salamander Grand's FLACs (one every
minor third, A0 to C8) it keeps velocity layers v5, v11 and v16, mixes each sample to mono, keeps ten
seconds at A0 down to three by C7 with a fade, and spreads each over the keys either side; a release
of 0.35 s stands in for the damper. alphaTab's reader skips no RIFF pad byte, so the sample data is
padded to an even size. The script can also copy one preset out of another SF3 (`extract`).

## Guitars on trial

Jeremy, 2026-10-27: "Let's do the same thing with a guitar instrument." Steel Guitar is the default
sound, and SONiVOX's, like every General MIDI font's, is a few short looped samples. Three guitars sit
in a "Guitar trial" group after Guitar (programs 120 to 122), each loaded when picked and brought to
about SONiVOX's Steel Guitar loudness:

| | Source | Size |
|---|---|---|
| A | An acoustic guitar from the University of Iowa's instrument samples, a recording per semitone E2 to D5, ringing out | 1.5 MB |
| B | A classical guitar from Freesound (quartertone), most semitones B1 to A♯5, ringing out | 0.7 MB |
| C | GeneralUser GS's Steel Guitar: ten short looped samples, as General MIDI fonts have | 0.1 MB |

A and B come from tonejs-instruments, which edited them (trimmed, normalised, pitch-corrected); a
pitch check of every recording found them within about 10 cents but for B's `D5`, which plays D♯5 and
is used as D♯5. He picked A ("Guitar A please"): Steel Guitar (program 25), the default sound, is now the Iowa
acoustic guitar, its own soundfont loaded the first time it plays (about 1.5 s), at about SONiVOX's
level. B, C and the trial group went.
