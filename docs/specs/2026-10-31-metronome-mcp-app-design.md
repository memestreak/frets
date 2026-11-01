# Metronome as an MCP App

Issue #269. The Metronome (`docs/specs/2026-10-31-metronome-design.md`) also
runs inside an AI chat, as an MCP App (MCP Apps extension, spec 2026-01-26,
`@modelcontextprotocol/ext-apps`). When the user asks for "92 bpm in 7/8,
grouped 2+2+3", the model calls a tool, and the host (Claude, ChatGPT,
VS Code and others) shows the Frets metronome inline with that rhythm loaded.
The page doesn't change.

Settled with Jeremy on 2026-10-31, in thirteen questions (Q1 to Q13 below).
Built in two PRs: #273 split the metronome's core from the page, and this
one adds the app and the server.

## The tool

One tool, `show_metronome` (Q12: the issue's `start_metronome` promised
something it doesn't do, since the metronome opens stopped). Its input:

| Field | Range | Notes |
| --- | --- | --- |
| `rhythm` | a whole rhythm | What the metronome last reported, to start from. |
| `bpm` | 20–400 | |
| `beats` | 1–32 | A time signature is just its beats: 7/8 is 7. |
| `groups` | `"2+2+3"` | Must add up to `beats`; sets `beats` if that's left out. |
| `subdivision` | 1–8 | Clicks per beat, every beat alike (Q1). |
| `swing` | 50–75 | Splits plain beats in two, as on the page. |

The fields apply in that order on top of `rhythm` (or the default rhythm),
and the result goes through `parseRhythm`, the check the page runs on a
saved rhythm. So the page and the tool share one set of rules. Groups that
don't add up are refused with a message.

The result is the checked rhythm as `structuredContent`, plus one
line of text for hosts that can't show apps: "Metronome ready (stopped):
92 bpm, 7 beats grouped 2+2+3, 1 click a beat."

## What Claude can and can't do

In the spec, a host sends an app only the input and result of the tool call
that made it (plus theme, size and teardown). Claude can't reach a
metronome that's already showing. So each call shows a new metronome, and
the earlier one keeps playing until the user stops it (Q8, Q9: metronomes
don't stop each other). Live steering, which would need a stateful server
the open metronome polls, isn't planned (Q8).

To carry the user's changes over, the app reports them and the model passes
them back:

- About a second after the user's last change, the app sends
  `ui/update-model-context`. That's one line ("The user's metronome is now
  at 97 bpm, 7 beats grouped 2+2+3, 1 click a beat, playing. To change it,
  call show_metronome with this rhythm as `rhythm`.") plus the rhythm and
  playing state as data (Q7). A drag sends one update, not forty. What
  the host itself gave isn't echoed back.
- The tool's description tells the model to pass that rhythm back as
  `rhythm`, with only the fields it wants to change. So "push me up 5"
  keeps the user's Advanced edits (Q8).

## The app

- One compact layout for a chat column (Q13). Jeremy first chose the page's
  four views with their switch (Q5), then, after trying it in claude.ai,
  asked to "scale the UI to better suit" the chat. He picked one of three
  mocks (A tighter, B one row, C scaled): B, about 280px tall against 710px
  for the page's Readout. It has the pads, then one row with the tempo
  between − and + (drag it as on the page), Start, Tap and Beats.
  Advanced works as on the page, closed at first, and opening it grows the
  frame (Q6). Sound and Volume sit at its top. There's no title (the host
  labels the app) and no view switch. The page keeps its four views, and
  the tool has no `view`.
- No storage: the app starts from the tool's rhythm and volume 80%, and
  saves nothing. No ⚠ and no `?` in the head (both need the page). Space
  starts and stops, and T taps, once the frame has focus.
- It shows the tool's input as soon as it arrives, then the server's
  checked result.
- It waits for the `ui/initialize` handshake before sending the host
  anything, follows the host's theme (`data-theme`, the same attribute the
  page's theme uses), and on `ui/resource-teardown` stops the clock and
  closes the `AudioContext`. Audio starts only on Start (browsers need a
  click).
- One self-contained `app.html` (Vite with `vite-plugin-singlefile`): the
  scripts, the whole app's CSS and the three self-hosted fonts are inlined,
  since a host's default CSP lets the frame load nothing from outside. The
  sounds are synthesized, so there are no audio files. About 690 KB.

## The server

Stateless, with no model, no auth and no storage. It lists the tool, serves
the app as `ui://metronome/app.html` (`text/html;profile=mcp-app`), and
checks the rhythm. Since 2026-11-01 it is Frets' shared server,
`createFretsServer` in `src/mcp/` (`docs/specs/2026-11-01-frets-mcp-server-design.md`),
with the metronome's tools added by `registerMetronomeTools`. It runs:

- **over HTTP at `frets.eminor.net/mcp`**, a Cloudflare Pages Function in
  the site's own project (Q2: public; Q3). Every PR preview gets its own
  `/mcp`, so a branch can be tried in claude.ai as a custom connector. For
  that, Cloudflare's build command becomes `npm run build`, which builds the
  app before `next build` (Q4; `DEPLOYMENT.md`).
- **over stdio**, `mcp/dist/server.mjs`, for Claude Desktop and Claude Code
  on your own computer.

Nothing public pointed to `/mcp` until Jeremy called the Metronome ready
(Q10, 2026-11-01). Now `llms.txt` lists it under "MCP server", and the
Agents page shows it under "Connector" as Frets, with the metronome as its
first tool. The server is named `frets` (it was `frets-metronome`): other
pages' tools join it later on the same URL, and its code moves out of the
metronome's folder when the second one does.

## Trying it

`npm run mcp:preview` (Jeremy's ask) serves a stand-in host at
localhost:5174. It runs the real server in the page, mounts each metronome
in a sandboxed frame through the SDK's own `AppBridge`, logs what the model
is told, and has a theme switch, a chat width and Tear down. The Claude
Desktop steps are in `src/features/metronome/README.md`.

## Later

An app-only tool for a practice log (the first time the server would keep
state or need auth), and rhythm presets the model can list, as the issue
says.
