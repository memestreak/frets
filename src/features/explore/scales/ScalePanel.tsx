import type { Degree } from '@/components/fretboard/theme';
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
}

/** The root and scale dropdowns, beside the page title. */
export function ScalePickers({ scale, onRoot, onScale }: ScalePickersProps) {
  return (
    <div className="flex items-center gap-x-4">
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
    </div>
  );
}
