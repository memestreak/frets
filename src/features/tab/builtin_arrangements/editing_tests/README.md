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
| `beam-overrides.atex` | Break the beam before this note and Join the beam to the note before, and pressing the lit one again for Automatic | `docs/specs/2026-11-04-tab-beat-groups-beams-design.md` |
| `beat-groups.atex` | Beat groups typed in the time signature panel re-beam a run of 7/8 | `docs/specs/2026-11-04-tab-beat-groups-beams-design.md` |
| `chords-panel-layout.atex` | The Chord set as tiles a page at a time, unused ones tinted; folding it apart from the chord editor; Insert at the cursor's bar and beat; Edit chord is choosing its shape, renamed apart; Change chord opens the same dialog as +; Copy to new chord; Delete in an unused chord’s menu | #400 |
| `chords-panel-edit.atex` | Adding and changing chords in the Chords panel: a pick only picks; Edit or a double-click opens it; Save renames every use; Save as new chord adds a changed copy; Esc closes it; + looks a chord up, offers the cursor's fingering, and draws your own | `docs/specs/2026-11-05-tab-chord-panel-design.md`, #251, #368 |
| `drag-range-handles.atex` | A selection box's left or right edge drags its start or end to another note, the other end staying | `docs/specs/2026-11-05-tab-range-handles-design.md` |
| `delete-keeps-text.atex` | Delete on a note, a chord and cut leave rests that keep the column's text and chord name; a longer note over the rest takes them; Ctrl/⌘+Delete takes them with the time | `docs/specs/2026-11-06-tab-delete-keeps-marks-design.md`, #393 |
| `delete-whole-bar.atex` | Delete on a bar selected whole leaves one whole rest | `docs/specs/2026-11-01-tab-rest-lengths-design.md`, #294 |
| `dynamics-enter-pick.atex` | Shift+D enters a dynamic at the cursor; a drawn one is picked, its field refuses what isn't a dynamic with a ⚠, and Delete takes it away | `docs/specs/2026-11-09-tab-dynamics-design.md`, #437 |
| `empty-bar-press.atex` | A press in an empty bar boxes the whole bar | #317, #318 |
| `fret-follows-tie.atex` | A fret typed on any note of a Tie chain changes the whole chain, which stays tied | `docs/specs/2026-10-25-tab-editing-design.md`, `docs/specs/2026-11-04-tab-ties-forward-design.md` |
| `grace-before.atex` | `/` adds a grace note before the picked note, and a second makes them sixteenths | `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md` |
| `insert-pushes.atex` | Insert pushes the music on over the bar line, and Ctrl/⌘+Delete pulls it back | `docs/specs/2026-11-04-tab-bars-always-full-design.md` |
| `lead-sheet-chord-names.atex` | In the lead sheet, a press puts the caret on a beat, C types a chord name there, a picked name is deleted, and digits and N change no note | `docs/specs/2026-11-08-tab-lead-sheet-design.md`, #295 |
| `longer-note-writes-over.atex` | A longer note, or a run made longer, writes over what follows, split and tied at the bar line | `docs/specs/2026-11-01-tab-rest-lengths-design.md`, #294, `docs/specs/2026-11-04-tab-bars-always-full-design.md` |
| `lyrics-typing.atex` | Shift+L types Lyrics note by note (the minus key joins syllables, Space moves on, Down a second Lyric line); a press picks a syllable, Delete takes it away, a double-click edits it | `docs/specs/2026-11-09-tab-lyrics-design.md` |
| `note-input-new-arrangement.atex` | In a new arrangement, a double-click on the staff puts the caret there with the Grid, and a paste of two eighths fills the bar with rests | `docs/specs/2026-10-30-tab-note-input-mode-design.md`, #421, #422 |
| `notes-into-tuplet.atex` | Selected notes squeezed into a tuplet, a Gap left after it | `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md` |
| `pick-every-mark.atex` | A chord name, accent, fermata, bend, tie and time signature picked: Attachment lines and the notes' tint, and a signature's panel opened by Enter | `docs/specs/2026-11-04-tab-pick-every-mark-design.md` |
| `pick-spans.atex` | A let ring line picked and its end Handle dragged to join the next; a P.M. line deleted; a vibrato grown by Alt+Shift+→ | `docs/specs/2026-11-04-tab-pick-every-mark-design.md` |
| `press-away-ends-note-input.atex` | A press above the staff, the Tab key, or a press away from the chord name field ends note input mode | `docs/specs/2026-10-30-tab-note-input-mode-design.md` |
| `rest-key-in-note-input.atex` | `,` in note input mode writes a rest of the Input length and moves the cursor on | `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md` |
| `rests-follow-the-meter.atex` | Delete leaves a Gap written by the meter: rests that show each beat | `docs/specs/2026-11-03-tab-rests-are-gaps-design.md` |
| `shift-press-grows.atex` | A Shift+press outside the selection grows it, keeping its start; inside it, it trims the end nearer the press | `docs/specs/2026-11-05-tab-shift-press-grows-design.md`, #366 |
| `text-markdown.atex` | `**bold**` in a Text drawn bold, Ctrl/⌘+B in the Text field on and off, Shift+Enter for a new line, a short bold Text under its chord name, other marks as typed | `docs/specs/2026-11-09-tab-text-markdown-design.md`, #446, #445 |
| `tie-chain-is-one-note.atex` | A press on any Tied note picks the whole Tie chain, and Delete takes all of it | `docs/specs/2026-11-04-tab-ties-forward-design.md` |
| `tie-forward.atex` | T ties a note on to the next one, in normal mode and in note input mode | `docs/specs/2026-11-04-tab-ties-forward-design.md` |
| `tuplet-entry.atex` | Tuplet entry: a triplet typed note by note, the Tuplet button lit while it is on | `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md` |
| `tuplet-on-a-note.atex` | A tuplet on one picked note takes its time, the bar staying full | `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md` |
| `typed-note-ties-over.atex` | A note typed in note input mode past the bar line is tied over it | `docs/specs/2026-11-04-tab-bars-always-full-design.md` |
| `voice-move.atex` | Alt+2 moves selected notes into voice 2; Select only voice › keeps one voice of a selection | `docs/specs/2026-11-04-tab-voices-drawn-edited-design.md` |
| `voice-typing.atex` | N, Alt+2 and a fret make a second voice, Delete on its last note takes it away; a fret on a string voice 1 is sounding is refused | `docs/specs/2026-11-04-tab-voices-drawn-edited-design.md` |
| `voices-drawn.atex` | A bass under a melody: stems by voice on the staff and the tab, notes starting together lined up, the other voice grey while editing | `docs/specs/2026-11-04-tab-voices-drawn-edited-design.md` |
