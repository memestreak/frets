import { toneColor } from './chordDots';
import type { ChordInfo } from './chordTypes';

/**
 * The chord's tones as colour swatches with their labels (■ R ● ♭3 ● 5 ● ♭7),
 * naming the colours of the unlabelled dots in `ChordDiagram`. The root's
 * swatch is square, as its dot is.
 */
export function ToneKey({ chord }: { chord: ChordInfo }) {
  return (
    <ul className="tone-key" aria-label="Dot colours">
      {chord.tones.map(tone => (
        <li key={tone.semis}>
          <span
            className={tone.label === 'R' ? 'tone-swatch tone-swatch-root' : 'tone-swatch'}
            style={{ background: toneColor(tone).fill }}
            aria-hidden="true"
          />
          {tone.label}
        </li>
      ))}
    </ul>
  );
}
