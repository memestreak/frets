---
name: grill-with-docs
description: Interview the user relentlessly about a plan or design in this
  repo, writing the glossary and ADRs as terms and decisions settle, then
  the spec. Run only when the user invokes /grill-with-docs.
disable-model-invocation: true
---

# Grill with docs

Interview the user until you share one understanding of a plan or design,
and leave it on disk as you go: settled terms in `GLOSSARY.md`, the rare
hard decisions as ADRs, and every other decision in the spec at the end.

Two modes, by what the user asks for:

- **A change** (the usual case): a feature, fix or redesign to plan.
- **The repo itself** ("document this repo"): no change in mind. Read the
  code and docs, then grill the user on the words and the standing
  decisions you find. It ends at the glossary and ADRs; there is no spec.

## Before the first round

Read the repo's own instructions (`CLAUDE.md`, `AGENTS.md`), `GLOSSARY.md`
(or `GLOSSARY-MAP.md` and the glossaries it lists), the ADRs in
`docs/adr/` that touch the area, and the specs or docs the instructions
point to for that area. Note where specs live and what they look like;
you will write one at the end.

## The interview

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

Make the tree cover, where they apply:

- the motivation, and assumptions that may be false
- contradictions with the requirements, the glossary, earlier specs or
  ADRs
- consequences that aren't obvious
- the implementation
- UI and UX
- concerns and trade-offs

Skip questions with obvious answers.

**Facts are your job; decisions are the user's.** When a question needs a
fact from the code, the docs or the tools, look it up (send a sub-agent
for anything broad) instead of asking. Don't block the round on it: ask
the questions that don't depend on that fact now.

## Domain language, as you go

- **Challenge against the glossary.** When the user uses a term in a way
  that conflicts with `GLOSSARY.md`, say so at once: "The glossary defines
  a Shape as X, but you seem to mean Y. Which is it?"
- **Sharpen fuzzy words.** When a word is vague or overloaded, propose a
  precise term and ask which thing is meant.
- **Test with scenarios.** Invent concrete edge cases that force the
  boundary between two concepts to be stated.
- **Check the code.** When the user says how something works, check that
  the code agrees, and surface any contradiction.
- **Write the glossary inline.** When a term settles, update
  `GLOSSARY.md` right then, not in a batch at the end. Follow
  [GLOSSARY-FORMAT.md](GLOSSARY-FORMAT.md). Create the file when the
  first term settles. The glossary holds vocabulary only: no
  implementation, no spec, no notes.

## ADRs, sparingly

Offer an ADR only when a decision is all three:

1. **Hard to reverse**: changing your mind later costs real work.
2. **Surprising without context**: a later reader would ask "why did they
   do it this way?" and might "fix" it.
3. **A real trade-off**: there were genuine alternatives, and one was
   picked for reasons.

If any is missing, there is no ADR; the decision goes in the spec. Most
sessions write none. When the user accepts one, write it then, following
[ADR-FORMAT.md](ADR-FORMAT.md). If a plan contradicts an existing ADR,
say so and ask whether to reopen it; never override it silently.

## Ending a change: the spec

The session is done when the frontier is empty: every branch visited,
nothing silently assumed. Say so, and ask the user to confirm the shared
understanding. Then write the spec.

- **Where:** wherever the repo's instructions say specs go, named and
  shaped like the recent specs there (read two or three first). An
  existing spec for the same feature is updated rather than duplicated.
  If the repo has no spec convention, write
  `docs/decisions/YYYY-MM-DD-<topic>.md`: a title, one line of context,
  then the decisions as a list.
- **What:** every decision the session settled that is not in an ADR,
  in the words agreed. Keep numbers, defaults, limits, orderings and
  "no"s exact ("in tune within ±5 cents", "no locking a string"): these
  are what a later change breaks by accident. Use the glossary's terms.
  Link any ADR the session wrote.
- **Check it:** re-read your rounds and the user's answers against the
  spec. List any answer the spec dropped or softened, and fix it before
  you report.

Don't start building until the user says to.

## Ending "document this repo"

Stop when the user has settled the terms and ADRs worth having. Summarise
what was written, and list terms or decisions you saw but left open.
