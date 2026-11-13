---
name: grill-with-docs
description: Interview the user relentlessly about a plan or design in this
  repo, writing the glossary and ADRs as terms and decisions settle, then
  the spec and the folder READMEs. Run only when the user invokes
  /grill-with-docs.
disable-model-invocation: true
---

# Grill with docs

Interview the user until you share one understanding of a plan, and leave
it on disk as you go. Each kind of thing has one home:

| What settled | Home |
| --- | --- |
| A word for a thing | `GLOSSARY.md` |
| Why X over Y, hard to undo | ADR in `docs/adr/` |
| A stance someone might undo without knowing why | ADR, with `Revisit when:` |
| How a feature behaves | That feature's spec |
| A rule every page follows | A product-wide spec, linked from `CLAUDE.md` |
| How a folder is built, and why | That folder's `README.md` |
| An exact value or "no" that must keep holding | The spec, pinned by a test |
| Everything else agreed | The spec, in the words agreed |

Formats: [GLOSSARY-FORMAT.md](GLOSSARY-FORMAT.md),
[ADR-FORMAT.md](ADR-FORMAT.md), [README-FORMAT.md](README-FORMAT.md).
Specs follow the repo's own
convention (in Frets, `docs/specs/YYYY-MM-DD-<topic>-design.md`, a
byline, then what the user sees, then how).

Two modes, by what the user asks for:

- **A change** (the usual case): a feature, fix or redesign to plan. Runs
  all seven steps below.
- **The repo itself** ("document this repo"): no change in mind. Steps 1
  and 2 only, aimed at the words in use and the standing decisions, and
  then the seeding work at the end of this file.

## 1. Start

Read, in this order: `CLAUDE.md` and `AGENTS.md`; `GLOSSARY.md` (or
`GLOSSARY-MAP.md` and the glossaries it lists); the `README.md` of each
folder the change touches; the ADRs those READMEs list under
`## Decisions`, plus any in `docs/adr/` whose title touches the area; the
specs they list under `## Specs`, newest first, as far as they bear on
the change; and the product-wide specs `CLAUDE.md` links.

For each ADR read, check its `Revisit when:` line, if it has one. If the
condition looks met, say so in the first round and ask whether the
decision still stands. Don't reopen it on your own.

## 2. Interview

Map the plan as a **design tree**: every decision branches into the
decisions that hang off it. Work it in **rounds**.

The **frontier** is every open decision whose prerequisites are settled:
the questions you can ask now without guessing at answers you haven't
heard. Ask the whole frontier in one round. Number each question and give
your recommended answer, worded so "yes" accepts it:

```
❓ **Q1** - **<question title>**: <question, with the choices if there
are several>

➡️ <your recommended answer>

---

❓ **Q2** - ...
```

Then wait. Each round's answers settle decisions, push the frontier out
and unblock the questions that depended on them. Recompute and ask the
next round. A question that depends on another question still open in
this round belongs to a later round.

Make the tree cover, where they apply: the motivation, and assumptions
that may be false; contradictions with the requirements, the glossary,
earlier specs or ADRs; consequences that aren't obvious; the
implementation; UI and UX; concerns and trade-offs. Skip questions with
obvious answers.

**Facts are your job; decisions are the user's.** When a question needs
a fact from the code, the docs or the tools, look it up (a sub-agent for
anything broad) instead of asking. Don't block the round on it.

While you interview, keep the domain language sharp:

- **Challenge against the glossary.** When the user uses a term in a way
  that conflicts with `GLOSSARY.md`, say so at once: "The glossary
  defines a Shape as X, but you seem to mean Y. Which is it?"
- **Sharpen fuzzy words.** When a word is vague or overloaded, propose a
  precise term and ask which thing is meant.
- **Test with scenarios.** Invent concrete edge cases that force the
  boundary between two concepts to be stated.
- **Check the code.** When the user says how something works, check that
  the code agrees, and surface any contradiction.
- **Write the glossary inline.** When a term settles, update
  `GLOSSARY.md` right then, not in a batch at the end. Create the file
  with the first term. Vocabulary only: no implementation, no spec.

And offer ADRs sparingly. A decision earns one when it is **surprising
without context** (a later reader would ask why, and might "fix" it)
**and a real trade-off** (genuine alternatives, one picked for reasons)
**and either hard to reverse or a product stance** (a deliberate choice
about what the app does or doesn't do, even if the code change is
small). Anything short of all that goes in the spec. Most sessions write
none. When the user accepts one, write it then. When a plan contradicts
an existing ADR, raise it; if the user reopens it, write the replacement
and mark the old one superseded in this session. Never override one
silently.

## 3. Confirm

The interview is done when the frontier is empty: every branch visited,
nothing silently assumed. Say so, and ask the user to confirm the shared
understanding before you write anything further.

## 4. Write the spec

- **Which file.** The existing spec for the feature, edited, is the
  default. A new spec only for a new feature, or a redesign too large to
  rewrite the old one cleanly. Specs are living documents
  (`docs/adr/2026-11-13-specs-are-living-documents.md`): when a new spec
  takes over part of an old one, rewrite that part of the old spec to say
  what is true now, keeping only the history that explains a decision,
  and link the new spec from it; search every spec for statements the
  change makes untrue and fix them too. A rule every
  page follows goes in the product-wide spec for that concern, or a new
  one if there isn't one yet.
- **Shape.** Match the repo's recent specs: read two or three first.
- **Content.** Every decision the session settled that is not in an ADR,
  in the words agreed, using the glossary's terms. Keep numbers,
  defaults, limits, orderings and "no"s exact ("in tune within ±5
  cents", "no locking a string"). Link any ADR the session wrote.
- **Pin the tests.** Mark each exact value, default or "no" that the
  implementation must test, in a `## Tests` list at the end of the spec
  (or the spec's existing tests section). This is a hard rule for the
  repo: the implementing PR is not done until each pinned item has a
  test. Say so when you hand the spec over.

## 5. Update the READMEs

For each folder the change touches, update its `README.md` to
[README-FORMAT.md](README-FORMAT.md): add the spec to `## Specs` (newest
first, one line on what it decided or changed) and any new ADR to
`## Decisions`. If the README has no such sections yet, add them; leave
the rest of the file as it is unless the change alters what it says.

If a new rule belongs in `CLAUDE.md` (a product-wide spec to link, a
convention that changed), propose the line and let the user add it or
tell you to. Don't edit `CLAUDE.md` on your own: it is kept stable on
purpose.

## 6. Knock-on check

Changes to one artifact leave others stale. Before you finish:

- For each glossary term added, renamed or redefined: search the ADRs,
  specs, folder READMEs, `CLAUDE.md` and the guides and skills under
  `public/` for the old word and the words now under `_Avoid_`.
- For each ADR written or superseded: find the docs that restate the
  rule or link the old ADR.
- For the spec: list the READMEs and `public/` guides that `CLAUDE.md`
  ties to that area.

Show the list of files and lines. Apply the edits the user approves.
ADR text is never edited in this step, except to carry a renamed
glossary term.

## 7. Final check

Reread your rounds and the user's answers against the spec. List any
answer the spec dropped or softened, fix it, then report: the files
written or changed, the ADRs if any, and the pinned tests. Don't start
building until the user says to.

## "Document this repo": seeding

When the repo has no glossary or ADRs yet, this mode seeds them, in two
PRs back to back:

1. **Glossary and ADRs.** Read the code, `CLAUDE.md`, the READMEs and the
   specs. Grill the user on the words in use (which of the words already
   in the code are the right ones, and which to avoid) and on the
   standing rules in `CLAUDE.md` that are really decisions with reasons.
   Write each ADR after the fact, with its `Revisit when:` where one
   applies. Shrink each `CLAUDE.md` rule that an ADR now holds to a
   pointer, and propose those edits for the user to approve.
2. **README backfill.** Assign every existing spec to the folders it
   affects and add the `## Specs` and `## Decisions` sections to each
   README. This is lookup work: do it, and present the assignments for
   review rather than asking the user to make them.

End each by summarising what was written and listing the terms or
decisions you saw but left open.
