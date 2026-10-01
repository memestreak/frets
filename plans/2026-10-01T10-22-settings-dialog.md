---
date: 2026-10-01T10:22
summary: >
  Move each trainer's settings from an inline drawer into a centered modal
  dialog, and move session stats and their reset button into an
  always-visible card below the fretboard.
---

# Settings Dialog Implementation Plan

> **For agentic workers:** REQUIRED: Use subagent-driven-development (if
> subagents available) or executing-plans to implement this plan. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings open in a centered modal dialog, and session stats sit in
their own card at the bottom of each trainer page.

**Architecture:** A new `SettingsDialog` wraps the native `<dialog>` element
(`showModal()` gives the focus trap, inert background and Esc) and is
controlled by an `open` prop owned by each trainer. A new `SessionStatsCard`
shows the summary line, the per-item bars and the reset button below the
board. While the dialog is open the trainers switch off quiz keyboard
shortcuts (new `enabled` option on `useQuizKeyboard`) and hold auto-advance
(pass `null` to `useAutoAdvance`). Settings still apply live; storage is
untouched.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript strict,
Tailwind 4 (layout utilities only), plain CSS design system, Vitest +
Testing Library (jsdom 29).

**Spec:** `docs/specs/2026-10-01-settings-dialog-design.md` — read it first.

---

## Before you start

- Work on the existing branch `settings-dialog` (already created from
  `main`, which matches `origin/main`). Do not commit to `main`.
- Read `CLAUDE.md` and `AGENTS.md` at the repo root. Notably:
  - Tailwind's default palette is disabled. Use DS tokens such as
    `text-(--color-accent)`.
  - `npm run lint` must end with zero errors (jsx-a11y is at error
    severity).
  - In the Claude Code sandbox, `next build` and `next dev` must run
    unsandboxed.
- Tests use Vitest globals (`describe`, `it`, `expect`, `vi`); do not import
  them.
- Run one test file with `npx vitest run src/__tests__/<file>`; run all with
  `npm test`.
- Commit messages: write the message to a temp file with the Write tool
  (under `$TMPDIR`), then `git commit -F <file>`. First line imperative, at
  most 50 characters, no period; blank line; body wrapped at 72 columns.
  Never use heredocs.
- Do not use `cd <dir> && ...` compound commands.

## File structure

| File | Change | Responsibility |
|---|---|---|
| `src/__tests__/setup.ts` | modify | Add a `showModal` / `close` shim (jsdom has neither) |
| `src/components/icons.tsx` | modify | Add `CloseIcon` |
| `src/components/quiz/SettingsDialog.tsx` | create | Modal dialog shell: heading, ✕, body, footnote, Done |
| `src/app/globals.css` | modify | `.settings-dialog` rules and scroll lock |
| `src/components/quiz/SessionStatsCard.tsx` | create | Summary line, reset button, per-item bars |
| `src/hooks/useQuizKeyboard.ts` | modify | `enabled` option |
| `src/components/quiz/TrainerHeader.tsx` | modify | Settings button opens a dialog |
| `src/components/quiz/SettingsParts.tsx` | modify | Delete `SettingsDrawer` |
| `src/components/intervals/IntervalTrainer.tsx` | modify | Use dialog and stats card |
| `src/components/notes/NoteTrainer.tsx` | modify | Use dialog and stats card |
| `src/__tests__/SettingsDialog.test.tsx` | create | Dialog unit tests |
| `src/__tests__/SessionStatsCard.test.tsx` | create | Stats card unit tests |
| `src/__tests__/useQuizKeyboard.test.tsx` | create | `enabled` option tests |
| `src/__tests__/IntervalTrainer.test.tsx` | modify | Dialog and stats integration |
| `src/__tests__/NoteTrainer.test.tsx` | modify | Dialog and stats integration |
| `CLAUDE.md` | modify | Layout notes |

---

### Task 1: `SettingsDialog` component

**Files:**
- Modify: `src/__tests__/setup.ts`
- Modify: `src/components/icons.tsx`
- Create: `src/components/quiz/SettingsDialog.tsx`
- Modify: `src/app/globals.css`
- Test: `src/__tests__/SettingsDialog.test.tsx`

- [ ] **Step 1: Add the dialog shim to the test setup**

jsdom 29 has an `HTMLDialogElement` with a reflecting `open` property but no
`showModal()` or `close()`. Append to `src/__tests__/setup.ts`:

```ts

// jsdom has no HTMLDialogElement.showModal / close; model them with the
// `open` attribute, which jsdom's stylesheet already uses to hide a closed
// dialog.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/__tests__/SettingsDialog.test.tsx`:

```tsx
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SettingsDialog } from '@/components/quiz/SettingsDialog';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <SettingsDialog
        open={open}
        onClose={() => setOpen(false)}
        footnote="Standard tuning"
      >
        <button type="button">Inner</button>
      </SettingsDialog>
    </>
  );
}

function openDialog(): HTMLElement {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  return screen.getByRole('dialog', { name: 'Settings' });
}

describe('SettingsDialog', () => {
  it('is closed until opened', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
  });

  it('shows its children and footnote when open', () => {
    const dialog = openDialog();
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Inner' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Standard tuning');
  });

  it('closes with Done', () => {
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes with the ✕ button', () => {
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on cancel (Esc)', () => {
    const dialog = openDialog();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('follows a native close', () => {
    const dialog = openDialog() as HTMLDialogElement;
    act(() => dialog.close());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The parent heard about it: opening again works.
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('closes on a backdrop click but not on a content click', () => {
    const dialog = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Inner' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // A click whose target is the <dialog> itself landed on the backdrop.
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/SettingsDialog.test.tsx`
Expected: FAIL — cannot resolve `@/components/quiz/SettingsDialog`.

- [ ] **Step 4: Add `CloseIcon`**

Append to `src/components/icons.tsx`:

```tsx

export function CloseIcon() {
  return (
    <Icon>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}
```

- [ ] **Step 5: Write the component**

Create `src/components/quiz/SettingsDialog.tsx`:

```tsx
'use client';

import {
  useEffect, useEffectEvent, useId, useRef, type ReactNode,
} from 'react';
import { CloseIcon } from '../icons';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Tuning note shown beside the Done button. */
  footnote: string;
  children: ReactNode;
}

/**
 * Modal settings dialog on the native `<dialog>`: the browser supplies the
 * focus trap, inert page and Esc. The parent owns `open`; every way of
 * closing reports through `onClose`.
 */
export function SettingsDialog(
  { open, onClose, footnote, children }: SettingsDialogProps,
) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Attached by hand: jsx-a11y does not count <dialog> as interactive, and
  // Esc already covers the keyboard.
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Content sits in the inner wrapper, so only the backdrop targets `el`.
    const onClick = (e: MouseEvent) => {
      if (e.target === el) close();
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, []);

  return (
    <dialog
      ref={ref}
      className="settings-dialog"
      aria-labelledby={headingId}
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      // A close the parent did not ask for (e.g. a second Esc the browser
      // refuses to let us cancel): bring its state back in step.
      onClose={() => {
        if (open) onClose();
      }}
    >
      <div className="settings-dialog-inner">
        <div className="flex items-center justify-between gap-3">
          <h3 id={headingId} className="dialog-title m-0">Settings</h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Close settings"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="settings-dialog-body">{children}</div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted text-[12px]">{footnote}</span>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/SettingsDialog.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 7: Add the styles**

In `src/app/globals.css`, inside the `@layer components { ... }` block,
after the `.hint-btn { ... }` rule and before the block's closing brace,
add:

```css

  /* Settings: a native modal <dialog>. Preflight zeroes the margin that
     centers it, so restore `auto`. Padding lives on the inner wrapper so a
     click on the <dialog> itself can only be a backdrop click. */
  .settings-dialog {
    width: min(560px, calc(100vw - 32px));
    max-width: none;
    max-height: calc(100dvh - 32px);
    margin: auto;
    padding: 0;
    border: 0;
    overflow: hidden;
    color: var(--color-text);
    background: var(--color-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }
  .settings-dialog[open] { display: flex; }
  .settings-dialog::backdrop { background: rgb(0 0 0 / 0.4); }
  .settings-dialog-inner {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    min-height: 0;
    padding: 18px;
  }
  /* Scrolls between the fixed header and footer rows. The padding and
     negative margin leave room for focus rings inside the scroll box. */
  .settings-dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
    overflow-y: auto;
    padding: 3px;
    margin: -3px;
  }
  /* No page scroll behind the open dialog. */
  html:has(.settings-dialog[open]) { overflow: hidden; }
```

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/__tests__/setup.ts src/__tests__/SettingsDialog.test.tsx src/components/icons.tsx src/components/quiz/SettingsDialog.tsx src/app/globals.css
git commit -F <message file>
```

Message:

```
Add SettingsDialog on the native dialog element

A controlled modal shell with a heading, close button, scrolling body
and a footer holding the tuning note and Done. Esc, backdrop click,
the close button and Done all report through onClose. The test setup
gains a showModal/close shim because jsdom implements neither.
```

---

### Task 2: `SessionStatsCard` component

**Files:**
- Create: `src/components/quiz/SessionStatsCard.tsx`
- Test: `src/__tests__/SessionStatsCard.test.tsx`

The component is not named `SessionStats`: `src/lib/stats.ts` already
exports a type with that name.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/SessionStatsCard.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SessionStatsCard } from '@/components/quiz/SessionStatsCard';
import { emptyStats, recordAnswer } from '@/lib/stats';

const ROWS = [
  { label: 'm2', pct: 100 },
  { label: 'M2', pct: null },
];

describe('SessionStatsCard', () => {
  it('shows the summary line and one meter per row', () => {
    const stats = recordAnswer(emptyStats(), 1, true);
    render(
      <SessionStatsCard
        stats={stats} rows={ROWS} labelWidth={34}
        itemLabel="Per interval" onReset={() => {}}
      />,
    );
    const card = screen.getByRole('region', { name: 'Session stats' });
    expect(within(card).getByTestId('stats-line'))
      .toHaveTextContent('Streak 1 · best 1 · 100% of 1');
    const bars = within(card).getByRole('group', { name: 'Per interval' });
    expect(within(bars).getAllByRole('meter')).toHaveLength(2);
    expect(within(bars).getByRole('meter', { name: 'm2 accuracy' }))
      .toHaveAttribute('aria-valuenow', '100');
  });

  it('shows the placeholder before any answers', () => {
    render(
      <SessionStatsCard
        stats={emptyStats()} rows={ROWS} labelWidth={34}
        itemLabel="Per interval" onReset={() => {}}
      />,
    );
    expect(screen.getByTestId('stats-line'))
      .toHaveTextContent('No answers yet this session');
  });

  it('calls onReset from the reset button', () => {
    const onReset = vi.fn();
    render(
      <SessionStatsCard
        stats={emptyStats()} rows={ROWS} labelWidth={34}
        itemLabel="Per interval" onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset session stats' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/SessionStatsCard.test.tsx`
Expected: FAIL — cannot resolve `@/components/quiz/SessionStatsCard`.

- [ ] **Step 3: Write the component**

Create `src/components/quiz/SessionStatsCard.tsx`:

```tsx
import { statsLine, type SessionStats } from '@/lib/stats';
import { PerItemStats, type PerItemRow } from './SettingsParts';

interface SessionStatsCardProps {
  stats: SessionStats;
  rows: PerItemRow[];
  labelWidth: number;
  /** Group label for the bars, e.g. "Per interval". */
  itemLabel: string;
  onReset: () => void;
}

/** Session summary, reset, and per-item accuracy bars, below the board. */
export function SessionStatsCard(
  { stats, rows, labelWidth, itemLabel, onReset }: SessionStatsCardProps,
) {
  return (
    <section
      className="card mt-3.5 gap-3 px-[18px] py-3.5"
      aria-label="Session stats"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[14px] font-medium" data-testid="stats-line">
          {statsLine(stats)}
        </span>
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Reset session stats
        </button>
      </div>
      <div role="group" aria-label={itemLabel}>
        <PerItemStats rows={rows} labelWidth={labelWidth} />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/SessionStatsCard.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`
Expected: no errors.

```bash
git add src/components/quiz/SessionStatsCard.tsx src/__tests__/SessionStatsCard.test.tsx
git commit -F <message file>
```

Message:

```
Add SessionStatsCard for on-page session stats

Shows the session summary line, the reset button and the per-item
accuracy bars in one card, so stats no longer need the settings UI.
```

---

### Task 3: `enabled` option on `useQuizKeyboard`

**Files:**
- Modify: `src/hooks/useQuizKeyboard.ts`
- Test: `src/__tests__/useQuizKeyboard.test.tsx`

The hook listens on `window`, so keys pressed while a modal dialog has focus
still reach it. The trainers will pass `enabled: false` while settings are
open.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/useQuizKeyboard.test.tsx`:

```tsx
import { fireEvent, renderHook } from '@testing-library/react';
import { useQuizKeyboard } from '@/hooks/useQuizKeyboard';

function setup(initial: { enabled?: boolean; answered?: boolean }) {
  const onNext = vi.fn();
  const onHint = vi.fn();
  const onAnswerKey = vi.fn();
  const view = renderHook(
    (props: { enabled?: boolean; answered?: boolean }) => useQuizKeyboard({
      answered: props.answered ?? false,
      pause: false,
      onNext,
      onHint,
      onAnswerKey,
      enabled: props.enabled,
    }),
    { initialProps: initial },
  );
  return { onNext, onHint, onAnswerKey, ...view };
}

describe('useQuizKeyboard', () => {
  it('handles keys by default', () => {
    const { onAnswerKey, onHint } = setup({});
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: 'h' });
    expect(onAnswerKey).toHaveBeenCalledWith('3');
    expect(onHint).toHaveBeenCalledWith(true);
  });

  it('ignores answer, hint and next keys when disabled', () => {
    const { onAnswerKey, onHint, onNext, rerender } = setup({ enabled: false });
    onHint.mockClear();
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: 'h' });
    rerender({ enabled: false, answered: true });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAnswerKey).not.toHaveBeenCalled();
    expect(onHint).not.toHaveBeenCalledWith(true);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('releases a held hint when it becomes disabled', () => {
    const { onHint, rerender } = setup({ enabled: true });
    fireEvent.keyDown(window, { key: 'h' });
    onHint.mockClear();
    rerender({ enabled: false });
    expect(onHint).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/useQuizKeyboard.test.tsx`
Expected: the first test passes; the second and third FAIL (`onAnswerKey`
was called; `onHint` was not called with `false`).

- [ ] **Step 3: Implement the option**

In `src/hooks/useQuizKeyboard.ts`:

Add to `QuizKeyboardOptions`, after `onAnswerKey`:

```ts
  /** False suspends key handling, e.g. while a dialog is open. Default true. */
  enabled?: boolean;
```

Update the doc comment above `useQuizKeyboard` by adding this sentence to
its end (before the closing `*/`):

```ts
 * With `enabled` false, key presses are ignored and a held hint is released.
```

Make the first line of the `onKeyDown` handler body:

```ts
    if (opts.enabled === false) return;
```

so the handler begins:

```ts
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (opts.enabled === false) return;
    if (isTextEntry(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
```

After the existing `const onBlur = useEffectEvent(() => opts.onHint(false));`
line, add:

```ts

  const enabled = opts.enabled !== false;
  useEffect(() => {
    if (!enabled) onBlur();
  }, [enabled]);
```

(`onBlur` already releases the hint; reuse it.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/useQuizKeyboard.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the whole suite, lint and commit**

Run: `npm test`
Expected: all tests pass (existing trainers do not pass `enabled`, so their
behaviour is unchanged).

Run: `npm run lint`
Expected: no errors.

```bash
git add src/hooks/useQuizKeyboard.ts src/__tests__/useQuizKeyboard.test.tsx
git commit -F <message file>
```

Message:

```
Let useQuizKeyboard be suspended

An enabled option, default true, makes the window-level handler
ignore key presses and release a held hint. The trainers need it
while the settings dialog is open.
```

---

### Task 4: Wire the dialog and stats card into both trainers

**Files:**
- Modify: `src/components/quiz/TrainerHeader.tsx`
- Modify: `src/components/quiz/SettingsParts.tsx`
- Modify: `src/components/intervals/IntervalTrainer.tsx`
- Modify: `src/components/notes/NoteTrainer.tsx`
- Test: `src/__tests__/IntervalTrainer.test.tsx`
- Test: `src/__tests__/NoteTrainer.test.tsx`

`TrainerHeader`'s props change, so both trainers must change in the same
commit to keep the build green.

- [ ] **Step 1: Write the failing Interval trainer tests**

In `src/__tests__/IntervalTrainer.test.tsx`, change the first import line
to add `within`:

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react';
```

Add these tests inside the `describe('IntervalTrainer', ...)` block, after
the `'explains when no question fits'` test:

```tsx
  it('opens settings in a modal dialog and closes it', () => {
    render(<IntervalTrainer rng={seededRng(4)} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    // Not the "String pairs" group: Field and Segmented both carry that name.
    expect(within(dialog).getByRole('button', { name: 'Skip one' }))
      .toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent(
      screen.getByRole('dialog'), new Event('cancel', { cancelable: true }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies a setting from the dialog live, without closing', () => {
    render(<IntervalTrainer rng={seededRng(4)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip one' }));
    const saved = JSON.parse(localStorage.getItem(INTERVAL_STORAGE_KEY) ?? '{}');
    expect(saved.set.pairs).toBe('skip1');
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows session stats and reset on the page, outside settings', () => {
    render(<IntervalTrainer rng={seededRng(11)} />);
    const card = screen.getByRole('region', { name: 'Session stats' });
    expect(within(card).getAllByRole('meter')).toHaveLength(12);

    fireEvent.keyDown(window, { key: KEYS[askedSemis()] });
    expect(within(card).getByTestId('stats-line'))
      .toHaveTextContent('Streak 1 · best 1 · 100% of 1');
    fireEvent.click(within(card).getByRole('button', { name: 'Reset session stats' }));
    expect(within(card).getByTestId('stats-line'))
      .toHaveTextContent('No answers yet this session');

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).queryByRole('meter')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Reset session stats' }))
      .not.toBeInTheDocument();
  });

  it('ignores answer keys while settings are open', () => {
    render(<IntervalTrainer rng={seededRng(11)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.keyDown(window, { key: KEYS[askedSemis()] });
    expect(screen.getByTestId('feedback')).toBeEmptyDOMElement();
    expect(screen.getByTestId('stats-line'))
      .toHaveTextContent('No answers yet this session');
  });

  it('holds auto-advance while settings are open', () => {
    render(<IntervalTrainer rng={seededRng(11)} />);
    fireEvent.keyDown(window, { key: KEYS[askedSemis()] });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    act(() => { vi.advanceTimersByTime(1099); });
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Write the failing Note trainer tests**

In `src/__tests__/NoteTrainer.test.tsx`, change the first import line to:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
```

Add these tests inside the `describe('NoteTrainer', ...)` block, after the
`'Find on string: highlights the target string'` test:

```tsx
  it('opens settings in a modal dialog and closes it', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByRole('group', { name: 'Strings in scope' }))
      .toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close settings' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies a setting from the dialog live, without closing', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'B string' }));
    const saved = JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) ?? '{}');
    expect(saved.set.strings).toEqual([true, true, true, true, false, true]);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows session stats and reset on the page, outside settings', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    const card = screen.getByRole('region', { name: 'Session stats' });
    expect(within(card).getAllByRole('meter')).toHaveLength(12);
    expect(within(card).getByRole('button', { name: 'Reset session stats' }))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).queryByRole('meter')).not.toBeInTheDocument();
  });

  it('ignores answer keys while settings are open', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    const dot = screen.getByTestId('dot-target');
    const pc = pitchClass(Number(dot.dataset.s), Number(dot.dataset.f));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.keyDown(window, { key: KEYS[pc] });
    expect(screen.getByTestId('feedback')).toBeEmptyDOMElement();
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/IntervalTrainer.test.tsx src/__tests__/NoteTrainer.test.tsx`
Expected: the nine new tests FAIL (no element with role `dialog`; no region
named "Session stats"; the answer key is accepted while settings are open).
The existing tests still pass.

- [ ] **Step 4: Update `TrainerHeader`**

In `src/components/quiz/TrainerHeader.tsx`:

Replace the last three props of `TrainerHeaderProps`

```ts
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  drawerId: string;
```

with

```ts
  onOpenSettings: () => void;
```

Replace the destructuring

```tsx
export function TrainerHeader({
  kicker, title, sub, controls, pause, onTogglePause, drawerOpen,
  onToggleDrawer, drawerId,
}: TrainerHeaderProps) {
```

with

```tsx
export function TrainerHeader({
  kicker, title, sub, controls, pause, onTogglePause, onOpenSettings,
}: TrainerHeaderProps) {
```

Replace the Settings button

```tsx
        <button
          type="button"
          className="btn btn-secondary"
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          onClick={onToggleDrawer}
        >
```

with

```tsx
        <button
          type="button"
          className="btn btn-secondary"
          aria-haspopup="dialog"
          onClick={onOpenSettings}
        >
```

- [ ] **Step 5: Delete `SettingsDrawer`**

In `src/components/quiz/SettingsParts.tsx`, delete the whole
`SettingsDrawer` function and its doc comment (from
`/** Collapsible settings card with the tuning note and stats reset. */`
to the end of the file). `Field`, `FretInput`, `FretPair`, `PerItemRow` and
`PerItemStats` stay. The file's imports are still all used.

- [ ] **Step 6: Update `IntervalTrainer`**

In `src/components/intervals/IntervalTrainer.tsx`:

1. Replace the `SettingsParts` import

```tsx
import {
  Field, FretInput, FretPair, PerItemStats, SettingsDrawer,
} from '@/components/quiz/SettingsParts';
```

with

```tsx
import { SessionStatsCard } from '@/components/quiz/SessionStatsCard';
import { SettingsDialog } from '@/components/quiz/SettingsDialog';
import { Field, FretInput, FretPair } from '@/components/quiz/SettingsParts';
```

2. In the `@/lib/stats` import, drop `statsLine`:

```tsx
import { itemPercent } from '@/lib/stats';
```

3. Delete the line `const DRAWER_ID = 'interval-settings';`.

4. Replace `const [drawer, setDrawer] = useState(false);` with

```tsx
  const [settingsOpen, setSettingsOpen] = useState(false);
```

5. Replace the `useAutoAdvance` and `useQuizKeyboard` calls' opening lines

```tsx
  useAutoAdvance(state.advanceMs, next);
  useQuizKeyboard({
    answered,
```

with

```tsx
  // The quiz waits while the settings dialog covers it.
  useAutoAdvance(settingsOpen ? null : state.advanceMs, next);
  useQuizKeyboard({
    enabled: !settingsOpen,
    answered,
```

6. In the `<TrainerHeader ... />` element, replace

```tsx
        drawerOpen={drawer}
        onToggleDrawer={() => setDrawer(d => !d)}
        drawerId={DRAWER_ID}
```

with

```tsx
        onOpenSettings={() => setSettingsOpen(true)}
```

7. Replace the drawer block's opening

```tsx
      {drawer && (
        <SettingsDrawer
          id={DRAWER_ID}
          footnote="Standard tuning · E A D G B E · low E drawn on the bottom"
          onReset={() => dispatch({ type: 'resetStats' })}
        >
```

with

```tsx
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        footnote="Standard tuning · E A D G B E · low E drawn on the bottom"
      >
```

and re-indent the children one level left (two spaces less).

8. Delete the stats field from the dialog body:

```tsx
          <Field label="Session · per interval">
            <PerItemStats
              labelWidth={34}
              rows={pool.map(semis => ({
                label: INTERVAL_NAMES[semis], pct: itemPercent(stats, semis),
              }))}
            />
          </Field>
```

9. Replace the drawer block's closing

```tsx
        </SettingsDrawer>
      )}
```

with

```tsx
      </SettingsDialog>
```

10. Replace the stats paragraph

```tsx
        <p className="text-muted m-0 px-1 text-[12px]" data-testid="stats-line">
          {statsLine(stats)} · per-interval breakdown in Settings
        </p>
```

with

```tsx
        <SessionStatsCard
          stats={stats}
          itemLabel="Per interval"
          labelWidth={34}
          rows={pool.map(semis => ({
            label: INTERVAL_NAMES[semis], pct: itemPercent(stats, semis),
          }))}
          onReset={() => dispatch({ type: 'resetStats' })}
        />
```

- [ ] **Step 7: Update `NoteTrainer`**

In `src/components/notes/NoteTrainer.tsx`:

1. Replace the `SettingsParts` import

```tsx
import {
  Field, FretInput, FretPair, PerItemStats, SettingsDrawer,
} from '@/components/quiz/SettingsParts';
```

with

```tsx
import { SessionStatsCard } from '@/components/quiz/SessionStatsCard';
import { SettingsDialog } from '@/components/quiz/SettingsDialog';
import { Field, FretInput, FretPair } from '@/components/quiz/SettingsParts';
```

2. In the `@/lib/stats` import, drop `statsLine`:

```tsx
import { itemPercent } from '@/lib/stats';
```

3. Delete the line `const DRAWER_ID = 'note-settings';`.

4. Replace `const [drawer, setDrawer] = useState(false);` with

```tsx
  const [settingsOpen, setSettingsOpen] = useState(false);
```

5. Replace

```tsx
  useAutoAdvance(state.advanceMs, next);
  useQuizKeyboard({
    answered,
```

with

```tsx
  // The quiz waits while the settings dialog covers it.
  useAutoAdvance(settingsOpen ? null : state.advanceMs, next);
  useQuizKeyboard({
    enabled: !settingsOpen,
    answered,
```

6. In the `<TrainerHeader ... />` element, replace

```tsx
        drawerOpen={drawer}
        onToggleDrawer={() => setDrawer(d => !d)}
        drawerId={DRAWER_ID}
```

with

```tsx
        onOpenSettings={() => setSettingsOpen(true)}
```

7. Replace the drawer block's opening

```tsx
      {drawer && (
        <SettingsDrawer
          id={DRAWER_ID}
          footnote="Standard tuning · E A D G B E · low E drawn on the bottom · sharps and flats both accepted"
          onReset={() => dispatch({ type: 'resetStats' })}
        >
```

with

```tsx
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        footnote="Standard tuning · E A D G B E · low E drawn on the bottom · sharps and flats both accepted"
      >
```

and re-indent the children one level left (two spaces less).

8. Delete the stats field from the dialog body:

```tsx
          <Field label="Session · per note">
            <PerItemStats
              labelWidth={52}
              rows={NOTE_LABELS.map((label, pc) => ({ label, pct: itemPercent(stats, pc) }))}
            />
          </Field>
```

9. Replace the drawer block's closing

```tsx
        </SettingsDrawer>
      )}
```

with

```tsx
      </SettingsDialog>
```

10. Replace the stats paragraph

```tsx
        <p className="text-muted m-0 px-1 text-[12px]" data-testid="stats-line">
          {statsLine(stats)} · per-note breakdown in Settings
        </p>
```

with

```tsx
        <SessionStatsCard
          stats={stats}
          itemLabel="Per note"
          labelWidth={52}
          rows={NOTE_LABELS.map((label, pc) => ({ label, pct: itemPercent(stats, pc) }))}
          onReset={() => dispatch({ type: 'resetStats' })}
        />
```

- [ ] **Step 8: Run the trainer tests to verify they pass**

Run: `npx vitest run src/__tests__/IntervalTrainer.test.tsx src/__tests__/NoteTrainer.test.tsx`
Expected: PASS — 13 Interval tests, 8 Note tests.

If a test fails, fix the production code; do not weaken the test.

- [ ] **Step 9: Run everything**

Run: `npm test`
Expected: all tests pass.

Run: `npm run lint`
Expected: no errors (in particular no unused imports left in the trainers
or `SettingsParts.tsx`).

Run (unsandboxed): `npm run build`
Expected: the static export completes with no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/quiz/TrainerHeader.tsx src/components/quiz/SettingsParts.tsx src/components/intervals/IntervalTrainer.tsx src/components/notes/NoteTrainer.tsx src/__tests__/IntervalTrainer.test.tsx src/__tests__/NoteTrainer.test.tsx
git commit -F <message file>
```

Message:

```
Open settings in a dialog; move stats to the page

Both trainers replace the inline settings drawer with SettingsDialog
and show session stats, the per-item bars and the reset button in a
SessionStatsCard below the board. Quiz shortcuts and auto-advance
are held while the dialog is open. SettingsDrawer is removed.
```

---

### Task 5: Browser verification and docs

**Files:**
- Modify: `CLAUDE.md`

A UI change must be checked in a real browser. Use the `local-server` skill
to manage the dev server and the Playwright browser tools to drive it.

- [ ] **Step 1: Start the dev server**

Run (unsandboxed, in the background): `npm run dev`
Read its output and confirm the actual host and port (Next.js moves off
3000 if it is taken).

- [ ] **Step 2: Check `/intervals` at desktop width (1280×800)**

Verify each of these, and take a screenshot of the open dialog and of the
page bottom:

1. No settings card is on the page; a "Session stats" card with the summary
   line, 12 bars and "Reset session stats" sits below the fretboard.
2. Clicking **Settings** opens a centered dialog over a dimmed page, with
   String pairs, Fret range, Display and Intervals in the pool, the tuning
   note and **Done**. It has no stats bars and no reset button.
3. Focus is inside the dialog; Tab stays inside it.
4. Clicking **Skip one** selects it and the dialog stays open.
5. Typing `12` in the "Highest fret" field does not answer the question
   behind the dialog.
6. **Esc** closes the dialog and focus returns to the Settings button.
7. Reopen; clicking the dimmed backdrop closes it. Reopen; ✕ closes it.
   Reopen; **Done** closes it.
8. With the dialog open, the page behind does not scroll.
9. Answer a question correctly, open Settings before the 1.1 s advance, wait
   3 s, and confirm the same answered question is still there on close and
   then advances.
10. Answer a few questions; the bars and summary update; **Reset session
    stats** clears them.

- [ ] **Step 3: Check `/intervals` at phone width (390×844)**

1. The dialog is nearly full width with a 16px margin, fields are in one
   column, and its body scrolls if it is taller than the screen while the
   heading and Done stay visible.
2. The stats card fits without horizontal page scroll.

- [ ] **Step 4: Repeat steps 2 and 3 on `/notes`**

The dialog there holds Strings in scope, Board window and Target range. Use
the **B** string chip in place of "Skip one", and the "Highest fret shown"
field in place of "Highest fret".

- [ ] **Step 5: Check the browser console**

Expected: no errors or warnings on either page.

- [ ] **Step 6: Fix anything found**

For each defect: add or adjust a test where it can be tested in jsdom, fix
the production code, rerun `npm test` and `npm run lint`, and recheck in the
browser. Commit fixes separately with a message describing the defect.

- [ ] **Step 7: Stop the dev server**

Stop the background task, then confirm nothing is listening on the port
with `ss -tlnp`.

- [ ] **Step 8: Update `CLAUDE.md`**

In the `## Layout` section, replace

```markdown
- `src/components/quiz/` — header, answer card/grid, board frame with
  hold-for-hint, settings drawer parts.
- `src/hooks/` — `useQuizKeyboard`, `useAutoAdvance`, `usePersist`.
```

with

```markdown
- `src/components/quiz/` — header, answer card/grid, board frame with
  hold-for-hint, `SettingsDialog` (native modal `<dialog>`) and its field
  parts, `SessionStatsCard` (summary, reset and per-item bars below the
  board).
- `src/hooks/` — `useQuizKeyboard`, `useAutoAdvance`, `usePersist`. Trainers
  suspend the first two while the settings dialog is open.
```

In the `## Testing` section, add to the end of its paragraph:

```markdown
jsdom has no `dialog.showModal()` / `close()`, so `setup.ts` also shims
them with the `open` attribute.
```

- [ ] **Step 9: Final verification**

Run: `npm run lint` — expected: no errors.
Run: `npm test` — expected: all tests pass.
Run (unsandboxed): `npm run build` — expected: static export completes.

- [ ] **Step 10: Commit**

```bash
git add CLAUDE.md
git commit -F <message file>
```

Message:

```
Document the settings dialog and stats card
```

---

## Done when

- Settings open in a centered modal dialog on both trainers; Esc, backdrop,
  ✕ and Done close it; settings apply live.
- Session stats, per-item bars and reset are on the page below the board
  and absent from the dialog.
- Quiz shortcuts and auto-advance are held while the dialog is open.
- `npm run lint`, `npm test` and `npm run build` are clean, and both pages
  were checked in a browser at desktop and phone widths.
