# Tab: decode the sounds off the main thread

Jeremy, 2026-10-29: "open a PR to move the sound decoding off the main
thread". Follows `2026-10-28-tab-sound-preload-design.md`.

## What was slow

When `/tab` opens, the player fetches the chosen sound's soundfont and
decodes its Ogg Vorbis samples (the `.sf3` files) so a Play finds them ready.
That decoding ran on the page's own thread, one sample per task with a pause
between. Each sample took up to about 0.1 s on a fast machine and 0.5 s on a
slow one, so a press during those seconds (opening an arrangement, typing a
fret) waited for the sample under way. The piano has about 130 samples.

## What changes

- The samples are decoded in a Web Worker (`soundDecoder.worker.ts`), with
  alphaTab's own decoder, and the decoded samples are moved (not copied) back
  into the player's synthesizer, which keeps them as if it had decoded them
  itself (alphaTab's `Hydra._sampleCache`, keyed by the sample's byte range;
  a test fails if alphaTab changes the key).
- The page side (`SoundDecoder` in `soundDecoder.ts`) starts the worker as
  the soundfont starts downloading, so the worker has loaded alphaTab by the
  time the bytes arrive. The bytes go to the worker once the synthesizer has
  read the soundfont (it keeps its own copy of the sample data).
- Where no worker can be made, or the worker fails, the samples are decoded on
  the main thread as before, one per task.
- Nothing else changes: a Play before the sound is ready still waits for it,
  showing the spinner; the sound plays exactly as before.

## Measured

A production build in headless Chromium, the median of three page loads per
sound, counted from the moment the soundfont arrived until three seconds with
no long task (over 50 ms) on the main thread.

| Sound, CPU | Main thread blocked, before → after | Longest task | Worst delay to a timer |
| --- | --- | --- | --- |
| Steel Guitar, 1× | 215 ms → 0 | 100 ms → none | 163 ms → 3 ms |
| Piano, 1× | 365 ms → 0 | 93 ms → none | 189 ms → 14 ms |
| Clean Electric, 1× | 176 ms → 0 | 86 ms → none | 163 ms → 5 ms |
| Steel Guitar, 4× slower | 5.9 s → 0 | 467 ms → none | 679 ms → 23 ms |
| Piano, 4× slower | 18.9 s → 0 | 434 ms → none | 1058 ms → 80 ms |
| Clean Electric, 4× slower | 6.6 s → 0 | 480 ms → none | 883 ms → 43 ms |

"Blocked" is the time past 50 ms in each long task, summed (Lighthouse's
total blocking time). The worst delay is how late a 16 ms timer fired, which
is about how long a press would have waited.

The time until the sound is ready is about the same or a little longer: one
worker decodes no faster than the main thread did, and it loads alphaTab
first. A Play pressed 0.3 s after the soundfont arrived started after:

| Sound | Before | After |
| --- | --- | --- |
| Steel Guitar | 1.3 s | 1.4 s |
| Piano | 4.6 to 4.9 s | 5.0 to 5.3 s |
| Clean Electric | 1.6 s | 1.9 to 2.2 s |

With the sound ready, Play starts in about 0.2 s, before and after.

The sound is the same to the sample: a short clip played in each of the three
sounds, recorded from the audio node, gives the same samples before and after.

## Build notes

Turbopack bundles the worker from
`new Worker(new URL('./soundDecoder.worker.ts', import.meta.url))`. It also
copies the worker's source into `out/_next/static/media/`, unused; `out` is
excluded from `tsconfig.json`, since a later build's type check would
otherwise read that copy. The worker must not import `soundDecoder.ts` (the
module that makes it): a worker importing itself made the build hang.

When the worker imports alphaTab, alphaTab starts its own worker code, which
reads every message's `cmd` and throws on a message without one; the
decoder's messages carry `cmd: 'frets.decodeSoundFont'`, which it ignores.

## Not done

- Decoding the piano in several workers at once would make it ready sooner
  (each sample decodes on its own); not done, since the page no longer waits
  on it.
- At the first Play the synthesizer still decodes, on the main thread,
  SONiVOX's samples for the program played (about 0.1 s), though the sound's
  own soundfont is what is heard. Dropping SONiVOX, offered after #170, would
  remove that.
