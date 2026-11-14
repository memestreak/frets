# Tab metronome: the Metronome page's sounds, subdivisions and beats

Issue #477. Extends `2026-10-28-tab-metronome-design.md` (the toggle, the
count-in, the click volume) with what the Metronome page
(`2026-10-31-metronome-design.md`) has that fits a metronome playing along
with an arrangement. The design questions and their answers are in the
questions artifact linked from #477.

## What stays with the arrangement

The tempo, the beats and Tap belong to the arrangement on Tab: its tempo
marks and time signatures set them, and Speed scales the tempo. So the
Metronome page's Tempo, Beats, Tap and presets have no place here.

## Left out

- **Swing**: Tab plays the notes straight, and swung clicks would fight
  them. It can come once Tab has a swing feel.
- **Polyrhythm**: a layer of its own against whatever the arrangement plays
  is a niche.
- **A beat display**: the playhead on the tab already shows the beat, and
  the footer stays quiet.
- **Per-voice sounds and pitches** (the page's A to D grid): one Sound for
  every click, as Dorico, MuseScore and Guitar Pro have.

## Sound

- One Sound for every click, from the Metronome page's seven: Wood block
  (the default and the click Tab had), Beep, Cowbell, Side stick, Hi-hat,
  Clave, Kick.
- Beat one plays the sound's high click; every other click its low one.
- A sound picked is heard once at once, so it can be judged, as on the
  Metronome page: at the click volume (and the Volume knob) in the menu, at
  full level in Settings.
- The count-in plays the same sound.

## Beat groups

- Bars over 8 or shorter (6/8, 7/8, 5/16…) click every eighth (or
  sixteenth), as before, and now follow the bar's Beat groups: each group's
  first click after beat one is struck harder. 7/8 as 2+2+3 stands out on
  the 1, 3 and 5; with `\beaming (8 3 2 2)` on the 1, 4 and 6. 6/8 is as
  before (the 1 and the 4). 3/8 has one group, so only the 1 stands out.
- Quarter and half bars click each beat with no group accents, as before.

## Subdivide

- Off (the default), Eighths, Triplets or Sixteenths: a click on each
  eighth, triplet eighth or sixteenth between the beats, at the
  Subdivisions volume.
- A beat is split only into a whole number of them: a half-note beat (2/2)
  takes four eighths, six triplets or eight sixteenths; an eighth-note
  beat (6/8, 7/8) only takes sixteenths (two), since it already clicks
  every eighth; a sixteenth-note beat takes none.
- The count-in is subdivided the same.

## Click on

- Every beat (the default), Backbeat, or Beat one.
- Backbeat: every second beat (2 and 4; in 3/4 the 2); in a bar with Beat
  group accents, each group's start after the first (7/8 as 2+2+3: the 3
  and the 5). Beat one: only the 1.
- A silent beat has no subdivisions either.
- The count-in clicks every beat whatever this says, so the count is
  always plain to follow.

## Volumes

- Click volume (0–100 %, 80 % at first) still sets every click, under the
  Volume knob.
- Under it, three knobs: Beat one (100 %), Beats (100 %; a group's start is
  struck a little harder than the other beats, as before) and Subdivisions
  (60 %). A knob at 0 leaves those clicks out. A double-click on a knob puts
  back 100 %, as on every knob in Frets.

## Where the controls are

- A right-click on the footer's Metronome opens the **Metronome dialog**, a
  modal dialog as REAPER's metronome settings are (Jeremy, 2026-11-14). It
  replaces the small right-click menu the metronome had, and the footer
  gains nothing. The toggle's tip says "Right-click for its settings".
- The dialog shows exactly Settings › Metronome's fields, in the same rows:
  - Metronome (the toggle's own on and off).
  - Count in, with its bars (1 to 4) on the same line, greyed out while
    Count in is off (Jeremy, 2026-11-14): ☑ 2 bars. The bars are a compact
    number field, a text line tall with no up and down buttons (typed,
    dragged, or stepped with ↑ ↓), so it is no bigger than the check box; a
    double-click on it or on "bars" puts back 1.
  - Sound (a list), Subdivide and Click on (segmented switches).
  - A Volumes box: Click volume, Beat one, Beats, Subdivisions (knobs).
- Each change in the dialog takes effect at once, heard as the clip plays,
  and is saved; there is no OK. A double-click on a label puts back its
  default, as in Settings. Esc, a click outside it or its × closes it.
- Settings › Metronome keeps every field too (every preference is listed in
  Settings), staged until OK as the rest of Settings.

## Saved

`frets.tab.metronome` gains `sound`, `subdivide`, `clickOn`,
`beatOneVolume`, `beatsVolume` and `subdivisionsVolume`; its parser checks
each, and a value it doesn't know is the default.

## How

- `src/features/metronome/sounds.ts` moved to `src/lib/clickSounds.ts`
  (`ClickSound`, `CLICK_SOUNDS`, `clickSoundWaves`), now that Tab plays
  them too.
- `src/features/tab/click.ts` builds every sound into the one SoundFont
  preset, each on two keys of its own (`clickKeys`): the wood block keeps
  General MIDI's wood block keys, 76 and 77, and each sound after it the
  next two.
- `src/features/tab/metronomeClicks.ts` (pure): `countOf` (a bar's clicks
  and its group starts), `barClicks` (where each click of a bar falls and
  its kind: beat one, a group's start, a beat, or a subdivision),
  `clickVelocity` (each kind's velocity scaled by its level).
- `perform` in `playback.ts` takes the click pattern and writes its clicks
  into the MIDI, as it did the plain clicks; `withCountIn` writes the
  count-in's with the same pattern. A change of pattern makes the clip's
  MIDI again and plays on from where it was, as a change of rolls does
  (`TabPlayer.setClickPattern`).
- `SettingsFields` (`src/components/settings/SettingsDialog.tsx`) draws a
  section's rows, for the Settings pane and for the Metronome dialog
  (`MetronomeDialog.tsx`), which share `METRONOME_FIELDS` in
  `tabSettings.tsx`.
- `clickPreview.ts` sounds a picked sound with Web Audio, apart from the
  player, so it is heard before the first Play.

## Tests

- Cowbell plays beat one on its high key and the other beats on its low
  key; the wood block keeps keys 76 and 77.
- 4/4 with Eighths clicks at 0, ½, 1 … 3½ beats; 2/4 with Triplets at
  thirds of a beat, the triplets softer than the beat; 1/4 with Sixteenths
  at quarters of a beat.
- 2/2 takes four eighths a beat; 6/8 takes no eighths or triplets but two
  sixteenths; 5/16 takes none.
- Backbeat in 4/4 clicks beats 2 and 4, with Eighths 2, 2½, 4, 4½; in 3/4
  the 2; in 6/8 the 4; in 7/8 (2+2+3) the 3 and the 5; in 3/8 the 2. Beat
  one clicks only the 1.
- 7/8 strikes the 3 and the 5 harder; with `\beaming (8 3 2 2)` the 4 and
  the 6; 6/8 the 4; 4/4 and 3/8 none.
- Beat one at 50 % halves beat one's velocity; Subdivisions at 0 leaves the
  subdivisions out and the beats as they were.
- A count-in with Backbeat and Eighths clicks all eight eighths of a 4/4
  bar.
- Every sound is heard from the SoundFont in alphaTab.
- The saved section reads each new field, and a sound, subdivision or
  Click on it doesn't know, or a volume out of 0 to 1, is the default.
- Settings › Metronome sets the sound, subdivisions, Click on and the three
  volumes, and the Metronome dialog shows them.
- The count-in bars field has no up and down buttons, and ↑ steps it.
- A right-click on Metronome opens the Metronome dialog with every field;
  the count-in bars are greyed out until Count in is on; each change is saved at once
  with no OK, and the footer's toggle follows the dialog's Metronome.
