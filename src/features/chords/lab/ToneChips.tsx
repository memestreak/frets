import { toneColor } from '@/components/chords/chordDots';
import { plainToneLabel, type ChordInfo } from '@/lib/chords/chordTypes';

interface ToneChipsProps {
  chord: ChordInfo;
  /** Called with the semitones above the root of the chip pressed. */
  onToggle: (semis: number) => void;
}

const SEMITONES = Array.from({ length: 12 }, (_, i) => i);

/**
 * Twelve chips, one per tone above the root, on when the chord has it.
 * Labels are the chord's own (♯9, not ♭3) where it has the tone, plain
 * interval names elsewhere. The root is always on.
 */
export function ToneChips({ chord, onToggle }: ToneChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chord tones">
      {SEMITONES.map(semis => {
        const tone = chord.tones.find(t => t.semis === semis);
        const color = tone && toneColor(tone);
        return (
          <button
            key={semis} type="button" className="tone-chip"
            aria-pressed={Boolean(tone)} disabled={semis === 0}
            style={color && { background: color.fill, color: color.fg }}
            onClick={() => onToggle(semis)}
          >
            {tone?.label ?? plainToneLabel(semis)}
          </button>
        );
      })}
    </div>
  );
}
