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

## Tests

`src/__tests__/mcp/server.test.ts` checks the server is `frets`, that it
lists exactly the tools the Agents page lists, that it serves each app it
names, that a missing app fails with its name, and that `/mcp` imports
every app in `mcp/apps/`.
