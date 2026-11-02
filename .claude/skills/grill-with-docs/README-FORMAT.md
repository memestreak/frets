# Folder README format

A folder's `README.md` tells an agent how that part of the code is
built, and why, before it changes anything there. It is the one artifact
kept next to the code, and the index to the specs and ADRs for its area.

## Sections

The headings are fixed, so agents and tooling can find them. A section
with nothing to say is left out, not left empty.

```md
# {Area} (`src/features/<area>/`)

{One or two sentences: what this folder is for.}

## What's here

{The files and what each does. Frets' existing READMEs hold this as a
dense bullet per folder; that content stays as it is.}

## Pattern

{How the code here is shaped, why it is shaped that way, and what not
to do. The things a newcomer would get wrong: where pure logic ends and
React begins, what must stay outside the render loop, which module owns
a piece of state.}

## Storage keys

{Every localStorage key this area owns, with its parser, as CLAUDE.md
requires. Only in READMEs that own keys.}

## Specs

- `docs/specs/2026-11-01-tuner-mcp-app-design.md`: the tuner as an MCP
  App
- `docs/specs/2026-10-17-tuner-page-design.md`: its own page, out of the
  Note trainer
- `docs/specs/2026-10-17-tuner-design.md`: the first tuner, in a modal

## Decisions

- `docs/adr/2026-11-02-one-mcp-server.md`: one MCP server for every page
```

## Rules

- **`## Specs` is newest first**, one line each on what the spec decided
  or changed. The line is how an agent picks which spec to open, so say
  what changed, not the spec's title again.
- **`## Decisions` lists the ADRs that bind this folder**, including
  product stances that apply here. Product-wide specs linked from
  `CLAUDE.md` are not repeated; every agent reads those anyway.
- **A spec that touches several folders is listed in each.**
- **Keep it current in the same PR.** A spec written or edited, an ADR
  written, a key added: the README changes in that PR. `/grill-with-docs`
  does this in its step 5; an ordinary PR does it by hand.
- **No history.** Git holds it. The README says how things are now.
