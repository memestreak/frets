import type { Degree } from '@/components/fretboard/theme';
import { ChordLadder } from './ChordLadder';
import {
  prettyNote, ROOTS, SCALE_GROUPS, SCALES, type Root, type Scale,
} from './theory';

/** Degree colours by degree number 1–7. */
export const DEGREES: readonly Degree[] = [
  'root', 'second', 'third', 'extension', 'fifth', 'sixth', 'seventh',
];

interface ScalePanelProps {
  scale: Scale;
  onRoot: (root: Root) => void;
  onScale: (id: string) => void;
}

/**
 * The root and scale dropdowns with the scale's formula, over the scale as a
 * one-octave strip drawn like the chords section's ladder.
 */
export function ScalePanel({ scale, onRoot, onScale }: ScalePanelProps) {
  return (
    <section className="card gap-3" aria-label="Root and scale">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
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
        <label className="flex items-center gap-2">
          <span className="field-label m-0 max-[480px]:sr-only">Scale</span>
          <select
            className="input w-auto"
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
        <p className="m-0 flex items-baseline gap-2">
          <span className="field-label m-0">Formula</span>
          <span
            className="font-(family-name:--font-mono) text-[14px] font-medium"
            data-testid="scale-formula"
          >
            {scale.degrees.map(d => d.label).join(' ')}
          </span>
        </p>
      </div>
      <ChordLadder scale={scale} chord={null} intervals="root" octaves={1} />
    </section>
  );
}
