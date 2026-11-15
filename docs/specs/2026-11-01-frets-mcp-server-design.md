# Frets' MCP server

Jeremy, 2026-11-01: the MCP server at `/mcp` should grow to cover much of
the app (the tuner, arrangement rendering, chord and scale lookups), not
just the metronome. So it is one server for all of Frets, and pages add
their tools to it.

## One server, many tools

- One server, named `frets`, at `frets.eminor.net/mcp` (and over stdio).
  A chat app adds it once; a new tool needs nothing new from the user.
- The Agents page shows it as one "Frets" connector card: the Frets mark,
  a line per tool, the URL and Copy. `llms.txt` lists it under "MCP
  server" with its tools. Nothing about it is named for one page.

## The server's instructions

Jeremy, 2026-11-15 ([issue:frets#499](https://github.com/memestreak/frets/issues/499)):
the server gives chat apps **instructions**, the `instructions` string
of its `initialize` result, which they pass to the model as guidance for
the server as a whole. They are in `src/mcp/instructions.ts` and say only
what no one tool's description can:

- What Frets is, in a line.
- Which tool fits which request: show_tab for a short line of guitar music
  (a riff, a phrase, an exercise, a scale or arpeggio run, a few bars of
  chords), rather than ASCII tab whenever the user would want to see, hear
  or loop it; show_metronome for a click to practise to; show_tuner for
  tuning.
- Each call shows a new app; to change one, call again.
- A whole song or arrangement is too long for show_tab: write alphaTex
  from the guide (`/tab-alphatex.txt`) and give a link to the Tab page.
- Guitar-book words: strings 1 (high e) to 6 (low E), bpm, pitch as it
  sounds with the staff an octave higher, and a short idea is a phrase,
  a riff or a line.

Every chat with the connector pays for them, so they stay under 400
tokens. A new tool adds its line. The stand-in host logs them first, as
`initialize · instructions (~N tokens)`.

## Where the code lives

- `src/mcp/`: the server (`createFretsServer`), the list of pages' tools
  (`MCP_PAGES`), and the types a page implements (`RegisterTools`).
- `src/features/<page>/mcp/`: a page's tools (`tool.ts`, `register.ts`)
  and its MCP App's React code. The metronome's is the first.
- `mcp/apps/<name>/`: one folder per MCP App, each built by
  `npm run mcp:build` to its own single file, `mcp/dist/<name>.html`. The
  CSS every app shares (the site's CSS, components, fonts) is
  `mcp/apps/base.css`.
- Each entry (stdio, the `/mcp` Pages Function, the preview host) passes
  the built apps' HTML to `createFretsServer` by name.

The server moved here as soon as Jeremy asked for it to be general, rather
than waiting for a second tool, so the next page's tools follow a path
that already exists (`src/mcp/README.md`, "Adding a page's tools").

## Trying a tool with no connector

Jeremy, 2026-11-05: trying an MCP PR shouldn't mean adding a connector in
claude.ai. So the stand-in host (`mcp/preview/`, `npm run mcp:preview`)
is also built into the site at `/mcp-preview/`, on every deploy: each PR
preview has one to open, and so does production (no users yet; the page
is `noindex` and linked from nowhere). It is static, like the rest of the
site, so the `/mcp` Function stays the one Function and its size doesn't
change. It offers every tool the server lists, starts in the theme
`?theme=` names (light by default), shows the commit it was built at, and stacks its
panels on a phone.
Under the Tool list, a Preset list offers that tool's ready-made arguments
(Jeremy, 2026-11-05), in `mcp/preview/presets.ts`: about four a tool, each
named for what it shows, and picking one fills the arguments box. Picking a
tool starts on its first preset. show_tab's first has no loop; another
loops two bars, and one fails the bar check, to show what the model is told.
show_tuner takes no input, so it has one.
Each call shows its arguments on one line, which opens to the whole call,
pretty-printed. "What the model sees" logs everything a host passes on to
the model (all but `_meta`), each entry folded to one line: every tool from
`tools/list` with its description, schema and a rough token count, each
call's whole result (text and `structuredContent`), and each app's context
update. Each entry is named by its MCP method and the call it belongs to,
as `<method> · <tool> #<call>` with its rough token count, e.g.
`tools/call · show_tab #2 (~180 tokens)`, as `tools/list · show_tab (~1057
tokens)`; the rest is under the fold. The chat's turns use
the same `<tool> #<call>` names. An opened entry is split into labelled parts: a result's or update's
text (`content`) and its structured data (`structuredContent`), a tool's
description and input schema, then anything else, and last, under "Host only
(_meta), not sent to the model", the `_meta` the host keeps to itself: a
tool's is where its app's `ui://` address is (Jeremy, 2026-11-06). Each
app's `resources/read` is logged too, as `resources/read · ui://tab/app.html
(4.1 MB, host only)`, with its address, type and size but not its HTML.
Clear empties the log. The chat column sits at the chat's left, next to the sidebar, and its width is set by
dragging its right edge (from 280 px up to the room there is), which moves only that edge, or by ← →
on it, and the sidebar's the same way (from 240 px, leaving the chat at
least 360 px); the log lays its JSON out again to fit.


`src/__tests__/mcp/server.test.ts` checks the server is `frets`, that it
gives its instructions as a client connects, that they name every tool it
lists and no other, stay under 400 tokens, link the alphaTex guide and
never say "lick", that the stand-in host logs them, that it
lists exactly the tools the Agents page lists, that it serves each app it
names, that a missing app fails with its name, that `/mcp` imports
every app in `mcp/apps/`, that the stand-in host imports every app and
offers every tool, and that `npm run build` builds it after `next build`
(which empties `out/`). `src/__tests__/mcp/previewPresets.test.ts` checks
that every tool has presets, that show_tab's first has no loop, and that
the server shows every preset but the one meant to fail, which it refuses.
