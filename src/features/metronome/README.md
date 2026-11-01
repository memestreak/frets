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

## The MCP App (#269)

The metronome also runs inside an AI chat (Claude, ChatGPT, VS Code and other
MCP Apps hosts), from `docs/specs/2026-10-31-metronome-mcp-app-design.md`.
A model calls `show_metronome`, and the host shows this metronome with that
rhythm in a sandboxed frame. It opens stopped.

- `mcp/tool.ts`: the tool's name, description and input (bpm, beats, groups,
  subdivision, swing, and an optional whole `rhythm` to start from).
  It also turns input into a rhythm through `parseRhythm`, and holds the
  one-line description. Pure, shared by the server and the app.
- `mcp/server.ts`: `createMetronomeServer(appHtml)`, the tool plus the
  `ui://metronome/app.html` resource. Stateless.
- `mcp/MetronomeApp.tsx`: the app, which is the core shown in one compact
  layout, `mcp/Strip.tsx` (pads, then the tempo, Start, Tap and Beats in a
  row; Sound and Volume at the top of Advanced). It has no storage, and the
  page's four views stay on the page. It shows the tool's input at once, then the
  server's result. About a second after the user's last change, it tells the
  model the whole rhythm (`ui/update-model-context`). It follows the host's
  theme and stops and closes the audio on teardown. Space and T work as on
  the page. `mcp/host.ts` wires the host's messages, outside React.
- Builds, in the repo's `mcp/` folder: `vite.config.mts` (the app, one
  self-contained `mcp/dist/app.html` with CSS and fonts inlined),
  `vite.server.config.mts` (`stdio.ts` to `mcp/dist/server.mjs`) and
  `vite.preview.config.mts` (`npm run mcp:preview`).
- `functions/mcp.ts`: the same server over HTTP at `/mcp`, a Cloudflare
  Pages Function. The server is named `frets`, as other pages' tools
  will join it on the same URL. The Agents page and `llms.txt` list it
  (`MCP_SERVER` in `src/features/agents/agentGuides.ts`).

### Trying it

- **In a browser, no Claude:** `npm run mcp:preview`, then open
  http://localhost:5174. The page runs the real server, calls the tool and
  shows each metronome in a frame. It logs what the model would be told,
  and has a theme switch, a chat width and Tear down.
- **Claude Desktop:** run `npm run mcp:build`. Then in Settings › Developer
  › Edit Config, add the server below to `claude_desktop_config.json`, and
  quit and reopen Claude. Use node's full path (`which node`), since
  Desktop doesn't load nvm.

  ```json
  { "mcpServers": { "frets": {
      "command": "/full/path/to/node",
      "args": ["/full/path/to/frets/mcp/dist/server.mjs"] } } }
  ```

  Then ask "click at 92 in 7/8, grouped 2+2+3" and allow the tool.
- **claude.ai or Desktop by URL:** add a custom connector with the URL
  `https://frets.eminor.net/mcp`, or a PR preview's
  `https://<branch>.frets-6e8.pages.dev/mcp`.
- **Claude Code** (text only, no frame):
  `claude mcp add frets -- node mcp/dist/server.mjs`.
