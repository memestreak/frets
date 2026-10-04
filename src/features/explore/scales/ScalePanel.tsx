import { degreeColor, type Degree } from '@/components/fretboard/theme';
import {
  prettyNote, ROOTS, SCALE_GROUPS, SCALES, type Root, type Scale,
} from './theory';

/** Degree colours by degree number 1–7. */
export const DEGREES: readonly Degree[] = [
  'root', 'second', 'third', 'extension', 'fifth', 'sixth', 'seventh',
];

/** The formula row's label for each semitone when the scale skips it. */
const SLOT_LABELS = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];

/** Naturals get a whole key; each black key is split into its ♯ and ♭ names. */
const KEYS: (Root | [Root, Root])[] = [];
for (const r of ROOTS) {
  const prev = KEYS.at(-1);
  if (r.endsWith('b') && typeof prev === 'string' && prev.endsWith('#')) {
    KEYS[KEYS.length - 1] = [prev, r];
  } else {
    KEYS.push(r);
  }
}

interface ScalePanelProps {
  scale: Scale;
  onRoot: (root: Root) => void;
  onScale: (id: string) => void;
}

/** Root keys, the scale list and the scale's formula across 12 semitones. */
export function ScalePanel({ scale, onRoot, onScale }: ScalePanelProps) {
  const rootKey = (r: Root, className: string) => (
    <button
      key={r} type="button" className={className}
      aria-pressed={r === scale.root} onClick={() => onRoot(r)}
    >
      {prettyNote(r)}
    </button>
  );
  const bySemis = new Map(scale.degrees.map(d => [d.semis, d]));

  return (
    <section className="card gap-4" aria-labelledby="scale-h">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <h2 id="scale-h" className="m-0 text-[17px] leading-6">Root and scale</h2>
        <label className="flex items-center gap-2">
          <span className="field-label m-0">Scale</span>
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
      </div>

      <div className="grid gap-1.5">
        <span className="field-label m-0" id="root-l">Root</span>
        <div className="root-row" role="group" aria-labelledby="root-l">
          {KEYS.map(k => (typeof k === 'string'
            ? rootKey(k, 'root-key')
            : (
              <div key={k[0]} className="root-split">
                {k.map(r => rootKey(r, 'root-key'))}
              </div>
            )))}
        </div>
      </div>

      {/* The formula is also spelled out in the title's facts, so this
          picture of it stays out of the accessibility tree. */}
      <div className="grid gap-1.5" aria-hidden="true">
        <span className="field-label m-0">Formula</span>
        <div className="formula-row">
          {SLOT_LABELS.map((fallback, semis) => {
            const d = bySemis.get(semis);
            const color = d && degreeColor(DEGREES[d.degree - 1]);
            return (
              <span
                key={semis}
                className="formula-chip"
                data-on={d ? 'true' : undefined}
                data-root={semis === 0 ? 'true' : undefined}
                style={color && { background: color.fill, color: color.fg }}
              >
                {d ? d.label : fallback}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
