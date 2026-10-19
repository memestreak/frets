import { ResetIcon } from '@/components/icons';
import { KeyPicker } from '@/components/KeyPicker';
import {
  SCALE_GROUPS, SCALES, type Root, type Scale,
} from './theory';

interface ScalePickersProps {
  scale: Scale;
  onRoot: (root: Root) => void;
  onScale: (id: string) => void;
  /** The picked scale's title while rotated away from it, else null. */
  home: string | null;
  onReset: () => void;
  /**
   * MOCK: how the pickers are laid out. inline: labels beside (today);
   * row: side by side, labels on top; stack: Root over Scale, labels on top;
   * cells: the labels and the controls as separate grid cells
   * (mock-rl, mock-rp, mock-sl, mock-sp) for the header to place.
   */
  layout?: 'inline' | 'row' | 'stack' | 'cells';
}

/**
 * The root picker and the scale dropdown beside the page title, and Reset while a
 * tapped strip note has rotated the scale.
 */
export function ScalePickers({
  scale, onRoot, onScale, home, onReset, layout = 'inline',
}: ScalePickersProps) {
  if (layout === 'cells') {
    return (
      <>
        <span id="root-label" className="field-label mock-rl">Root</span>
        <div className="mock-rp" role="group" aria-labelledby="root-label">
          <KeyPicker value={scale.root} onPick={n => onRoot(n as Root)} />
        </div>
        <label htmlFor="scale-select" className="field-label mock-sl">Scale</label>
        <div className="mock-sp flex items-start gap-2">
          <select
            id="scale-select" className="input w-auto min-w-0"
            value={scale.type.id}
            onChange={e => onScale(e.target.value)}
          >
            {SCALE_GROUPS.map(g => (
              <optgroup key={g} label={g}>
                {SCALES.filter(t => t.group === g).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button" className={`btn btn-ghost${home ? '' : ' invisible'}`}
            aria-label={home ? `Reset to ${home}` : undefined} title={home ?? undefined}
            aria-hidden={!home} tabIndex={home ? undefined : -1}
            onClick={onReset}
          >
            <ResetIcon />
            Reset
          </button>
        </div>
      </>
    );
  }
  if (layout !== 'inline') {
    const stack = layout === 'stack';
    return (
      <div className={stack
        ? 'grid w-[336px] max-w-full gap-3'
        : 'flex flex-wrap items-end gap-x-4 gap-y-3'}
      >
        <div role="group" aria-labelledby="root-label">
          <span id="root-label" className="field-label">Root</span>
          <KeyPicker value={scale.root} onPick={n => onRoot(n as Root)} />
        </div>
        {stack ? (
          <div className="relative">
            <label className="block">
              <span className="field-label">Scale</span>
              <select
              className={`input min-w-0 ${stack ? 'w-full' : 'w-auto'}`}
              value={scale.type.id}
              onChange={e => onScale(e.target.value)}
            >
              {SCALE_GROUPS.map(g => (
                <optgroup key={g} label={g}>
                  {SCALES.filter(t => t.group === g).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            </label>
            {/* Beside the label, so the dropdown keeps its width. */}
            <button
              type="button"
              className={`absolute top-0 right-0 flex items-center gap-1 text-[13px] leading-4 font-semibold text-(--ink-muted) hover:text-(--ink)${home ? '' : ' invisible'}`}
              aria-label={home ? `Reset to ${home}` : undefined} title={home ?? undefined}
              aria-hidden={!home} tabIndex={home ? undefined : -1}
              onClick={onReset}
            >
              <ResetIcon />
              Reset
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 items-end gap-2">
            <label className="block min-w-0">
              <span className="field-label">Scale</span>
              <select
              className={`input min-w-0 ${stack ? 'w-full' : 'w-auto'}`}
              value={scale.type.id}
              onChange={e => onScale(e.target.value)}
            >
              {SCALE_GROUPS.map(g => (
                <optgroup key={g} label={g}>
                  {SCALES.filter(t => t.group === g).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            </label>
            <button
            type="button" className={`btn btn-ghost${home ? '' : ' invisible'}`}
            aria-label={home ? `Reset to ${home}` : undefined} title={home ?? undefined}
            aria-hidden={!home} tabIndex={home ? undefined : -1}
            onClick={onReset}
          >
            <ResetIcon />
            Reset
          </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <KeyPicker value={scale.root} onPick={n => onRoot(n as Root)} />
      <label className="flex min-w-0 items-center gap-2">
        <span className="field-label m-0 max-[480px]:sr-only">Scale</span>
        <select
          className="input w-auto min-w-0"
          value={scale.type.id}
          onChange={e => onScale(e.target.value)}
        >
          {SCALE_GROUPS.map(g => (
            <optgroup key={g} label={g}>
              {SCALES.filter(t => t.group === g).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {/* Holds its place when hidden, so nothing shifts as it comes and goes;
          on phones, where it wraps to a line of its own, it takes no room. */}
      <button
        type="button" className={`btn btn-ghost${home ? '' : ' invisible max-[480px]:hidden'}`}
        aria-label={home ? `Reset to ${home}` : undefined} title={home ?? undefined}
        aria-hidden={!home} tabIndex={home ? undefined : -1}
        onClick={onReset}
      >
        <ResetIcon />
        Reset
      </button>
    </div>
  );
}
