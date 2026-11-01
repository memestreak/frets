# Tuner as an MCP App

Issue #283. The Tuner (`docs/specs/2026-10-17-tuner-page-design.md`) also
runs inside an AI chat, as the second tool on Frets' MCP server
(`docs/specs/2026-11-01-frets-mcp-server-design.md`). Asked "help me tune my
guitar", the model calls `show_tuner`, and the host (Claude, ChatGPT and
other MCP Apps hosts) shows a compact tuner that listens through the mic.
The Tuner page doesn't change.

Settled with Jeremy on 2026-11-01, in four questions and a mock round.

## The mic

An MCP App runs in a sandboxed frame, which has no mic unless the host
gives it one. The app's resource asks for it with
`_meta.ui.permissions.microphone` (ext-apps `McpUiResourcePermissions`), on
the listing and on the content; the host decides.

What we found on 2026-11-01:

| Host | Mic |
| --- | --- |
| claude.ai / Claude Desktop | Granted. Jeremy tried a test build through a PR preview's `/mcp`: the host advertised the mic and the tuner heard his guitar. |
| Claude on iOS and Android | None. Anthropic's MCP Apps design guidelines: apps on mobile get no camera, mic or location. |
| ChatGPT on the web | Granted (developer forum reports: the frame's `allow` includes `microphone`). |
| Codex Desktop | Refused (openai/codex#34304). |

So the app never assumes it: it asks for the mic only when Listen is
pressed, and where it's refused it says "No mic here: press a string to
hear it". The strings still play their notes, so tuning by ear works
anywhere.

## The tool

`show_tuner`, with no input (Q1): standard tuning (E A D G B E) at A440
only, as the page. Other tunings are #287. It answers one line, for hosts
without apps too: "Tuner shown, in standard tuning. The user presses
Listen and plays a string." Read-only, stateless; each call shows a new
tuner.

Claude is told nothing back (Q3): no `ui/update-model-context`, live or
when the strings are in tune.

## The app

One compact layout for a chat column (Q2, then mock a of three: a bar under
the note, b a small dial beside it, c the strings as the readout), about
200px tall:

- **Listen | Stop** (primary when stopped), then the note heard (its octave
  small) and "8¢ flat", "In tune" or what to do next. Green in tune, as on
  the page.
- **A bar** from −50 to +50 cents with a needle and the in-tune zone, which
  lights in tune. A flat version of the page's dial.
- **The six strings**, low E to high e, the one heard lit (green in tune),
  each playing its note when pressed.

No title (the host labels the app), no Dial | Strobe switch and no sound
picker: those stay on the page. Stopped, the last reading clears. The host's
theme is followed; teardown lets the mic go. Nothing is saved.

The mic waits for Listen, unlike the page (which listens from the moment it
opens), because the tuner appears in the middle of a conversation.

## Sounds

The frame can't fetch the site's `/sounds/` (Q4). The six acoustic guitar
recordings (CC BY 3.0, `NOTICE.md`) are built into the app, about 300 KB:
the app is about 980 KB. `mcp/apps/tuner/main.tsx` inlines them and hands
them to `reference.ts` (`setBuiltInRecordings`), which decodes them from
their data: URLs without fetch, since a host's CSP may refuse fetching a
data: URL.

## Code

- `src/features/tuner/mcp/`: `tool.ts` (name, description, result line),
  `register.ts` (the tool and its resource, asking for the mic),
  `TunerApp.tsx` (host and mic), `ChatTuner.tsx` (the layout),
  `CentsBar.tsx` (the bar).
- `mcp/apps/tuner/`: `main.tsx` (the recordings), `app.css` (the layout's
  CSS), `tuner.html`.
- The Agents page's Frets card and `public/llms.txt` list the tool.

## Later

- Other tunings, and the tool taking one: #287.
- The mic's input level: #288.
