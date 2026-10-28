'use client';

/**
 * The View options panel (Jeremy, 2026-10-28), under the eye button over the clip: what each view
 * shows that is the reader's choice. Every view's options are always there, each view's under its
 * name: Notation (bar numbers, size), ASCII Tab (the rhythm line), AlphaTex (line numbers). A choice
 * applies at once and is remembered, and a press elsewhere or Esc closes the panel.
 */
import { NumberField, resetOnDoubleClick } from './NumberField';
import { BAR_NUMBER_NAMES, BAR_NUMBERS, DEFAULT_VIEW, MAX_SIZE, MIN_SIZE, SIZE_STEP, type TabView } from './viewOptions';
import { usePopover } from './usePopover';

export function ViewOptions({ x, y, values, onChange, onClose }: {
  /** Under its button: the panel's right edge at x, its top at y, in viewport pixels. */
  x: number;
  y: number;
  values: TabView;
  onChange: (values: TabView) => void;
  onClose: (pressedAway: boolean) => void;
}) {
  const { ref, style } = usePopover({ x, y, align: 'end', onClose });
  return (
    <div
      ref={ref} role="dialog" aria-label="View options" className="shape-menu tab-view-options" style={style} tabIndex={-1}
    >
      <h3 className="tab-view-heading">Notation</h3>
      <div className="tab-view-option">
        <span id="bar-numbers-label">Bar numbers</span>
        <div className="seg" role="group" aria-labelledby="bar-numbers-label">
          {BAR_NUMBERS.map(b => (
            <button
              key={b} type="button" className="seg-opt" aria-pressed={values.barNumbers === b}
              onClick={() => onChange({ ...values, barNumbers: b })}
            >
              {BAR_NUMBER_NAMES[b]}
            </button>
          ))}
        </div>
      </div>
      {/* A double-click on its row puts it back to 100%, as Speed's does. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a mouse shortcut only; from the keyboard, type 100 */}
      <div className="tab-view-option" role="group" aria-label="Size" onDoubleClick={e => resetOnDoubleClick(e, () => onChange({ ...values, size: DEFAULT_VIEW.size }))}>
        <span aria-hidden="true">Size</span>
        <NumberField
          value={values.size} min={MIN_SIZE} max={MAX_SIZE} step={SIZE_STEP} decimals={0} unit="%"
          label="Size (percent)" upLabel="Bigger" downLabel="Smaller"
          // A typed size goes to the nearest step.
          onChange={size => onChange({ ...values, size: Math.round(size / SIZE_STEP) * SIZE_STEP })}
        />
      </div>
      <h3 className="tab-view-heading">ASCII Tab</h3>
      <Toggle label="Rhythm" on={values.asciiRhythm} onChange={asciiRhythm => onChange({ ...values, asciiRhythm })} />
      <h3 className="tab-view-heading">AlphaTex</h3>
      <Toggle label="Line numbers" on={values.lineNumbers} onChange={lineNumbers => onChange({ ...values, lineNumbers })} />
    </div>
  );
}

/** An option that is on or off: a check box and its name, the whole row pressable. */
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="tab-view-toggle" onClick={() => onChange(!on)}>
      <span className="tab-view-box" aria-hidden="true">
        {on && <svg width={12} height={12} viewBox="0 0 12 12"><path d="m2 6.5 2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      {label}
    </button>
  );
}
