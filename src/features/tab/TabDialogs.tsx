import { useRef, useState } from 'react';
import { Modal } from '@/features/practice/quiz/Modal';
import { TAB_FILE_TYPES } from './readTab';

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
          Importing opens it as a new arrangement.
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
