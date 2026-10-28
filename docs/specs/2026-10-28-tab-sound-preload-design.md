# Tab: load the sound before Play

Jeremy, 2026-10-28: "is there a way to prevent the instrument from having to
load every time? Ideally, we would only have to reload an instrument if it
changed."

## What was slow

Within a visit, a sound already loaded once and was kept. The wait came on
each page load, at the first Play: alphaTab decodes a sound's samples (Ogg
Vorbis, in the `.sf3` files) the first time a clip uses it, on the page's own
thread, in one block. Measured in Chromium: Steel Guitar (the Iowa soundfont)
about 1.5 to 2.4 s, Acoustic Grand Piano (Salamander) about 4 to 5 s, Clean
Electric Guitar about 0.6 s; a SONiVOX sound about 0.1 s. The page could not
respond meanwhile.

## What changes

- When `/tab` opens, and whenever Sound changes, the player is made and the
  chosen sound's own soundfont is fetched and decoded in the background, one
  sample at a time with a pause between, so the page stays responsive
  throughout (no task over about 0.1 s).
- Nothing shows while it loads. A Play (or a heard note) before it is ready
  shows the spinner until it is, as before; it never starts a second load.
- With the sound ready, Play starts in about 0.3 s (the clip's MIDI and
  SONiVOX's share of the sound), where it took 2 to 5 s.
- The AudioContext is made on the first Play rather than with the player,
  since a browser only lets one start after a press. It runs at 44.1 kHz,
  the rate the synthesizer renders at (alphaTab reads the rate before the
  output opens, so it was always 44.1 kHz; a context at the device's own rate,
  often 48 kHz, would have played sharp and fast).

## Not done

- The decoded samples are not kept between page loads: they are many times
  the soundfont's size (the piano's 3.9 MB decode to about 100 MB of
  samples). The soundfont files themselves come from the browser's cache.
- Only the chosen sound loads; the others still load when picked, in the
  background the same way.
