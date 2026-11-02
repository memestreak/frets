---
name: check-docs
description: Check the repo's documentation artifacts (GLOSSARY.md, ADRs,
  specs, folder READMEs, CLAUDE.md, public/ guides) against each other and
  against the code, and report what is stale. No interview. Run only when
  the user invokes /check-docs.
disable-model-invocation: true
---

# Check docs

Find where the documentation disagrees with itself or with the code, and
report it. This is steps 1 and 6 of `/grill-with-docs` on their own:
nothing is written until the user approves a fix.

Scope: the whole repo, or the folders the user names.

## 1. Read

`CLAUDE.md`, `GLOSSARY.md`, every ADR in `docs/adr/`, the `README.md` of
each folder in scope, the specs those READMEs list, and the guides and
skills under `public/`. Formats are in `../grill-with-docs/`.

## 2. Check

Look for each of these, and look at the code where a claim can be
checked:

- **Glossary drift.** A word under `_Avoid_` used in an ADR, spec,
  README, `CLAUDE.md`, a `public/` guide, or in code names and test
  names. A term the glossary defines one way and a doc uses another way.
  A project word used across several docs that the glossary doesn't
  define yet.
- **ADR drift.** A doc or a piece of code that contradicts an ADR
  without a superseding ADR. A `CLAUDE.md` line that restates an ADR's
  rule in full instead of pointing to it. An ADR whose `Revisit when:`
  condition looks met.
- **Spec drift.** A spec whose pinned value or "no" has no test, or a
  test that pins a different value. Two specs that describe the same
  behavior differently. A spec not listed in the README of a folder it
  shapes.
- **README drift.** A README whose `## What's here` names a file that
  moved or went away, or misses one that arrived. A missing `## Specs`
  or `## Decisions` section. A storage key in code that the README
  doesn't list.
- **Hub drift.** A `CLAUDE.md` pointer to a file that moved. A
  product-wide spec not linked from `CLAUDE.md`.

## 3. Report

One table: file, line or section, what disagrees with what, and the fix
you'd make. Group by the five kinds above, worst first. Say what you
checked and found clean, in one line.

Then stop. Apply the fixes the user approves, each as its own small
edit. Never edit an ADR's text except to carry a renamed glossary term;
a contradicted ADR gets a note in the report, not a change. Don't edit
`CLAUDE.md`: propose its lines.
