# Frets' MCP server (`src/mcp/`)

One MCP server, named `frets`, that every page can add tools to. A chat app
(Claude, ChatGPT, VS Code and other MCP Apps hosts) adds it once as a
connector, and each new tool arrives on the same URL. A tool can show an
**MCP App**: a page's own UI, running in a sandboxed frame in the chat.
Designs: `docs/specs/2026-11-01-frets-mcp-server-design.md` (this layout)
and `docs/specs/2026-10-31-metronome-mcp-app-design.md` (the first tool).

So far: the Metronome's `show_metronome`.

## The files

- `server.ts` — `createFretsServer(apps)`: a server with every page's
  tools. `apps` is each built app's HTML by name. Stateless, no model, no
  auth.
- `tools.ts` — `MCP_PAGES`, the list of every page's `register` function,
  in the order `tools/list` shows their tools.
- `types.ts` — `RegisterTools` (what a page gives the server), `AppsHtml`,
  and `appHtml(apps, name)`, which throws a clear error when the build left
  an app out.

A page's own MCP code lives in `src/features/<page>/mcp/`: its tools' input
and pure logic (`tool.ts`), its `register.ts`, and its app's React code.

Outside `src/`:

- `mcp/apps/<name>/` — one folder per app: `<name>.html`, `main.tsx` (mounts
  the app with an ext-apps `App`) and `app.css`, which imports
  `mcp/apps/base.css` (the site's CSS, the shared components and the fonts)
  and adds an `@source` for the page's folder. The name is one lowercase
  word, since `functions/mcp.ts` imports it by that name.
- `mcp/build.mjs` (`npm run mcp:build`) — builds each folder in `mcp/apps/`
  with `mcp/vite.config.mts` into one self-contained `mcp/dist/<name>.html`
  (scripts, CSS and fonts inlined: a host's frame may load nothing from
  outside), then the stdio server with `mcp/vite.server.config.mts`.
- `mcp/stdio.ts` → `mcp/dist/server.mjs` — the server over stdio, reading
  every `.html` beside it.
- `functions/mcp.ts` — the server over HTTP at `/mcp`, a Cloudflare Pages
  Function; every PR preview has its own. It imports each app's HTML by
  name. `npm run build` runs `mcp:build` first, so the site's deploy has
  them.
- `mcp/preview/` (`npm run mcp:preview`) — a stand-in host at
  http://localhost:5174 that runs the real server in the page and mounts
  the metronome in frames, logging what the model would be told.

## Adding a page's tools

1. Write the tool in `src/features/<page>/mcp/`: `tool.ts` (name,
   description, zod input, pure logic) and `register.ts` exporting a
   `RegisterTools` that calls `registerAppTool` / `registerAppResource`
   (from `@modelcontextprotocol/ext-apps/server`) for a tool with an app,
   or `server.registerTool` for a text-only one (a chord or scale lookup).
   Keep tools read-only and stateless: each call shows a new app.
2. Add the `register` function to `MCP_PAGES` in `tools.ts`.
3. For an app: add `mcp/apps/<name>/` (copy the metronome's three files),
   get its HTML with `appHtml(apps, '<name>')` in `register.ts`, and add
   `import <name> from '../mcp/dist/<name>.html'` to `functions/mcp.ts`
   and to the object it passes to `createFretsServer`. Stdio finds it on
   its own.
4. List the tool where people and agents find it: a line in `MCP_SERVER`
   (`src/features/agents/agentGuides.ts`, the Agents page's Frets card)
   and under "MCP server" in `public/llms.txt`.
5. Test it like `src/__tests__/metronome/mcp.test.tsx` (an in-memory
   client against `createFretsServer`). `src/__tests__/mcp/server.test.ts`
   already fails until steps 3 and 4 match the server.

## Trying it

- **In a browser, no Claude:** `npm run mcp:preview`, then open
  http://localhost:5174 (the metronome only, so far).
- **Claude Desktop:** run `npm run mcp:build`. Then in Settings › Developer
  › Edit Config, add the server below to `claude_desktop_config.json`, and
  quit and reopen Claude. Use node's full path (`which node`), since
  Desktop doesn't load nvm.

  ```json
  { "mcpServers": { "frets": {
      "command": "/full/path/to/node",
      "args": ["/full/path/to/frets/mcp/dist/server.mjs"] } } }
  ```

- **claude.ai or Desktop by URL:** add a custom connector with the URL
  `https://frets.eminor.net/mcp`, or a PR preview's
  `https://<branch>.frets-6e8.pages.dev/mcp`.
- **Claude Code** (text only, no frame):
  `claude mcp add frets -- node mcp/dist/server.mjs`.
