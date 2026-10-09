'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Segmented } from '@/components/controls';
import {
  keyForMode, keyWheel, MAJOR_KEYS, modeForKey, modeWheel,
  type Cell, type Key, type KeyOptions, type ModeId, type Ring, type RingNote,
} from './circle';
import { CircleWheel } from './CircleWheel';
import { HoverTips } from './HoverTips';
import { KeyPanel } from './KeyPanel';
import { ModePanel } from './ModePanel';

/** The plain circle of keys, or the Advanced view: modes, with the ring and table. */
type View = 'key' | 'advanced';
const VIEW_PARAM = 'view';
const VIEW_OPTS = [['key', 'Circle'], ['advanced', 'Advanced']] as const;
/** The rings a tap can pick from: the Circle's major and minor keys, the Advanced view's roots. */
const PICKABLE: Record<View, readonly Ring[]> = { key: ['major', 'minor'], advanced: ['major'] };

const C_MAJOR: Key = { spoke: 0, minor: false };
/** The Advanced view's mode: its root in tonal ASCII ("C#", "E#") and the mode. */
interface Modal {
  root: string;
  mode: ModeId;
}
const C_DORIAN: Modal = { root: 'C', mode: 'dorian' };

interface Toggles extends KeyOptions {
  signatures: boolean;
}
const ALL_OFF: Toggles = { signatures: false, allNumerals: false, parallel: false, dominants: false };

/**
 * The circle of fifths page. The view (Circle or Advanced) is in the URL; the
 * key, the mode and the checkboxes are only state, and the page opens on
 * C major or C Dorian. Switching views keeps the root.
 */
export default function CircleOfFifths() {
  const router = useRouter();
  const pathname = usePathname();
  const view: View = useSearchParams().get(VIEW_PARAM) === 'advanced' ? 'advanced' : 'key';
  const [key, setKey] = useState<Key>(C_MAJOR);
  const [modal, setModal] = useState<Modal>(C_DORIAN);
  /** The parent spoke of a hovered or focused Parallel modes row. */
  const [preview, setPreview] = useState<number | null>(null);
  /** The cell of a hovered secondary-dominant chip. */
  const [highlight, setHighlight] = useState<string | null>(null);
  const [toggles, setToggles] = useState<Toggles>(ALL_OFF);
  const toggle = (name: keyof Toggles) => setToggles(t => ({ ...t, [name]: !t[name] }));

  const switchView = (next: View) => {
    if (next === view) return;
    if (next === 'advanced') setModal(modeForKey(key));
    else setKey(keyForMode(modal.root, modal.mode));
    router.push(next === 'advanced' ? `${pathname}?${VIEW_PARAM}=advanced` : pathname, { scroll: false });
  };

  const keyModel = useMemo(() => keyWheel(key, toggles), [key, toggles]);
  const modeModel = useMemo(
    () => modeWheel(modal.root, modal.mode, { allNumerals: toggles.allNumerals }),
    [modal, toggles.allNumerals],
  );
  const model = view === 'key' ? keyModel : modeModel;

  const pickCell = (cell: Cell) => {
    if (view === 'key') setKey({ spoke: cell.spoke, minor: cell.ring === 'minor' });
    else setModal(m => ({ ...m, root: MAJOR_KEYS[cell.spoke] }));
  };
  const pickNote = (note: RingNote) => {
    if (note.pick) setModal(note.pick);
  };

  return (
    <HoverTips>
      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div aria-live="polite">
              <h1 className="m-0">{model.title}</h1>
              {/* The Circle keeps the line, empty, so the checkboxes stay put across views. */}
              <p
                className="m-0 mt-1 min-h-6 text-[17px] leading-6 [word-spacing:0.25em] text-(--ink-muted)"
                data-testid="mode-formula"
              >
                {view === 'advanced' ? modeModel.formula.join(' ') : ''}
              </p>
            </div>
            <Segmented<View> label="View" options={VIEW_OPTS} value={view} onChange={switchView} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Check label="Key signatures" on={toggles.signatures} onChange={() => toggle('signatures')} />
            <Check label="All numerals" on={toggles.allNumerals} onChange={() => toggle('allNumerals')} />
            {/* The Circle's only; the Advanced view keeps their room so nothing moves. */}
            <Check
              label="Parallel key" on={toggles.parallel} onChange={() => toggle('parallel')}
              hidden={view !== 'key'}
            />
            <Check
              label="Secondary dominants" on={toggles.dominants} onChange={() => toggle('dominants')}
              hidden={view !== 'key'}
            />
          </div>
        </header>

        {/* The Circle: the wheel large on its own row. Advanced: side by side on
            wide screens, so a pick and what it changes are both in view. */}
        <div className={view === 'advanced' ? 'cof-body cof-body-side' : 'cof-body'}>
          <CircleWheel
            model={model}
            signatures={toggles.signatures}
            pickable={PICKABLE[view]}
            onPick={pickCell}
            onNote={pickNote}
            preview={view === 'advanced' ? preview : null}
            highlight={highlight}
          />
          <div className="grid min-w-0 content-start gap-5">
            {view === 'key'
              ? <KeyPanel wheel={keyModel} options={toggles} onHighlight={setHighlight} />
              : <ModePanel wheel={modeModel} onPick={(root, mode) => setModal({ root, mode })} onPreview={setPreview} />}
          </div>
        </div>
      </div>
    </HoverTips>
  );
}

interface CheckProps {
  on: boolean;
  onChange: () => void;
  /** Kept in the layout but not shown or reachable. */
  hidden?: boolean;
  label: string;
}

function Check({ on, onChange, hidden = false, label }: CheckProps) {
  return (
    <label className={`cof-check${hidden ? ' invisible' : ''}`} aria-hidden={hidden || undefined}>
      <input type="checkbox" checked={on} onChange={onChange} disabled={hidden} aria-label={label} />
      {label}
    </label>
  );
}
