# The Metronome (`/metronome`)

Issue #149, `docs/specs/2026-10-31-metronome-design.md`. Off the home page
and menu (`sections.ts`) until Jeremy calls it ready.

- `MetronomePage.tsx`: the page, which loads on the client only through
  `MetronomeLoader.tsx`. It holds one metronome and shows it in the view
  picked by the switch in the head (no Settings dialog). It also holds the
  `?` list (`shortcuts.ts`), T for Tap, and the head's end (the ⚠ and `?`,
  passed to the views through `HeadEnd`, so the views don't need the
  AppShell).
- `views.tsx`: the four views, Readout, Dial, Pendulum and Bar. Each shows
  the beat at the top, in a box that keeps its size whatever the beats.
- `controls.tsx`: what the views share:
  - the head (the title and view switch, then whatever `HeadEnd` holds)
  - Start and Tap
  - Tempo and Beats (`NumberField`), with a double-click putting back 120
    and 4
  - the Sound and Volume
  - `useBpmDrag`, which lets a drag on the big tempo or the dial change it
    (5 bpm, or 1 with Shift). The pendulum's weight follows the pointer
    instead (`useWeightDrag` in `views.tsx`).
- `Advanced.tsx`: Meter (preset, groups, swing), the click pattern's voice
  grid (REAPER-style voices A to D, their Sound, Pitch and Volume columns),
  and the polyrhythm (its switch, then its controls in the voices' columns,
  greyed out while off).
- `rhythm.ts` (pure):
  - the `Rhythm` (the work)
  - the usual steps, the changes (`withBeats`, `toggleCell`,
    `withPreset`…), the presets
  - `barClicks` (a bar's clicks in beats, swung) and the clock (`timeAt`,
    `retempo`)
  - tap tempo, tempo names and counting syllables
- `useMetronomeCore.ts`: the metronome with no storage and no page hooks,
  shared by the page and the MCP App (#269). It holds the rhythm (in with
  `setRhythm`, out as `rhythm`), the volume, and the Web Audio scheduler,
  which looks 120 ms ahead every 25 ms. It also has tap, start, stop, and
  `close` (stop and let the `AudioContext` go).
- `useMetronome.ts`: the page's metronome, which is the core plus loading
  and saving the rhythm and volume, and Space to start and stop.
- `sounds.ts`: the synthesized sounds, high and low. The wood block is
  `src/lib/click.ts`.
- `storage.ts`: the three keys and their parsers. They are
  `frets.metronome.works.current` (the rhythm), `frets.metronome.display`
  (the view) and `frets.metronome.playback` (the volume).

Its CSS (`.metronome-*`) is in `src/app/globals.css`. Its tests are in
`src/__tests__/metronome/`.
