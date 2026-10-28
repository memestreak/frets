# Tab playback effects: distortion and reverb

Jeremy, 2026-10-28 (issue #199): "add effects to the instrument playback
sounds in the Frets tab page. We want distortion and we want reverb." Then:
"We used a plate reverb in another project of mine, fmlab. And that sounded
pretty good."

## Where the effects sit

The synthesizer (alphaTab's `AlphaSynth`) renders the clip as one stereo mix
into `WebAudioOutput` (`audioOutput.ts`). The effects are Web Audio nodes
after it, made once with the AudioContext (`EffectsChain` in `effects.ts`):

    synth → script node → Stop's fade → distortion → reverb → volume → limiter → speakers

- **On the mix, not per note:** a chord distorts as one, as a guitar does
  through an amp (#146's route (b)).
- **Stop's fade comes before the effects:** after Stop, the reverb rings on
  instead of being cut.
- **Volume comes after the effects:** turned down, a distorted sound gets
  quieter, not cleaner. Each sound's own level (`OWN_FONTS.level`) stays in
  the synthesizer, so every sound drives the distortion alike. Moving the
  volume to the output also means a turn of the knob is heard at once (the
  synthesizer renders half a second ahead), as #194 had it, now after the
  effects rather than before them.
- **The limiter** (a fast compressor at -3 dB) keeps distortion and a full
  reverb together from clipping.
- **No clicks:** every effect stays connected and is faded in or out by its
  gains over about 20 ms. A change is heard at once, even while playing.

## Distortion

- **Path:** drive gain → high-pass at 140 Hz (so chords don't turn to mud) →
  a mid push at 900 Hz, as an overdrive pedal has → a `WaveShaperNode`
  (oversampled 4x) → a high-pass at 100 Hz → the second stage's push → a
  second shaper → its level out → the Tone low-pass → a speaker cabinet made of filters (no
  deep lows, a bump at 110 Hz, a dip at 400 Hz, presence at 2.2 kHz, little
  past 6.5 kHz) → a make-up gain.
- **The curve** is a soft clip (tanh) that leans a little to one side, as a
  valve does, which adds even harmonics.
- **Drive** 0 to 1. At 0 the distortion is off and the clean sound passes.
  Above 0, it drives the first shaper from 6 dB to 46 dB, evenly in dB.
- **The second stage** (Jeremy, 2026-10-28: "more distortion effect at
  100%"), as a high-gain amp's next valve:
  - Below halfway, the sound goes into the second shaper so quietly (-20 dB)
    that it stays a straight line, and its level out undoes the push.
  - From halfway up, the push rises to +12 dB at full.
  - Measured on a decaying chord, the ring 2.5–3.5 s after the strike is
    0.2 dB under the strike at full Drive, where one stage left it 5.9 dB
    under. What one stage gave at full, two give at about 80%.
- **Loudness:** the make-up gain keeps a distorted sound about as loud as the
  clean one. Measured in Chromium on the clean electric riff, the RMS level
  is 0.093 clean, and 0.103, 0.104, 0.083 and 0.085 at Drive 30%, 60%, 80%
  and 100%.
- **Tone** 0 to 1 sets the low-pass from 1.2 kHz to 6 kHz, evenly in pitch.
- **No recorded cabinet impulse response is used**, so there is nothing to
  license.

## Reverb

- **The plate is fmlab's** (`plateReverb.ts`, copied unchanged from
  `memestreak/fmlab`): Dattorro's plate (J. Audio Eng. Soc. 45(9), 1997).
- **Baked, not run live:** fmlab runs the plate a sample at a time in a
  worklet. Frets strikes it once, records its wet ring (`plateImpulse`, at
  fmlab's default tone, 70), and plays the mix through a `ConvolverNode`.
  That runs off the main thread, and a reverb that is off costs nothing.
  What is lost is the plate's slow modulation, which is subtle in a ring.
- **Remade only when needed:** the ring is made the first time a reverb is
  wanted, and again when Decay changes. A 5 s ring takes a few milliseconds.
- **Reverb** (the amount) 0 to 1 sets the wet level, 0 to 0.45, linearly.
  The dry sound stays full.
- **Decay** is 0.3 to 5 s, starting at fmlab's 1.5 s. 0.3 s measures
  about 25% long, as the plate's diffusers ring that long themselves.
- **In mocks a and c, the Reverb knob sets the decay too** (Jeremy,
  2026-10-28: "significantly shorter on low settings"; `reverbDecay`). It
  runs from 0.3 s at the bottom, through 0.9 s halfway, to 3 s at full,
  evenly in ratio and rounded to a tenth of a second. So the ring is made
  again only every few steps of the knob. Measured on a riff, the sound lasts
  about 0.2 s past its last note at 10%, 0.5 s at 50% and 1.8 s at full.

## Controls: three mocks

They come after Sound in the playback row, before Volume at its far right. Pick one by address:

- **`?mock=a`** (the default): two knobs, **Drive** and **Reverb**, like
  Volume. A knob at 0 reads "Off" in its tip. Tone stays at 50%, and
  Reverb sets the decay as above.
- **`?mock=b`**: an **Effects** button. It is lit while either effect is on,
  and opens a small panel at the button with **Distortion** (Drive and Tone
  knobs) and **Reverb** (an Amount knob and a Decay field in seconds).
- **`?mock=c`**: an **Amp** list of presets (Clean, Crunch, Lead, High gain)
  that set Drive and Tone, and a **Reverb** knob, as in mock a. A setting no preset
  matches shows as Custom.

Once Jeremy picks a mock, the other two go.

## Saved

The settings are saved per viewer in `frets.tab.playback` as
`effects: { drive, tone, reverb, decay }`. Each field is checked on its own
(`parseEffects`). They aren't stored in the clip.

## Not done yet

- **Metronome clicks:** since #194 the clicks are notes in the same
  synthesizer, so they go through the effects too (distorted, with reverb).
  Keeping them clean would need a second synthesizer or output for the
  clicks.
- **Per-sound settings:** the effects are one setting for every sound. Piano
  through distortion is allowed.
- **Exports:** effects change only what is heard. Exports and #123's MIDI are
  unchanged.
