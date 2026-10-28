'use client';

/**
 * Arrangements… (issue #187): My arrangements, kept in the browser, then the samples and the
 * examples, which open in place of the open arrangement and are never saved. `layout` is the mock
 * being compared: 'list' puts the three under headings in one list, 'tabs' shows one at a time.
 */
import { useEffect, useState, type KeyboardEvent } from 'react';
import { Modal } from '@/features/practice/quiz/Modal';
import { PencilIcon, TrashIcon } from '@/components/icons';
import type { ArrangementInfo } from './arrangements';
import { UNTITLED } from './ClipTitle';
import { TAB_EXAMPLES, type TabExample } from './examples';
import { loadSamples, SAMPLE_PREFIX } from './samples';
import type { Deleted } from './useArrangements';

export type ArrangementsLayout = 'list' | 'tabs';
type Section = 'mine' | 'samples' | 'examples';

/** When an arrangement last changed, as the list says it. */
export function changedText(ms: number, now = Date.now()): string {
  const date = new Date(ms);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (new Date(now).toDateString() === date.toDateString()) return `Today, ${time}`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function ExampleList({ examples, current, onOpen }: { examples: TabExample[]; current: string | null; onOpen: (id: string) => void }) {
  return (
    <ul className="tab-examples m-0 p-0">
      {examples.map(e => (
        <li key={e.id}>
          <button type="button" className="tab-example" aria-current={e.id === current || undefined} onClick={() => onOpen(e.id)}>
            <span className="tab-example-title">{e.title}</span>
            <span className="tab-example-shows">{e.shows}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One kept arrangement: a press opens it; the pencil renames it in place, the bin deletes it. */
function ArrangementRow({ info, current, onOpen, onRename, onDelete }: {
  info: ArrangementInfo;
  current: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  // The name being typed; null when the row shows the name.
  const [draft, setDraft] = useState<string | null>(null);
  const name = info.name.trim() || UNTITLED;
  const keep = () => {
    if (draft === null) return;
    setDraft(null);
    const next = draft.trim();
    if (next !== info.name) onRename(next);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Esc cancels the rename, not the dialog.
    if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(null);
    } else if (e.key === 'Enter') keep();
  };
  return (
    <li className="tab-arrangement">
      {draft === null ? (
        <button type="button" className="tab-example" aria-current={current || undefined} onClick={onOpen}>
          <span className="tab-example-title">{name}</span>
          <span className="tab-example-shows">{changedText(info.changed)}</span>
        </button>
      ) : (
        <input
          type="text" className="input tab-arrangement-name" aria-label="Arrangement name" placeholder={UNTITLED} value={draft}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- it opens on a press of the pencil, to type in
          autoFocus onFocus={e => e.currentTarget.select()}
          onChange={e => setDraft(e.target.value)} onBlur={keep} onKeyDown={onKeyDown}
        />
      )}
      <button type="button" className="btn btn-ghost btn-icon" aria-label={`Rename ${name}`} onClick={() => setDraft(info.name)}>
        <PencilIcon />
      </button>
      <button type="button" className="btn btn-ghost btn-icon" aria-label={`Delete ${name}`} onClick={onDelete}>
        <TrashIcon />
      </button>
    </li>
  );
}

export function ArrangementsDialog({
  open, layout, items, openId, exampleId, deleted, onClose, onOpen, onNew, onDuplicate, onRename, onDelete, onUndoDelete, onOpenExample,
}: {
  open: boolean;
  layout: ArrangementsLayout;
  /** My arrangements, latest change first. */
  items: ArrangementInfo[];
  /** The open arrangement (set aside while an example is shown). */
  openId: string;
  /** The example or sample shown in its place, if any. */
  exampleId: string | null;
  deleted: Deleted | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  /** A copy of the open arrangement, opened. */
  onDuplicate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onUndoDelete: () => void;
  onOpenExample: (id: string) => void;
}) {
  // The samples in the folder now, read each time the dialog opens.
  const [samples, setSamples] = useState<TabExample[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void loadSamples().then(found => { if (live) setSamples(found); });
    return () => { live = false; };
  }, [open]);
  // In the 'tabs' mock, the section shown: at first, where what is shown now lives.
  const [picked, setPicked] = useState<Section | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setPicked(null);
  }
  const section = picked ?? (exampleId === null ? 'mine' : exampleId.startsWith(SAMPLE_PREFIX) ? 'samples' : 'examples');

  const listed = items.some(i => i.id === openId);
  const mine = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {layout === 'list' && <h3 className="tab-examples-heading m-0">My arrangements</h3>}
        <div className="flex gap-2 ml-auto">
          {exampleId === null && listed && (
            <button type="button" className="btn btn-secondary" onClick={onDuplicate}>Duplicate</button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onNew}>New arrangement</button>
        </div>
      </div>
      {deleted && (
        <p className="m-0 px-3 tab-examples-note" role="status">
          Deleted {deleted.info.name.trim() || UNTITLED}.{' '}
          <button type="button" className="btn btn-ghost tab-undo-delete" onClick={onUndoDelete}>Undo</button>
        </p>
      )}
      {items.length === 0 ? (
        <p className="m-0 px-3 tab-examples-note">Nothing kept yet: what you write is kept here as you go.</p>
      ) : (
        <ul className="tab-examples m-0 p-0" aria-label="My arrangements">
          {items.map(info => (
            <ArrangementRow
              key={info.id} info={info} current={exampleId === null && info.id === openId}
              onOpen={() => onOpen(info.id)} onRename={name => onRename(info.id, name)} onDelete={() => onDelete(info.id)}
            />
          ))}
        </ul>
      )}
    </>
  );
  const sampleList = <ExampleList examples={samples} current={exampleId} onOpen={onOpenExample} />;
  const exampleList = <ExampleList examples={TAB_EXAMPLES} current={exampleId} onOpen={onOpenExample} />;
  const readOnly = <p className="m-0 px-3 tab-examples-note">Edit one freely: it is never saved, and your arrangement waits.</p>;

  return (
    <Modal open={open} onClose={onClose} title="Arrangements" className="tab-examples-dialog">
      <div className="settings-dialog-body grid gap-3">
        {layout === 'tabs' ? (
          <>
            <div className="seg" role="group" aria-label="Show">
              {(['mine', 'samples', 'examples'] as const).filter(s => s !== 'samples' || samples.length > 0).map(s => (
                <button key={s} type="button" className="seg-opt" aria-pressed={section === s} onClick={() => setPicked(s)}>
                  {{ mine: 'My arrangements', samples: 'Samples', examples: 'Examples' }[s]}
                </button>
              ))}
            </div>
            {section === 'mine' ? mine : <>{readOnly}{section === 'samples' ? sampleList : exampleList}</>}
          </>
        ) : (
          <>
            {mine}
            {/* The files dropped into src/features/tab/samples/, for trying things out. */}
            {samples.length > 0 && (
              <>
                <h3 className="tab-examples-heading m-0">Samples</h3>
                {sampleList}
              </>
            )}
            <h3 className="tab-examples-heading m-0">Examples</h3>
            {readOnly}
            {exampleList}
          </>
        )}
      </div>
    </Modal>
  );
}
