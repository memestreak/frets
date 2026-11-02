# ADR format

ADRs live in `docs/adr/`, named by date and topic:
`docs/adr/YYYY-MM-DD-<slug>.md` (for example
`2026-11-02-no-users-yet.md`). Dates, not sequence numbers, so two
branches written at once can't claim the same number. Create the folder
with the first ADR.

## Template

```md
# {Short title of the decision}

{1-3 sentences: the context, what was decided, and why.}

Revisit when: {the condition that would make this worth re-arguing}
```

That's enough. An ADR records *that* a decision was made and *why*; it
doesn't fill in sections for their own sake.

## Optional lines and sections

- **`Revisit when:`** names the condition under which the decision
  should be reopened ("the app has real users", "tonal 6.5 imports under
  Node"). The skill checks these at the start of a session and asks
  whether the decision still stands when one looks met. Leave it out
  when no such condition exists.
- **`Status:`** (`proposed`, `accepted`, `superseded by
  YYYY-MM-DD-<slug>.md`): only when a decision has been revisited. To
  supersede, write the new ADR and add the status line to the old one;
  don't delete it.
- **Considered options**: when the rejected alternatives are worth
  remembering, so nobody proposes them again without the reasons.
- **Consequences**: when downstream effects aren't obvious.

## An ADR is a record, not a living document

Once written, its text stays as it was. Only the status line changes,
and a renamed glossary term is carried through. If the reasons change,
that is a new ADR. The value of an old ADR is that it shows why the
decision made sense at the time.

## What qualifies

All of: **surprising without context**, **a real trade-off**, and
**either hard to reverse or a product stance**. Typical kinds:

- **Architectural shape.** "Static export, no server; the MCP endpoint
  is a Pages Function."
- **Technology choices with lock-in.** Framework, hosting, a library
  that would take weeks to swap. Not every dependency.
- **Boundaries and scope.** What a part owns and what it must not do.
  The explicit "no"s are as valuable as the "yes"es.
- **Product stances.** A deliberate choice about what the app does or
  doesn't do, with reasons someone might not know: "No users yet, so
  changes don't keep old URLs, storage keys or saved state working."
  Easy to reverse in code; costly to reverse by accident.
- **Deliberate departures from the obvious path.** Anything a reasonable
  reader would assume the opposite of, so they don't "fix" it.
- **Constraints the code can't show.** A pinned version and why, a
  licence, an external contract.
- **Rejected alternatives** when the rejection isn't obvious.

Not an ADR: a rule the app follows that gets refined over time (that is
a product-wide spec); how one feature behaves (its spec); the obvious
choice with no real alternative.
