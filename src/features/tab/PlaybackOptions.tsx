'use client';

/**
 * The playback options, from a right-click on Play (Jeremy, 2026-10-27): whether Stop leaves the
 * playback line where the playhead stopped, whether playback stops at a selected region's end, and
 * whether loops rest between rounds and for how long.
 * A small menu at the press, like the shapes' menu; it stays open while its options are changed, and
 * a press elsewhere, a scroll or Esc closes it.
 */
import { NumberField } from './NumberField';
import { usePopover } from './usePopover';

/** The rest between loops, in seconds: its range and step. */
export const MIN_LOOP_PAUSE = 0.5;
export const MAX_LOOP_PAUSE = 10;
const LOOP_PAUSE_STEP = 0.5;

export interface PlaybackOptionValues {
  /** Stop puts the playback line where the playhead was, so the next Play goes on from there. */
  stopAtPlayhead: boolean;
  /** With a region selected, playback stops at its end instead of playing on (Jeremy, 2026-10-28). */
  stopAtRegionEnd: boolean;
  /** Loops rest between rounds, for `loopPauseSeconds`. */
  loopPause: boolean;
  loopPauseSeconds: number;
}

function Check({ on }: { on: boolean }) {
  return (
    <span className="tab-options-check" aria-hidden="true">
      {on && <svg width={12} height={12} viewBox="0 0 12 12"><path d="m2 6.5 2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </span>
  );
}

export function PlaybackOptions({ x, y, values, onChange, onClose }: {
  /** Where it opens, in viewport pixels: its corner at the press, kept on screen. */
  x: number;
  y: number;
  values: PlaybackOptionValues;
  onChange: (values: PlaybackOptionValues) => void;
  onClose: () => void;
}) {
  const { ref, style } = usePopover({ x, y, focus: '[role="menuitemcheckbox"]', onClose: () => onClose() });

  return (
    <div
      ref={ref} role="menu" aria-label="Playback options" className="shape-menu tab-options" style={style}
      tabIndex={-1}
      onContextMenu={e => e.preventDefault()}
      // The page's keys (Space plays) stay out while the menu has the focus; Esc closes it.
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
    >
      <button
        type="button" role="menuitemcheckbox" aria-checked={values.stopAtPlayhead} className="shape-menu-item tab-options-item"
        onClick={() => onChange({ ...values, stopAtPlayhead: !values.stopAtPlayhead })}
      >
        <Check on={values.stopAtPlayhead} />
        Stop leaves the cursor where it stopped
      </button>
      <button
        type="button" role="menuitemcheckbox" aria-checked={values.stopAtRegionEnd} className="shape-menu-item tab-options-item"
        onClick={() => onChange({ ...values, stopAtRegionEnd: !values.stopAtRegionEnd })}
      >
        <Check on={values.stopAtRegionEnd} />
        Stop playback at region end
      </button>
      <div className="tab-options-row">
        <button
          type="button" role="menuitemcheckbox" aria-checked={values.loopPause} className="shape-menu-item tab-options-item"
          onClick={() => onChange({ ...values, loopPause: !values.loopPause })}
        >
          <Check on={values.loopPause} />
          Pause between loops
        </button>
        <NumberField
          value={values.loopPauseSeconds} min={MIN_LOOP_PAUSE} max={MAX_LOOP_PAUSE} step={LOOP_PAUSE_STEP} decimals={1} unit="s"
          label="Pause between loops (seconds)" upLabel="Longer pause" downLabel="Shorter pause"
          onChange={loopPauseSeconds => onChange({ ...values, loopPauseSeconds })}
        />
      </div>
    </div>
  );
}
