'use client';

/**
 * The View options panel (Jeremy, 2026-10-28), under the eye button over the clip: what the drawn
 * clip shows that is the reader's choice: bar numbers, and the drawing's size. A choice applies at once and is
 * remembered, and a press elsewhere or Esc closes the panel.
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
    </div>
  );
}
