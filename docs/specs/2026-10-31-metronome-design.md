# Metronome page

Issue #149. A stand-alone metronome at `/metronome`, a Tool. It stays off
the home page and the menu (`sections.ts`) until Jeremy calls it ready.

Designed with Jeremy over seven rounds of mocks, 2026-10-30 to 2026-10-31
(screenshots in project files, `metronome/round-1` to `round-7`).

## Views

The same metronome can be shown four ways, chosen with a Readout | Dial |
Pendulum | Bar switch in every view's head, where a Settings gear would be.
Readout is the default. The page has no Settings dialog: there is too little
to set (Jeremy, 2026-10-31). Every view's card is the same width, so the
switch stays put when it changes the view. On a phone the switch has a line
of its own under the title.

- **Readout**, the Tuner's sibling: a pad per beat, then the tempo as a big
  number with − and + either side (1 bpm), then Start and Tap. Below a rule:
  Beats and the subdivision, then Sound and Volume.
- **Dial**: a ring of beat segments round a big tempo dial whose face
  flashes on each beat; round Start and Tap, and Beats.
- **Pendulum**: a wooden pyramid metronome whose arm swings a beat each way
  and whose weight sits lower the faster the tempo; the beats as dots to its
  right. Below them: the tempo's Italian name, Start and Tap, then Tempo,
  Beats and the subdivision, then Sound and Volume.
- **Bar**: the whole bar as tiles, one per step, a tile's height its voice.
  Pressing a tile cycles A, B, C, D, silent. Below: Start, Tap, Tempo,
  Beats, the subdivision; then Sound and Volume.

Every view:

- The beat display is at the top (Jeremy, round 6).
- The beat display keeps one size whatever the beats, so changing them never
  moves anything else (round 7):
  - Readout's pads sit in a fixed-height box: one row of pads up to 52px for
    up to 16 beats, then two rows of up to 28px.
  - Pendulum's dots sit in a box four dots wide, and more beats add rows.
  - Dial's ring and Bar's tiles share out their fixed space.
- It works up to 32 beats on a phone, with no sideways scroll. Past 16
  beats, Bar numbers every fourth beat.
- Advanced follows, the same under every view and closed at first.

## Controls

- **Tempo**, 20 to 400 bpm. Anywhere it is shown (the big number, the dial,
  the pendulum, a Tempo field), a drag up or down changes it: 5 bpm a step,
  or 1 with Shift held. A Tempo field also steps by 1 with its buttons and
  the arrow keys, and a double-click on it puts back 120.
- **Start**: a muted green (Fretwood's `--secondary`). While running it
  turns the primary colour and says Stop. Its tip is "Start (Space)" or
  "Stop (Space)".
- **Tap**: as big as Start, and a lighter green. It pulses on every press,
  and takes the press when the finger lands, not when it lifts. Two taps or
  more set the tempo, averaged over the last 8. A pause longer than one beat
  at 20 bpm starts a new run.
- **Beats**, 1 to 32. A double-click puts back 4. A new number of beats
  keeps the first beat's split and the usual steps, and drops the groups.
- **Subdivision**: Quarters, Eighths, Triplets or Sixteenths, splitting
  every beat alike. Nothing is lit when Advanced has split the beats
  differently.
- **Sound** sets every voice at once (Wood block, Beep, Cowbell, Side stick,
  Hi-hat, Clave, Kick), and plays it so it can be judged. It shows "Mixed"
  when Advanced gave the voices different sounds.
- **Volume** is a knob.
- There is no bar count or time readout (Jeremy, 2026-10-31).

There is no note value (the 4 of 4/4): bpm counts the beat, so it would
change no sound (Jeremy agreed, round 4).

## Advanced: the rhythm

Rhythm only. There are no tempo trainer, practice or setlist tools (Jeremy,
round 5).

- **Meter**:
  - Preset: Straight, Feel (shuffle, swing sixteenths, backbeat, offbeats),
    Odd and compound (3/4 to 12/8, each grouped), Clave and world, and
    Polyrhythm. A preset sets the bar and the polyrhythm's count, and keeps
    the tempo and the sounds.
  - Beats.
  - Groups, typed as "2+2+3". It sets the beats to their sum, and each
    group's first beat plays B.
  - Swing, 50 to 75%. It moves every second step of a beat split evenly.
- **Click pattern**, after REAPER's:
  - Four voices, A to D, each with its own sound, High or Low pitch, and
    level.
  - A grid with a column per step and a row per voice. A press puts that
    voice on the step, or takes it off.
  - Under each beat is its number of steps, 1 to 8. Drag it up or down, or
    use the arrow keys, and a double-click puts back 1. Under that, the
    count: 1 e & a, 1 trip let.
  - On a phone the voices' controls are a list above the grid.
- **Polyrhythm**:
  - Clicks: this many even clicks across the bar, against the beats (3
    over 4). 0 is off.
  - Its own sound and level.
  - A strip of the two layers' marks.

The usual steps are:

- A on beat one.
- B on the other beats, or C on a beat inside a group.
- C between the beats, or D when the beats are grouped.

## Timing

Web Audio. A 25 ms timer schedules every click due in the next 120 ms on
the audio clock.

- Clicks are placed in beats. A tempo change re-anchors the clock at the
  last click already scheduled, so it is heard from the next click with no
  jump.
- A change to the bar (beats, steps, the polyrhythm) starts with the next
  bar.
- A change to which voice a step plays is heard at once.

The sounds are synthesized. The wood block is Tab's metronome click
(`src/lib/click.ts`).

## Keys

- Space starts and stops (`useSpaceKey`).
- T taps the tempo, but not while typing in a field or in a dialog.

Both are listed in the `?` overlay. The head ends with the view switch,
then `?`.

## Saved

Following the settings philosophy, except that there is no Settings dialog
(`docs/specs/2026-10-29-settings-design.md`), and listed in
`src/lib/README.md`:

- `frets.metronome.works.current` holds the rhythm: the tempo, the bar, the
  voices and the polyrhythm. This is the page's work, a single one for now.
  Saved metronomes would join it under `frets.metronome.works`, with an
  index.
- `frets.metronome.display` holds `{ view }`, set by the view switch. The
  page has no Settings dialog, so this preference is set on the page alone.
- `frets.metronome.playback` holds `{ volume }`. Volume is a live control,
  set only on its knob, so it is not in Settings.

Each key has a parser that checks every field. The bar (beats, groups,
steps) is taken whole or not at all, since its parts must agree.

## Shared with Tab

The page needed Tab's number field, volume knob and click, so they moved
out of `src/features/tab/`:

- `NumberField.tsx` (now with a `dragStep` for the tempo's 5 bpm) and
  `VolumeKnob.tsx` went to `src/components/`. Their classes are now
  `.number-field` and `.knob`.
- `clickWave` went to `src/lib/click.ts`.
