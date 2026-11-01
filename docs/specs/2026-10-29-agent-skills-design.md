# Agent skills for Frets pages

Issue #217. A user points an agent at a Frets capability, and the agent
writes chords or tab that open in the right Frets page.

## Scope

Tab and Chords only: the two pages that open their state from a link
(`/tab#tab=`, `/chords?chord=&shape=`). The Scale lab, Triads and the
Circle of fifths keep no state in the URL; they can follow once they do.

## What is published

Everything is a static file in `public/`, served at frets.eminor.net:

- **Guides**, plain text written for people and agents, which carry every
  fact: `chord-links.txt` (new) and `tab-alphatex.txt` (with
  `tab-ascii.txt`, as before).
- **Skills** in the Agent Skills format, `skills/<name>/SKILL.md`:
  `frets-chords` and `frets-tab`. Each is short: what the page does, the
  link, the few rules that matter most, and an instruction to fetch the
  live guide first, which wins where they disagree. So an installed skill
  doesn't go stale when the app changes.
- **`llms.txt`**, the index agents look for at a site's root, listing the
  guides and skills.

## Where people find it

A quiet "Agents" link in the footer, beside Source Code, opens
`/agents`: one card per page with what an agent can write and its skill:
a View skill link that opens the SKILL.md in the browser, and Copy and
Download buttons. The guides aren't shown there: the skill sends the agent
to its guide, and `llms.txt` lists them. A third group, More, holds the
page in the site menu and on the home page (breadcrumbs "More › Agents"),
with its own pictogram: a speech bubble holding three notes. The Tab page's Import dialog, which already links the
formats, adds "An agent can write it for you", linking to the same page.

Since 2026-11-01 the page has two headings: Skills (the cards above) and
Connectors, one card per MCP server a chat app can add, showing its URL
with a Copy button. The first is the Metronome's `/mcp`
(`docs/specs/2026-10-31-metronome-mcp-app-design.md`); `llms.txt` lists it
under "MCP servers".

## Keeping them current

- The chord types in `chord-links.txt` are generated from `CHORD_TYPES`
  and `chordSlug`; a test fails when the list is out of date, and
  `UPDATE_GUIDES=1 npm test` rewrites it.
- Tests check that every chord link in the guide names a chord the page
  knows and a shape it reads, that each shape plays only that chord's
  notes, that the files the agents page lists exist and are in `llms.txt`,
  and that each skill is a valid Agent Skill pointing at its guide. The
  alphaTex guide's examples were already tested.
- `CLAUDE.md` asks that a PR changing what a page reads from a link, or
  what the Tab page draws, updates that page's guide (and skill, if its
  short rules change) in the same PR.
