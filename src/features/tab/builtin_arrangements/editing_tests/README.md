# Editing tests

Test arrangements: each one sets up one Tab editing behaviour for a person
to see and try, and says in Text over the column what to do and what
should happen. They are for people, not a test of the code: every
behaviour shown here also has an automated test, and a spec's `## Tests`
list never points here.

They show under Arrangements… → Built-in → Editing tests, and open with
`/tab#example=<file name>`. How to write one is in the
`test-arrangement` skill (`.claude/skills/test-arrangement/`), which
agents pick up whenever a change touches Tab editing behaviour.

Like every built-in folder but `samples/`, each file must read with no
warnings, every bar full, and write back exactly
(`src/__tests__/tab/examples.test.ts`). That keeps the files readable,
not their texts true: that is the next rule's job.

A PR that changes a behaviour checked here updates its file in the same
PR, or removes the file and its row when the behaviour is gone.

| File | Shows | Pinned by |
| --- | --- | --- |
| `delete-whole-bar.atex` | Delete on a bar selected whole leaves one whole rest | `docs/specs/2026-11-01-tab-rest-lengths-design.md`, #294 |
| `empty-bar-press.atex` | A press in an empty bar boxes the whole bar | #317, #318 |
| `fret-follows-tie.atex` | A fret change carries on to the notes tied to it | `docs/specs/2026-10-25-tab-editing-design.md` |
| `longer-note-writes-over.atex` | A longer note writes over what follows, split and tied at the bar line | `docs/specs/2026-11-01-tab-rest-lengths-design.md`, #294 |
