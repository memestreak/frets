'use client';

/**
 * The plain controls a Settings field can use, shared by every page's group. Each copies the control
 * its shortcut on the page uses (G7): a check box for what a menu or panel ticks, a segmented choice
 * for what the page picks with one. A page's own controls (number fields, knobs) are made where the
 * page's group is.
 */
import { Segmented } from '@/components/controls';
import type { SettingsField } from './types';

/**
 * A check box with no label of its own: its row's label names it (`aria-labelledby`), and a
 * double-click on that label resets it instead of ticking it.
 */
export function CheckBox({ on, onChange, labelledBy, disabled }: {
  on: boolean;
  onChange: (on: boolean) => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button" role="checkbox" aria-checked={on} aria-labelledby={labelledBy} disabled={disabled}
      className="settings-check" onClick={() => onChange(!on)}
    >
      {on && (
        <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
          <path d="m2 6.5 2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/** A field that is on or off, as a check box. */
export function checkField<V, K extends keyof V & string>(
  key: K, label: string, opts: { enabled?: (value: V) => boolean } = {},
): SettingsField<V> {
  return {
    key, label, ...opts,
    control: ({ value, set, labelId, disabled }) => (
      <CheckBox
        on={value[key] === true} labelledBy={labelId} disabled={disabled}
        onChange={on => set({ ...value, [key]: on })}
      />
    ),
  };
}

/**
 * A field picked from a few choices, as a segmented control. `write` stages the pick when choosing it
 * changes more than the field (Custom colours start from the ones shown).
 */
export function choiceField<V, K extends keyof V & string, T extends string | number>(
  key: K, label: string, options: readonly (readonly [T, string])[],
  opts: { enabled?: (value: V) => boolean; write?: (value: V, choice: T) => V } = {},
): SettingsField<V> {
  const { write = (value: V, choice: T) => ({ ...value, [key]: choice }), ...rest } = opts;
  return {
    key, label, ...rest,
    control: ({ value, set, disabled }) => (
      <Segmented label={label} value={value[key] as T} options={options} disabled={disabled} onChange={c => set(write(value, c))} />
    ),
  };
}
