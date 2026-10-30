import { useId } from 'react';
import { ResetIcon } from '@/components/icons';
import { KeyPicker } from '@/components/KeyPicker';
import {
  SCALE_GROUPS, SCALES, type Root, type Scale,
} from '@/lib/theory/scales';

interface ScalePickersProps {
  scale: Scale;
  onRoot: (root: Root) => void;
  onScale: (id: string) => void;
  /** The picked scale's title while rotated away from it, else null. */
  home: string | null;
  onReset: () => void;
}

/**
 * The root picker and the scale dropdown, each labelled from the top, and
 * Reset while a tapped strip note has rotated the scale. Four grid cells
 * (labels and controls apart) for the header to place: on a wide screen the
 * labels end the title's row and the controls share the strip's.
 */
export function ScalePickers({
  scale, onRoot, onScale, home, onReset,
}: ScalePickersProps) {
  const selectId = useId();
  return (
    <>
      {/* The picker names itself (aria-label "Root"); this is the visible label. */}
      <span className="field-label scale-head-root-label" aria-hidden>Root</span>
      <div className="scale-head-root">
        <KeyPicker value={scale.root} onPick={n => onRoot(n as Root)} />
      </div>
      <label htmlFor={selectId} className="field-label scale-head-scale-label">Scale</label>
      <div className="scale-head-scale flex items-start gap-2">
        <select
          id={selectId} className="input w-auto min-w-0"
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
        {/* Holds its place when hidden, so nothing shifts as it comes and goes. */}
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
