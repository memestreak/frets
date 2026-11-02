# ADR format

ADRs live in `docs/adr/`, named by date and topic:
`docs/adr/YYYY-MM-DD-<slug>.md` (for example
`2026-11-02-static-export.md`). Dates, not sequence numbers, so two
branches written at once can't claim the same number. Create the folder
with the first ADR.

## Template

```md
# {Short title of the decision}

{1-3 sentences: the context, what was decided, and why.}
```

That's enough. An ADR records *that* a decision was made and *why*; it
doesn't fill in sections for their own sake.

## Optional sections

Add them only when they carry something:

- **Status** line (`proposed`, `accepted`, `superseded by
  YYYY-MM-DD-<slug>.md`): when a decision gets revisited. To supersede,
  write the new ADR and update the old one's status; don't delete it.
- **Considered options**: when the rejected alternatives are worth
  remembering, so nobody proposes them again without the reasons.
- **Consequences**: when downstream effects aren't obvious.

## What qualifies

All three of: hard to reverse, surprising without context, and a real
trade-off. Typical kinds:

- **Architectural shape.** "Static export, no server; the MCP endpoint is
  a Pages Function."
- **Technology choices with lock-in.** Framework, hosting, a library
  that would take weeks to swap. Not every dependency.
- **Boundaries and scope.** What a part owns and what it must not do.
  The explicit "no"s are as valuable as the "yes"es.
- **Deliberate departures from the obvious path.** Anything a reasonable
  reader would assume the opposite of, so they don't "fix" it.
- **Constraints the code can't show.** A pinned version and why, a
  licence, an external contract.
- **Rejected alternatives** when the rejection isn't obvious.

Easy to reverse: skip it, you'll just reverse it. Not surprising: nobody
will ask. No real alternative: there's nothing to record.
