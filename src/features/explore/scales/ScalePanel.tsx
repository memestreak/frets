import { ResetIcon } from '@/components/icons';
import { prettyNote } from '@/lib/notation';
import {
  ROOTS, SCALE_GROUPS, SCALES, type Root, type Scale,
} from './theory';

interface ScalePickersProps {
  scale: Scale;
  onRoot: (root: Root) => void;
  onScale: (id: string) => void;
  /** The picked scale's title while rotated away from it, else null. */
  home: string | null;
  onReset: () => void;
}

/**
 * The root and scale dropdowns beside the page title, and Reset while a
 * tapped strip note has rotated the scale.
 */
export function ScalePickers({
  scale, onRoot, onScale, home, onReset,
}: ScalePickersProps) {
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
