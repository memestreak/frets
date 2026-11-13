# Feature specs are living documents

A spec in `docs/specs/` says what is true now. A change that alters
behaviour an older spec describes rewrites that spec's words in the same
PR, briefly keeping the history that explains a decision ("first a
Text tool; since issue #463 set in the Tuning panel"), and the newer
spec is linked from it. Before 2026-11-13 an old spec only gained a
pointer line, and Jeremy found specs read that way left stale
statements standing (Jeremy, 2026-11-13: "Don't leave anything out of
date or stale. I'd like us to use feature specs as living documents.").

ADRs stay records: their text is not rewritten.

## Considered options

- **A pointer line in the old spec** (the rule until now): cheap, keeps
  each spec as it was agreed, but a reader of the old spec meets
  statements that are no longer true.
