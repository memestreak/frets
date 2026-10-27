# Soundfonts

`sonivox.sf3` is the SONiVOX EAS General MIDI soundfont, copied unchanged
from alphaTab 1.8.4 (`node_modules/@coderline/alphatab/dist/soundfont/`).
It is Copyright (c) 2004-2006 Sonic Network Inc., under the Apache License,
Version 2.0 (`LICENSE`). The Tab page's playback (`src/features/tab/playback.ts`)
plays clips with it. See `NOTICE.md`.

The `piano-*.sf3` files are trial pianos (issue #124), each loaded only when
picked from the Sound list. `scripts/build-pianos.py` builds them:

- `piano-salamander-small.sf3` and `piano-salamander-large.sf3`: the
  Salamander Grand Piano by Alexander Holm, under
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), from
  https://github.com/sfzinstruments/SalamanderGrandPiano. Changed: mixed to
  mono, shortened with a fade, resampled and compressed. Small keeps velocity
  layer v11 at 32 kHz, Vorbis quality 2; large keeps v5, v11 and v16 at
  44.1 kHz, quality 4.
- `piano-fluidr3.sf3`: the piano preset of FluidR3 Mono GM (Frank Wen; mono
  version by Michael Cowgill), under the MIT licence
  (`FluidR3Mono_License.md`), from MuseScore 2.1's
  `share/sound/FluidR3Mono_GM.sf3`. Changed: only the piano kept.

    uv run --no-project scripts/build-pianos.py salamander <Samples folder> public/soundfont/piano-salamander-small.sf3 --layers 11 --quality 2 --as-program 120
    uv run --no-project scripts/build-pianos.py salamander <Samples folder> public/soundfont/piano-salamander-large.sf3 --layers 5,11,16 --quality 4 --rate 44100 --as-program 121
    uv run --no-project scripts/build-pianos.py extract FluidR3Mono_GM.sf3 public/soundfont/piano-fluidr3.sf3 --as-program 122
