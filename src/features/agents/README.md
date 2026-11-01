# Agents

The `/agents` page, linked from the footer, and what it lists
(`docs/specs/2026-10-29-agent-skills-design.md`).

- `agentGuides.ts` — `AGENT_GUIDES`: one entry per page an agent can write
  for, its guide and its skill, both files in `public/`. `MCP_SERVER`: Frets' one MCP server (`/mcp`), its URL and its tools,
  one per page that runs in a chat (so far the Metronome).
- `AgentsPage.tsx` — Skills: a card per guide, with `SkillActions.tsx`:
  View skill (opens the SKILL.md), Copy (its text) and Download. Then
  Connector: one Frets card listing the server's tools, with
  `ConnectorActions.tsx`, its URL and Copy.

The files themselves:

- `public/llms.txt` — the index agents look for; lists every guide, skill
  and the MCP server.
- `public/chord-links.txt` — the Chords page's links. Its list of chord
  types is generated: `UPDATE_GUIDES=1 npm test` rewrites it.
- `public/tab-alphatex.txt`, `public/tab-ascii.txt` — the Tab page's formats
  (described in `src/features/tab/README.md`).
- `public/skills/<name>/SKILL.md` — Agent Skills, short, each sending the
  agent to its guide. `public/_headers` serves them as plain text, so View
  skill shows them in the browser.

Tests: `src/__tests__/agents/`.
