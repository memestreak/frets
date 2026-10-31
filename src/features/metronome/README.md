# The Metronome (`/metronome`)

Issue #149, `docs/specs/2026-10-31-metronome-design.md`. Off the home page
and menu (`sections.ts`) until Jeremy calls it ready.

- `MetronomePage.tsx`: the page, which loads on the client only through
  `MetronomeLoader.tsx`. It holds one metronome and shows it in the view
  picked in Settings › Metronome › Display. It also holds the Settings
  group, the `?` list (`shortcuts.ts`) and T for Tap.
- `views.tsx`: the four views, Readout, Dial, Pendulum and Bar. Each shows
  the beat at the top, in a box that keeps its size whatever the beats.
- `controls.tsx`: what the views share:
  - the head (gear, ⚠, `?`)
  - Start and Tap
  - Tempo and Beats (`NumberField`), with a double-click putting back 120
    and 4
  - the subdivision, the Sound and Volume, and the status line
  - `useBpmDrag`, which lets a drag on any shown tempo change it (5 bpm,
    or 1 with Shift)
- `Advanced.tsx`: Meter (preset, beats, groups, swing), the click pattern's
  voice grid (REAPER-style voices A to D), and the polyrhythm.
- `rhythm.ts` (pure):
  - the `Rhythm` (the work)
  - the usual steps, the changes (`withBeats`, `toggleCell`,
    `withPreset`…), the presets
  - `barClicks` (a bar's clicks in beats, swung) and the clock (`timeAt`,
    `retempo`)
  - tap tempo, tempo names and counting syllables
- `useMetronome.ts`: the saved rhythm and volume, and the Web Audio
  scheduler, which looks 120 ms ahead every 25 ms. Space starts and stops.
- `sounds.ts`: the synthesized sounds, high and low. The wood block is
  `src/lib/click.ts`.
- `storage.ts`: the three keys and their parsers. They are
  `frets.metronome.works.current` (the rhythm), `frets.metronome.display`
  (the view) and `frets.metronome.playback` (the volume).

Its CSS (`.metronome-*`) is in `src/app/globals.css`. Its tests are in
`src/__tests__/metronome/`.
