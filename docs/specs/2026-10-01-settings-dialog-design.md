# Settings dialog and on-page session stats

Date: 2026-10-01
Status: approved design, awaiting implementation plan

## Problem

Each trainer's settings open as an inline card between the header and the
answer card. Opening it pushes the quiz down the page, and the card mixes two
unrelated things: quiz settings and session statistics. The per-item accuracy
bars are only visible while the settings card is open, and the stats line
under the fretboard has to point at them ("per-interval breakdown in
Settings").

## Goal

1. Settings open in a centered modal dialog over the page.
2. Session stats leave settings and sit in their own card at the bottom of
   the page, always visible.

No setting is added, removed or renamed. Quiz rules, the header controls and
the storage format stay as they are.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Overlay shape | Centered dialog (not a side or bottom sheet) |
| Stats treatment | Compact card: summary line as heading, bars beneath |
| Reset session stats | Moves to the stats card with the stats |
| When changes apply | Live, as today; the dialog has only a Done button |
| Modal mechanism | Native `<dialog>` with `showModal()` |

Rejected for the modal: a hand-rolled overlay `div` (reimplements focus
trapping, inertness and Esc) and a dialog library (a runtime dependency for
one dialog).

## Components

### `SettingsDialog` (replaces `SettingsDrawer`)

New file `src/components/quiz/SettingsDialog.tsx`. `SettingsDrawer` is deleted
from `SettingsParts.tsx`.

```ts
interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  footnote: string;
  children: ReactNode;
}
```

Markup:

- `<dialog className="settings-dialog" aria-labelledby={headingId}>`, with
  `headingId` from `useId()`. The element is always mounted.
- A header row: an `<h3 className="dialog-title">` reading "Settings" and a
  ✕ icon button with `aria-label="Close settings"` (a new `CloseIcon` in
  `icons.tsx`).
- A scrollable body holding `children` (the trainer's fields).
- A footer row: the muted tuning `footnote` on the left and a primary
  **Done** button on the right.

Behavior:

- An effect keeps the element in step with `open`: it calls `showModal()`
  when `open` becomes true and the element is closed, and `close()` when
  `open` becomes false and the element is open.
- `onCancel` (Esc) calls `preventDefault()` and then `onClose()`, so the
  parent's state stays the single source of truth.
- `onClose` on the element (fired by any native close) calls `onClose()` if
  the parent still believes the dialog is open.
- A click whose target is the `<dialog>` element itself is a backdrop click
  and calls `onClose()`. The dialog's padding is zero and its content sits in
  an inner wrapper so that clicks on content never target the dialog element.
  The click listener is attached with `addEventListener` through a ref in an
  effect, not as a JSX `onClick`: jsx-a11y (at error severity) does not
  treat `<dialog>` as interactive. Esc is the keyboard equivalent.
- ✕ and Done call `onClose()`.
- The browser provides the focus trap, the inert background and the return
  of focus to the Settings button on close.
- While open, the page behind must not scroll: `html:has(dialog[open])`
  gets `overflow: hidden`.

### `SessionStatsCard`

New file `src/components/quiz/SessionStatsCard.tsx`. The component is not
called `SessionStats` because `lib/stats.ts` already exports a type of that
name.

```ts
interface SessionStatsCardProps {
  stats: SessionStats;
  rows: PerItemRow[];
  labelWidth: number;
  /** Group label for the bars, e.g. "Per interval". */
  itemLabel: string;
  onReset: () => void;
}
```

Markup: a `<section aria-label="Session stats">` with classes
`card mt-3.5 gap-3 px-[18px] py-3.5`, containing

- a row with the summary line and a ghost **Reset session stats** button.
  The summary is a `<span>` (styled text, not a heading element) at 14px,
  medium weight, showing `statsLine(stats)` and carrying
  `data-testid="stats-line"`;
- the existing `PerItemStats` bars, in a `role="group"` labelled by
  `itemLabel`.

`PerItemStats`, `Field`, `FretInput` and `FretPair` stay in
`SettingsParts.tsx` unchanged.

### `TrainerHeader`

The Settings button drops `aria-expanded` and `aria-controls` and gains
`aria-haspopup="dialog"`. Props `drawerOpen` and `drawerId` are removed;
`onToggleDrawer` becomes `onOpenSettings`. Mode, direction and Pause b/w are
unchanged.

## Trainer pages

The same change in `IntervalTrainer.tsx` and `NoteTrainer.tsx`:

- `drawer` state becomes `settingsOpen`. The dialog is always rendered and
  controlled by `open`.
- The dialog body holds only settings:
  - Intervals: String pairs, Fret range, Display toggles, Intervals in the
    pool.
  - Notes: Strings in scope, Board window, Target range.
- The `Field` holding `PerItemStats` is removed from the settings body.
- The muted stats paragraph under the board is replaced by
  `SessionStatsCard`.
  The " · per-interval breakdown in Settings" and " · per-note breakdown in
  Settings" suffixes are removed.
  - Intervals rows: one per interval in the active pool (as today),
    `labelWidth` 34, `itemLabel` "Per interval".
  - Notes rows: one per note label (as today), `labelWidth` 52, `itemLabel`
    "Per note".
- `SessionStatsCard` takes the old paragraph's place: inside the inner grid,
  directly after `BoardFrame`, separated by its own 14px top margin
  (`mt-3.5`), the same gap `.board-frame` keeps from the answer card.
- The `DRAWER_ID` constants are deleted.

## Behavior while the dialog is open

- Settings apply and persist on every change, through the existing `update`
  path. Closing the dialog discards nothing. The question regenerates behind
  the dialog as it does today.
- Quiz keyboard shortcuts are suspended. `useQuizKeyboard` gains an
  `enabled` option (default true); when false, key-down handling returns
  early and any held hint is released. Trainers pass
  `enabled: !settingsOpen`. This stops Enter, Space, H and the answer keys
  from acting on the hidden quiz, including when focus is on a dialog button
  rather than a text field.
- Auto-advance is suspended. Trainers pass
  `settingsOpen ? null : state.advanceMs` to `useAutoAdvance`. On close, a
  pending advance restarts with its full delay.
- Open state is local component state and is not persisted.

## Styling

Rules go in `globals.css`, in the `components` layer, using DS tokens.

- `.settings-dialog`: `--color-card` background, `--radius-lg`,
  `--shadow-lg`, no border, zero padding; width
  `min(560px, calc(100vw - 32px))`; `max-height: calc(100dvh - 32px)`;
  `margin: auto` set explicitly, because Tailwind's preflight zeroes the
  margin that centers a native dialog. The inner wrapper is a column flex
  container whose body scrolls (`overflow-y: auto`) while header and footer
  stay in view.
- `.settings-dialog::backdrop`: a translucent dark scrim
  (`rgb(0 0 0 / 0.4)`).
- Field layout inside the body keeps the current auto-fit grid, so fields
  fall to one column at phone width.
- No animation in this iteration.

## Storage

Unchanged. No settings field is added or removed, so
`parseIntervalSettings`, `parseNoteSettings` and the `v2` keys are not
touched.

## Testing

jsdom 29 does not implement `HTMLDialogElement.showModal` or `close`
(verified). `src/__tests__/setup.ts` gains a shim: `showModal` sets the
`open` attribute; `close` removes it and dispatches a `close` event.

New unit tests: `SettingsDialog.test.tsx` (open, Done, ✕, `cancel`, native
`close`, backdrop click closes, click on content does not),
`SessionStatsCard.test.tsx` and `useQuizKeyboard.test.tsx` (the `enabled`
option).

Updates to `IntervalTrainer.test.tsx` and `NoteTrainer.test.tsx`:

- Clicking Settings shows an element with role `dialog` named "Settings";
  it is not shown before.
- Done closes it; a `cancel` event on the dialog (Esc) closes it; the ✕
  button closes it.
- A setting changed in the dialog takes effect and is written to
  localStorage without closing.
- The stats summary, the per-item bars and Reset session stats are on the
  page without opening Settings, and are not inside the dialog.
- Reset session stats clears the stats.
- With the dialog open, an answer key does not answer the question, and a
  pending auto-advance does not fire (fake timers).

Existing tests that open the drawer to reach a setting are updated to go
through the dialog.

Manual verification in a browser (Playwright) on `/intervals` and `/notes`
at desktop and phone widths: open, change a setting, Esc, backdrop click,
focus returns to the Settings button, page does not scroll behind the
dialog, stats card renders and resets. Then `npm run lint`, `npm test` and
`npm run build`.

## Documentation

Update `CLAUDE.md`: the `src/components/quiz/` line ("settings drawer parts")
becomes settings dialog, settings field parts and session stats card.

## Out of scope

- New settings, presets, or reset-to-defaults.
- Apply/Cancel semantics.
- Persisting whether the dialog is open.
- Open/close animation.
- Any change to the storage format or the quiz rules.
