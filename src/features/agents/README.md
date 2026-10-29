# AI agents

The `/agents` page, linked from the footer, and what it lists
(`docs/specs/2026-10-29-agent-skills-design.md`).

- `agentGuides.ts` — one entry per page an agent can write for: its guide
  and its skill, both files in `public/`.
- `AgentsPage.tsx` — a card per entry: the guide's link with `CopyUrl.tsx`,
  and a Download skill button.

The files themselves:

- `public/llms.txt` — the index agents look for; lists every guide and skill.
- `public/chord-links.txt` — the Chords page's links. Its list of chord
  types is generated: `UPDATE_GUIDES=1 npm test` rewrites it.
- `public/tab-alphatex.txt`, `public/tab-ascii.txt` — the Tab page's formats
  (described in `src/features/tab/README.md`).
- `public/skills/<name>/SKILL.md` — Agent Skills, short, each sending the
  agent to its guide.

Tests: `src/__tests__/agents/agentGuides.test.ts`.
