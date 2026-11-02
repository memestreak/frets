# The Tuner (`/tuner`)

`docs/specs/2026-10-17-tuner-page-design.md`. A Tool, after the Circle of
fifths in `sections.ts`. The mic, the pitch detector and the tuner's
panels are shared with the Note trainer, in `src/components/tuner/` (its
own README).

- `TunerLoader.tsx` — loads the page on the client only (it reads the mic
  and storage); `src/app/tuner/page.tsx` renders it.
- `TunerPage.tsx` — the page: `TunerPanel` in a card, its mic listening
  from the moment the page opens until it is left.

## The MCP App (`show_tuner`)

Issue #283, `docs/specs/2026-11-01-tuner-mcp-app-design.md`: the tuner in a
chat, on Frets' MCP server (`src/mcp/README.md`). Standard tuning only, for
now (#287); Claude is told nothing back.

- `mcp/tool.ts` — the tool's name and description; it takes no input.
- `mcp/register.ts` — `show_tuner` and its app's resource, which asks the
  host for the mic.
- `mcp/TunerApp.tsx` — the app: asks for the mic only on Listen and lets
  it go on Stop or teardown; the host bridge is `listenToHost`
  (`src/mcp/app.ts`).
- `mcp/ChatTuner.tsx` — the tuner sized for a chat column: Listen, the note
  and cents, `CentsBar`, and the six strings.
- `mcp/CentsBar.tsx` — the chat tuner's meter, −50 to +50 cents.
- The app's entry is `mcp/apps/tuner/` (`main.tsx` builds the acoustic
  recordings in, since the host's frame can't fetch them), built to
  `mcp/dist/tuner.html`.
