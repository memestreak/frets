import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/features/practice/quiz/Modal';
import { TAB_EXAMPLES, type TabExample } from './examples';
import { loadSamples } from './samples';

/**
 * The files Import's Open file… offers, and a drop takes: text, and alphaTex's own extensions
 * (our download is `.alphatex.txt`; alphaTab's tools write `.atex` and `.alphatex`).
 */
const TAB_FILE_TYPES = '.txt,.atex,.alphatex,.tex,text/plain';
export const isTabFile = (f: File) => f.type.startsWith('text/') || /\.(txt|atex|alphatex|tex)$/i.test(f.name);

export function ImportDialog({ open, onClose, onImport }: {
  open: boolean;
  onClose: () => void;
  onImport: (text: string) => Promise<string[] | null>;
}) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const close = () => {
    setErrors([]);
    onClose();
  };
  const submit = async (tab: string = text) => {
    const found = await onImport(tab);
    if (found) {
      setErrors(found);
      return;
    }
    setText('');
    close();
  };
  // A file from the computer goes into the box and is imported at once; if it can't be read, the
  // errors show under its text.
  const fileInput = useRef<HTMLInputElement>(null);
  const openFile = async (file: File | undefined) => {
    if (!file) return;
    const tab = await file.text();
    setText(tab);
    await submit(tab);
  };
  return (
    <Modal open={open} onClose={close} title="Import tab" className="tab-import">
      <div className="settings-dialog-body grid gap-3">
        <textarea
          className="input tab-import-text" value={text} onChange={e => setText(e.target.value)}
          aria-label="Tab, as alphaTex or ASCII" spellCheck={false} rows={12}
          placeholder={'\\title "Riff"\n5.5{h}.8 7.5.8 5.4{h}.8 7.4.8 |\n\nor ASCII:\ne|-----5h7-----|\n…'}
        />
        <p className="m-0 text-(--ink-muted)">
          Formats: <a href="/tab-alphatex.txt" target="_blank" rel="noreferrer">alphaTex</a>{' '}
          or <a href="/tab-ascii.txt" target="_blank" rel="noreferrer">ASCII tab</a>.
          Importing replaces the clip; Ctrl+Z brings it back.
        </p>
        {errors.length > 0 && (
          <ul className="m-0 pl-5 text-(--danger)" data-testid="import-errors">
            {errors.map(e => <li key={e}>{e}</li>)}
          </ul>
        )}
        <div className="flex justify-between gap-3">
          <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>Open file…</button>
          <input
            ref={fileInput} type="file" accept={TAB_FILE_TYPES} hidden aria-label="Tab file"
            onChange={e => { void openFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={!text.trim()}>Import</button>
        </div>
      </div>
    </Modal>
  );
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

/** The example clips, each with a line on what it shows; choosing one shows it in place of the clip. */
export function ExamplesDialog({ open, current, onClose, onOpen }: {
  open: boolean;
  /** The example shown now, marked in the list. */
  current: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  // The samples in the folder now, read each time the dialog opens.
  const [samples, setSamples] = useState<TabExample[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void loadSamples().then(found => { if (live) setSamples(found); });
    return () => { live = false; };
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Examples" className="tab-examples-dialog">
      <div className="settings-dialog-body grid gap-3">
        <p className="m-0 text-(--ink-muted)">Each shows what Frets draws. Edit one freely: it is never saved, and your own clip waits.</p>
        {/* The files dropped into src/features/tab/samples/, for trying things out: first, as they change most. */}
        {samples.length > 0 && (
          <>
            <h3 className="tab-examples-heading m-0">Samples</h3>
            <ExampleList examples={samples} current={current} onOpen={onOpen} />
            <h3 className="tab-examples-heading m-0">Examples</h3>
          </>
        )}
        <ExampleList examples={TAB_EXAMPLES} current={current} onOpen={onOpen} />
      </div>
    </Modal>
  );
}
