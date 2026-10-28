'use client';

/**
 * The View options panel (Jeremy, 2026-10-28), under the eye button over the clip: what the drawn
 * clip shows that is the reader's choice. Bar numbers for now; a choice applies at once and is
 * remembered, and a press elsewhere or Esc closes the panel.
 */
import { BAR_NUMBER_NAMES, BAR_NUMBERS, type TabView } from './viewOptions';
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
    </div>
  );
}
