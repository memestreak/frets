import { useId } from 'react';
import type { Degree } from '@/components/fretboard/theme';
import { ChevronLeftIcon, ChevronRightIcon, ResetIcon } from '@/components/icons';
import {
  prettyNote, ROOTS, SCALE_GROUPS, SCALES, type Root, type Scale,
} from './theory';

/** Degree colours by degree number 1–7. */
export const DEGREES: readonly Degree[] = [
  'root', 'second', 'third', 'extension', 'fifth', 'sixth', 'seventh',
];

interface ScalePickersProps {
  scale: Scale;
  onRoot: (root: Root) => void;
  onScale: (id: string) => void;
  /** Titles of the modes either side, or null where the scale has none. */
  modes: { prev: string; next: string } | null;
  onRotate: (dir: 1 | -1) => void;
  /** The picked scale's title while rotated away from it, else null. */
  home: string | null;
  onReset: () => void;
}

/** The root and scale dropdowns and Rotate mode, beside the page title. */
export function ScalePickers({
  scale, onRoot, onScale, modes, onRotate, home, onReset,
}: ScalePickersProps) {
  const rotateId = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <label className="flex items-center gap-2">
        <span className="field-label m-0 max-[480px]:sr-only">Root</span>
        <select
          className="input w-auto"
          value={scale.root}
          onChange={e => onRoot(e.target.value as Root)}
        >
          {ROOTS.map(r => <option key={r} value={r}>{prettyNote(r)}</option>)}
        </select>
      </label>
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
      {/* Two bare arrows would be unclear, so this label stays on phones. */}
      <div role="group" aria-labelledby={rotateId} className="flex items-center gap-2">
        <span id={rotateId} className="field-label m-0">Rotate mode</span>
        <div className="mode-steps">
          <button
            type="button" className="btn btn-secondary btn-icon" disabled={!modes}
            aria-label={modes ? `Previous mode: ${modes.prev}` : 'Previous mode'}
            title={modes?.prev ?? 'Only seven-note scales have modes'}
            onClick={() => onRotate(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button" className="btn btn-secondary btn-icon" disabled={!modes}
            aria-label={modes ? `Next mode: ${modes.next}` : 'Next mode'}
            title={modes?.next ?? 'Only seven-note scales have modes'}
            onClick={() => onRotate(1)}
          >
            <ChevronRightIcon />
          </button>
        </div>
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
    </div>
  );
}
