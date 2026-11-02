# The Metronome (`/metronome`)

Issue #149, `docs/specs/2026-10-31-metronome-design.md`. A Tool, after the
Tuner in `sections.ts`.

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
  - the bpm range (`BPM_RANGE`, for `src/lib/tapTempo.ts`), tempo names and
    counting syllables
- `useMetronomeCore.ts`: the metronome with no storage and no page hooks,
  shared by the page and the MCP App (#269). It holds the rhythm (in with
  `setRhythm`, out as `rhythm`), the volume, and the Web Audio scheduler,
  which looks 120 ms ahead every 25 ms. It also has tap (from `src/lib/tapTempo.ts`), start, stop, and
  `close` (stop and let the `AudioContext` go).
- `useMetronome.ts`: the page's metronome, which is the core plus loading
  and saving the rhythm and volume, and Space to start and stop.
- `sounds.ts`: the synthesized sounds, high and low. The wood block is
  `src/lib/click.ts`.
- `storage.ts`: the three keys and their parsers. They are
  `frets.metronome.works.current` (the rhythm), `frets.metronome.display`
  (the view) and `frets.metronome.playback` (the volume).

Its CSS (`.metronome-*`) is in `metronome.css`, imported from `src/app/globals.css`. Its tests are in
`src/__tests__/metronome/`.

## The MCP App (#269)

The metronome also runs inside an AI chat (Claude, ChatGPT, VS Code and other
MCP Apps hosts), from `docs/specs/2026-10-31-metronome-mcp-app-design.md`.
A model calls `show_metronome`, and the host shows this metronome with that
rhythm in a sandboxed frame. It opens stopped.

- `mcp/tool.ts`: the tool's name, description and input (bpm, beats, groups,
  subdivision, swing, and an optional whole `rhythm` to start from).
  It also turns input into a rhythm through `parseRhythm`, and holds the
  one-line description. Pure, shared by the server and the app.
- `mcp/register.ts`: `registerMetronomeTools`, the metronome's part of
  Frets' MCP server (`src/mcp/README.md`): the tool plus the
  `ui://metronome/app.html` resource. Stateless.
- `mcp/MetronomeApp.tsx`: the app, which is the core shown in one compact
  layout, `mcp/Strip.tsx` (pads, then the tempo, Start, Tap and Beats in a
  row; Sound and Volume at the top of Advanced). It has no storage, and the
  page's four views stay on the page. It shows the tool's input at once, then the
  server's result. About a second after the user's last change, it tells the
  model the whole rhythm (`ui/update-model-context`). It follows the host's
  theme and stops and closes the audio on teardown. Space and T work as on
  the page. `listenToHost` (`src/mcp/app.ts`) wires the host's messages.
- The app's entry is `mcp/apps/metronome/` (its HTML, `main.tsx` and CSS),
  built to `mcp/dist/metronome.html`. The server, its builds and the ways
  to try it are Frets-wide: see `src/mcp/README.md`. In a chat, ask
  "click at 92 in 7/8, grouped 2+2+3" and allow the tool.

## Specs

- `docs/specs/2026-10-31-metronome-mcp-app-design.md`: the Metronome runs in a
  chat as an MCP App
- `docs/specs/2026-10-31-metronome-design.md`: the Metronome page: four views,
  tap tempo, meter, groups and swing

## Decisions

- `docs/adr/2026-11-02-no-users-yet.md`: no migrations of URLs, keys or saved
  state
- `docs/adr/2026-11-02-one-mcp-server.md`: every page adds its tools to frets
