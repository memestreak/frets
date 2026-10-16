import { KeyPicker } from '@/components/KeyPicker';
import {
  CHORD_GROUPS, CHORD_TYPES, type ChordRoot,
} from '@/lib/chords/chordTypes';

/** Chord roots have one spelling each: the picker's others map onto it. */
const ENHARMONIC: Partial<Record<string, ChordRoot>> = {
  'C#': 'Db', 'D#': 'Eb', Gb: 'F#', 'G#': 'Ab', 'A#': 'Bb',
};

interface ChordPickersProps {
  root: ChordRoot;
  /** '' for notes no type names: the menu shows "—". */
  typeId: string;
  onRoot: (root: ChordRoot) => void;
  onType: (typeId: string) => void;
}

/** The root picker and the Type dropdown beside the page title. Types are grouped. */
export function ChordPickers({ root, typeId, onRoot, onType }: ChordPickersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <KeyPicker
        value={root} resolve={n => ENHARMONIC[n] ?? n}
        onPick={n => onRoot(n as ChordRoot)}
      />
      <label className="flex min-w-0 items-center gap-2">
        <span className="field-label m-0 max-[480px]:sr-only">Type</span>
        <select
          className="input w-auto min-w-0 max-w-[16rem]" value={typeId}
          onChange={e => onType(e.target.value)}
        >
          {!typeId && <option value="" disabled>—</option>}
          {CHORD_GROUPS.map(g => (
            <optgroup key={g} label={g}>
              {CHORD_TYPES.filter(t => t.group === g).map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  );
}
