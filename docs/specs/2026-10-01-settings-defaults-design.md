# Defaults button in the settings dialog

Date: 2026-10-01
Status: implemented

## Goal

One click in the settings dialog puts every setting it shows back to its
default.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| What resets | Only the fields the dialog shows |
| Mode, Pause b/w | Kept: they live in the header, not the dialog |
| Session stats | Kept |
| Click flow | Applies at once; the dialog stays open; no confirmation |

## Design

- `SettingsDialog` takes an `onDefaults` callback and renders a ghost
  **Defaults** button in the footer, immediately left of Done.
- `resetIntervalSettings(set)` (`lib/intervals.ts`) and
  `resetNoteSettings(set)` (`lib/notes.ts`) return the default settings with
  `mode` and `pause` taken from `set`.
- Each trainer's handler sends the result through its existing `update`
  path, so the reset persists and draws a new question like any other
  settings change.
- When the settings already equal the defaults (`sameSettings` in
  `lib/quizFlow.ts`), the click does nothing and the question is kept, as
  the Horizontal range field does for an unchanged value.
- The storage format is unchanged.

## Notes trainer: no Board window, wider default range

Made alongside the Defaults button.

- The **Board window** setting is removed from the Notes trainer.
  `NoteSettings` loses `minFret` / `maxFret`; the board always draws the
  open strings through fret 15 (`NOTE_MAX_FRET`). A stored window is
  dropped by `parseNoteSettings`; the `v2` key is unchanged.
- **Target range** is capped at fret 15 (`clampNoteFret`), in the inputs and
  the parser, so it cannot leave the board. It defaults to frets 1 to 12
  (was 3 to 7).
- "Find on string" searches the whole board.
- With no window to miss, the only settings that fit no question are
  "no strings in scope"; the feedback line says so.

The two field notes ("Low E on the left." and the Target range note) are
removed from the Notes dialog.

The Interval trainer keeps its Fret range setting. Its default Direction
becomes Ascending and Descending (`rand`, was `asc`); an unrecognised stored
direction falls back to that default.

## Testing

- `intervals.test.ts`, `notes.test.ts`: the reset helpers.
- `SettingsDialog.test.tsx`: Defaults reports and the dialog stays open.
- `IntervalTrainer.test.tsx`, `NoteTrainer.test.tsx`: fields and
  localStorage return to defaults; mode, pause and stats survive; an
  unchanged reset keeps the question.

## Out of scope

- Confirmation or undo.
- Resetting Mode, Pause b/w or session stats.
- Presets.
