'use client';

/**
 * Saving an arrangement (issue #259): Save As… asks for a name and a folder (and is what the first
 * Save of an arrangement never saved does), into My arrangements, a folder of it or a new one; "Save changes to ‹name›?" asks before unsaved changes are
 * replaced (by Open, New, Import, a drop or a link).
 */
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Modal } from '@/components/Modal';
import { CloseIcon } from '@/components/icons';
import type { FolderInfo } from './arrangements';
import { UNTITLED } from './clip';

/** The value of the folder list for the top level of My arrangements. */
const TOP = '';
/** A new folder's name when none is typed. */
const NEW_FOLDER = 'New folder';

/** Where Save As… saves: a folder of My arrangements (none for the top level), or a new folder by name. */
export type SaveInto = string | undefined | { newFolder: string };

/** Save As…: a folder (My arrangements to start with, or a new one) and a name for the open clip. */
export function SaveAsDialog({ open, name, folders, onClose, onCreateFolder, onSave }: {
  open: boolean;
  /** The clip's title as it is. */
  name: string;
  folders: FolderInfo[];
  onClose: () => void;
  /** Makes a folder in My arrangements; its id. */
  onCreateFolder: (name: string) => string;
  onSave: (name: string, into: SaveInto) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Save as" className="tab-save-as">
      {/* A fresh form each time it opens, filled with the clip's name as it is then. */}
      {open && <SaveAsForm name={name} folders={folders} onClose={onClose} onCreateFolder={onCreateFolder} onSave={onSave} />}
    </Modal>
  );
}

function SaveAsForm({ name, folders, onClose, onCreateFolder, onSave }: {
  name: string;
  folders: FolderInfo[];
  onClose: () => void;
  onCreateFolder: (name: string) => string;
  onSave: (name: string, into: SaveInto) => void;
}) {
  const [typed, setTyped] = useState(name);
  const [into, setInto] = useState(TOP);
  // A new folder's name, while one is being typed: Enter makes it; Save with it still open makes it too.
  const [newFolder, setNewFolder] = useState<string | null>(null);
  // Whether the folder list takes the focus when it comes back in place of the new folder's name.
  const focusList = useRef(false);
  const listMounted = (el: HTMLSelectElement | null) => {
    if (!el || !focusList.current) return;
    focusList.current = false;
    el.focus();
  };

  // The name is the arrangement's title, which is needed (issue #281).
  const blank = typed.trim() === '';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blank) return;
    if (newFolder !== null) onSave(typed.trim(), { newFolder: newFolder.trim() || NEW_FOLDER });
    else onSave(typed.trim(), into === TOP ? undefined : into);
  };
  /** Back to the folder list, which takes the focus, so a second Enter doesn't save. */
  const backToList = () => {
    focusList.current = true;
    setNewFolder(null);
  };
  // Enter in the new folder's name makes the folder and picks it; Esc goes back to the list. Neither saves or closes.
  const onNewFolderKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setInto(onCreateFolder((newFolder ?? '').trim() || NEW_FOLDER));
      backToList();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      backToList();
    }
  };
  const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return (
    <form className="settings-dialog-body grid gap-3" onSubmit={submit}>
      <div className="grid gap-1">
        <span>Folder</span>
        <div className="flex gap-2">
          {newFolder === null ? (
            <>
              <select
                ref={listMounted} className="input min-w-0 flex-1" aria-label="Folder" value={into}
                onChange={e => setInto(e.target.value)}
              >
                <option value={TOP}>My arrangements</option>
                {sorted.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <button type="button" className="btn btn-secondary" onClick={() => setNewFolder('')}>New folder</button>
            </>
          ) : (
            <>
              <input
                type="text" className="input min-w-0 flex-1" aria-label="New folder name" value={newFolder} placeholder={NEW_FOLDER}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- it opens on a press of New folder, to type in
                autoFocus onChange={e => setNewFolder(e.target.value)} onKeyDown={onNewFolderKey}
              />
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Pick a folder instead" title="Pick a folder instead" onClick={backToList}>
                <CloseIcon />
              </button>
            </>
          )}
        </div>
      </div>
      <label className="grid gap-1">
        <span>
          Name
          {blank && (
            <span className="tab-field-problem" role="img" aria-label="The name can't be blank" title="The name can't be blank">
              {' '}⚠{'\uFE0E'}
            </span>
          )}
        </span>
        <input
          type="text" className="input" aria-label="Name" aria-invalid={blank || undefined} value={typed} placeholder={UNTITLED}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog opens to type a name
          autoFocus onFocus={e => e.currentTarget.select()} onChange={e => setTyped(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

/** "Save changes to ‹name›?" before unsaved changes are replaced: Save, Don't save, or Cancel to keep them open. */
export function SaveChangesDialog({ open, name, onSave, onDiscard, onCancel }: {
  open: boolean;
  name: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title="Save changes?">
      <div className="settings-dialog-body grid gap-3">
        <p className="m-0">Save changes to “{name.trim() || UNTITLED}”?</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary mr-auto" onClick={onDiscard}>Don&apos;t save</button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
