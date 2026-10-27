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

`guitar-iowa.sf3` is Steel Guitar's own soundfont (issue #124), loaded only when that sound plays:
an acoustic guitar from the University of Iowa Electronic Music Studios' Musical Instrument Samples,
as edited in tonejs-instruments (https://github.com/nbrosowsky/tonejs-instruments, samples
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)). Changed: shortened with a fade and
compressed:

    uv run --no-project scripts/build-soundfonts.py notes <tonejs samples/guitar-acoustic> public/soundfont/guitar-iowa.sf3 --name "Acoustic Guitar" --copyright "University of Iowa Electronic Music Studios, via tonejs-instruments, CC BY 3.0" --quality 4 --rate 44100 --as-program 25

`guitar-electric-karoryfer.sf3` is Clean Electric Guitar's own soundfont, loaded only when that sound
plays: a clean electric guitar from Karoryfer Samples (https://www.karoryfer.com/karoryfer-samples),
as edited in tonejs-instruments (samples CC BY 3.0). Changed: compressed:

    uv run --no-project scripts/build-soundfonts.py notes <tonejs samples/guitar-electric> public/soundfont/guitar-electric-karoryfer.sf3 --name "Clean Electric Guitar" --copyright "Karoryfer Samples, via tonejs-instruments, CC BY 3.0" --quality 4 --rate 44100 --as-program 27
