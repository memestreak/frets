# Tab chord rolls in playback

Issue: [issue:frets#385](https://github.com/memestreak/frets/issues/385).

Jeremy, 2026-11-06: "do we have the ability/freedom to play back sd/su with the
same type of effect used for the bd/bu — but maybe slightly more subtle?", and
"this behavior and the 'amount' of strum should be configurable — for each of
sd/su bd/bu and ad/au". The amount is "a fraction of the beat for now".

## What it does

A chord (two or more notes) marked **Downstroke** or **Upstroke** (⊓ / V,
alphaTex `sd` / `su`) plays as a slight strum: low string first for a
Downstroke, high string first for an Upstroke. A single note with a stroke
plays as before. Dorico, MuseScore and Guitar Pro 8 play ⊓ / V unrolled; this
is Frets' own choice.

A **Strum down or up** (`bd` / `bu`) and a **Rolled chord** (`ad` / `au`)
already rolled (alphaTab's player); their length now comes from the settings
too. On a chord with a stroke and a Strum (`{sd bd}`) the Strum sets the roll.

A length written in the clip (`{bd 60}`, `{ad 400}`, in alphaTab's ticks, 960
to a quarter) wins over the setting for that chord, whether its kind is on or
off.

## Settings

Tab › Playback (`frets.tab.playback`). Each kind is a box, drawn and named
(Jeremy, 2026-11-06: "put each toggle+value box in its own box … such that
it's clear that each of the 3 pairs belong together"), holding its checkbox and
its length:

| Box | Row | Field | Default |
| --- | --- | --- | --- |
| Downstroke and Upstroke | Strum the chord | `strokes` | on |
| | Length | `strokesRoll` | 3% |
| Strum down and up | Strum the chord | `strums` | on |
| | Length | `strumsRoll` | 5% |
| Rolled chord | Roll the chord | `rolledChords` | on |
| | Length | `rolledChordsRoll` | 20% |

A Settings field names its box with `box`; neighbouring fields with the same
name are drawn in one box, its name on its top line like a fieldset's legend,
their rows keeping the pane's columns.

A length is how long the whole roll takes, first note to last, as a
percentage of the chord's own written length (0.5–100%, steps of 0.5). So a
3% Downstroke on a quarter note at 120 bpm spreads its strings over 15 ms, and
on a half note over 30 ms. The length is greyed while its checkbox is off.
Off, that kind plays its notes at once. Speed scales the roll with the music.

The defaults put a Strum and a Rolled chord near alphaTab's own (it rolls a
Strum over a quarter of the chord's length and a Rolled chord over all of it,
each divided by the number of notes), and a Downstroke a little under a Strum.

The settings apply wherever the Tab page plays: Play, and a chord
heard from the Chords panel (it plays the shape with a Downstroke). The
`show_tab` MCP App has no Settings and plays the defaults.

## How

`rolls.ts` holds `Rolls` (each kind's length as a share of the chord, 0 for at
once) and `rollChords`, which `perform()` (`playback.ts`) calls on alphaTab's
score before it becomes MIDI, as it does for tremolo picking. For each beat:
a Strum or Rolled chord gets `brushDuration` from its setting; a stroke on a
chord with no Strum or Rolled chord gets `brushType` BrushDown / BrushUp and
its `brushDuration`. A written length is found in the Column's kept effects
(`extra`, e.g. `"bd 60"`), so it is left alone. `rollsOf` turns the settings
into `Rolls`; `TabPlayer.setRolls` makes the MIDI again when they change, a
clip playing going on from where it is.

## Tests

`src/__tests__/tab/rolls.test.ts`:

- A Downstroke chord rolls low to high and an Upstroke high to low, over its
  share of the chord (3% by default; 25% of a quarter is 240 ticks, of a half
  480).
- A single note with a stroke is unchanged; a chord with no mark plays at once
  whatever the settings.
- Each kind off plays its chord at once; each kind's length changes only its
  own kind; a Strum on a stroked chord sets the roll.
- A written `bd` / `ad` length wins over the setting, on or off.
- A chord in another Voice of the bar rolls too.
- Settings: each kind's checkbox and Length are in a group named for the
  kind; unticking one greys only its own Length, and OK saves it
  (`src/__tests__/tab/settings.test.tsx`).
- `rollsOf` and the parser: defaults, off as 0, and bad lengths (0, negative,
  over 100, off the 0.5 step, not a number) rejected.
