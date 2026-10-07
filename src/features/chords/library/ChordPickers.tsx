import { prettyNote } from '@/lib/notation';
import {
  CHORD_GROUPS, CHORD_ROOTS, CHORD_TYPES, type ChordRoot,
} from '@/lib/chords/chordTypes';

interface ChordPickersProps {
  root: ChordRoot;
  typeId: string;
  onRoot: (root: ChordRoot) => void;
  onType: (typeId: string) => void;
}

/** The Root and Type dropdowns beside the page title. Types are grouped. */
export function ChordPickers({ root, typeId, onRoot, onType }: ChordPickersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <label className="flex items-center gap-2">
        <span className="field-label m-0 max-[480px]:sr-only">Root</span>
        <select
          className="input w-auto" value={root}
          onChange={e => onRoot(e.target.value as ChordRoot)}
        >
          {CHORD_ROOTS.map(r => <option key={r} value={r}>{prettyNote(r)}</option>)}
        </select>
      </label>
      <label className="flex min-w-0 items-center gap-2">
        <span className="field-label m-0 max-[480px]:sr-only">Type</span>
        <select
          className="input w-auto min-w-0 max-w-[16rem]" value={typeId}
          onChange={e => onType(e.target.value)}
        >
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
