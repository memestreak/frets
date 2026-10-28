'use client';

/**
 * The metronome's options, from a right-click on its toggle (issue #148; Jeremy picked a menu over a
 * second button, 2026-10-28): a count-in of 1 to 4 bars before Play, and how loud the clicks are, as a share
 * of the Volume knob. A small menu at the press, like Play's options; it stays open while its
 * options are changed, and a press elsewhere, a scroll or Esc closes it.
 */
import { NumberField } from './NumberField';
import { OptionCheck } from './PlaybackOptions';
import { usePopover } from './usePopover';
import { MAX_COUNT_IN_BARS } from './playback';

export function ClickOptions({ x, y, countIn, onCountIn, bars, onBars, volume, onVolume, onClose }: {
  /** Where it opens, in viewport pixels. */
  x: number;
  y: number;
  /** Play counts in a bar of clicks first. */
  countIn: boolean;
  onCountIn: (on: boolean) => void;
  /** How many bars it counts, 1 to 4. */
  bars: number;
  onBars: (bars: number) => void;
  /** The clicks' volume, 0 to 1. */
  volume: number;
  onVolume: (volume: number) => void;
  onClose: () => void;
}) {
  const { ref, style } = usePopover({ x, y, focus: '[role="menuitemcheckbox"]', onClose: () => onClose() });
  return (
    <div
      ref={ref} role="menu" aria-label="Metronome options" className="shape-menu tab-options" style={style}
      tabIndex={-1}
      onContextMenu={e => e.preventDefault()}
      // The page's keys (Space plays) stay out while the menu has the focus; Esc closes it.
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="tab-options-row">
        <button
          type="button" role="menuitemcheckbox" aria-checked={countIn} className="shape-menu-item tab-options-item"
          onClick={() => onCountIn(!countIn)}
        >
          <OptionCheck on={countIn} />
          Count in
        </button>
        <NumberField
          value={bars} min={1} max={MAX_COUNT_IN_BARS} step={1}
          label="Count-in bars" upLabel="More bars" downLabel="Fewer bars" onChange={onBars}
        />
        <span className="tab-options-unit">{bars === 1 ? 'bar' : 'bars'}</span>
      </div>
      <div className="tab-options-row tab-click-volume">
        <span>Click volume</span>
        <NumberField
          value={Math.round(volume * 100)} min={0} max={100} step={5} unit="%"
          label="Click volume (percent)" upLabel="Louder clicks" downLabel="Quieter clicks"
          onChange={percent => onVolume(percent / 100)}
        />
      </div>
    </div>
  );
}
