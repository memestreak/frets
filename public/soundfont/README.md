# Soundfonts

`sonivox.sf3` is the SONiVOX EAS General MIDI soundfont, copied unchanged
from alphaTab 1.8.4 (`node_modules/@coderline/alphatab/dist/soundfont/`).
It is Copyright (c) 2004-2006 Sonic Network Inc., under the Apache License,
Version 2.0 (`LICENSE`). The Tab page's playback (`src/features/tab/playback.ts`)
plays clips with it. See `NOTICE.md`.

`piano-salamander.sf3` is Acoustic Grand Piano's own soundfont (issue #124), loaded only
when that sound is picked: the Salamander Grand Piano by Alexander Holm, under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), from
https://github.com/sfzinstruments/SalamanderGrandPiano. Changed: velocity layers v5, v11 and
v16 kept, mixed to mono, shortened with a fade, resampled to 44.1 kHz and compressed (Vorbis
quality 4) by `scripts/build-soundfonts.py`:

    uv run --no-project scripts/build-soundfonts.py salamander <Samples folder> public/soundfont/piano-salamander.sf3 --layers 5,11,16 --quality 4 --rate 44100

The `guitar-*.sf3` files are guitars on trial (issue #124), each loaded only when picked from the
Sound list's "Guitar trial" group:

- `guitar-iowa.sf3`: an acoustic guitar from the University of Iowa Electronic Music Studios'
  Musical Instrument Samples, as edited in tonejs-instruments
  (https://github.com/nbrosowsky/tonejs-instruments, samples
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)). Changed: shortened with a fade and
  compressed.
- `guitar-nylon.sf3`: a classical guitar by quartertone on Freesound (pack 11573), as edited in
  tonejs-instruments (CC BY 3.0). Changed: shortened with a fade and compressed; its `D5` recording
  plays D♯5, so it is used as D♯5.
- `guitar-generaluser.sf3`: the Steel Guitar preset of GeneralUser GS v2.0.3 by S. Christian Collins
  (https://github.com/mrbumpy409/GeneralUser-GS), under its own licence
  (`GeneralUser-GS-LICENSE.txt`). Changed: only that preset kept, samples compressed.

    uv run --no-project scripts/build-soundfonts.py notes <tonejs samples/guitar-acoustic> public/soundfont/guitar-iowa.sf3 --name "Acoustic Guitar" --copyright "University of Iowa Electronic Music Studios, via tonejs-instruments, CC BY 3.0" --quality 4 --rate 44100 --as-program 120
    uv run --no-project scripts/build-soundfonts.py notes <tonejs samples/guitar-nylon> public/soundfont/guitar-nylon.sf3 --name "Nylon Guitar" --copyright "quartertone (Freesound), via tonejs-instruments, CC BY 3.0" --quality 4 --rate 44100 --as-program 121 --sounds D5=Ds5
    uv run --no-project scripts/build-soundfonts.py extract GeneralUser-GS.sf2 public/soundfont/guitar-generaluser.sf3 --program 25 --as-program 122
