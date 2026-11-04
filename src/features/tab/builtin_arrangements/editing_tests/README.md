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
| `fret-follows-tie.atex` | A fret typed on any note of a Tie chain changes the whole chain, which stays tied | `docs/specs/2026-10-25-tab-editing-design.md`, `docs/specs/2026-11-04-tab-ties-forward-design.md` |
| `grace-before.atex` | `/` adds a grace note before the picked note, and a second makes them sixteenths | `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md` |
| `insert-pushes.atex` | Insert pushes the music on over the bar line, and Ctrl/⌘+Delete pulls it back | `docs/specs/2026-11-04-tab-bars-always-full-design.md` |
| `longer-note-writes-over.atex` | A longer note, or a run made longer, writes over what follows, split and tied at the bar line | `docs/specs/2026-11-01-tab-rest-lengths-design.md`, #294, `docs/specs/2026-11-04-tab-bars-always-full-design.md` |
| `notes-into-tuplet.atex` | Selected notes squeezed into a tuplet, a Gap left after it | `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md` |
| `rest-key-in-note-input.atex` | `,` in note input writes a rest of the Input length and moves the cursor on | `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md` |
| `rests-follow-the-meter.atex` | Delete leaves a Gap written by the meter: rests that show each beat | `docs/specs/2026-11-03-tab-rests-are-gaps-design.md` |
| `tie-chain-is-one-note.atex` | A press on any Tied note picks the whole Tie chain, and Delete takes all of it | `docs/specs/2026-11-04-tab-ties-forward-design.md` |
| `tie-forward.atex` | T ties a note on to the next one, in normal mode and in note input | `docs/specs/2026-11-04-tab-ties-forward-design.md` |
| `tuplet-entry.atex` | Tuplet entry: a triplet typed note by note, the Tuplet button lit while it is on | `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md` |
| `tuplet-on-a-note.atex` | A tuplet on one picked note takes its time, the bar staying full | `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md` |
| `typed-note-ties-over.atex` | A note typed in note input past the bar line is tied over it | `docs/specs/2026-11-04-tab-bars-always-full-design.md` |
