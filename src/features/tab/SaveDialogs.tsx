'use client';

/**
 * Saving an arrangement (issue #259): Save As… asks for a name and a folder (and is what the first
 * Save of an arrangement never saved does), into a folder there is or a new one; "Save changes to ‹name›?" asks before unsaved changes are
 * replaced (by Open, New, Import, a drop or a link).
 */
import { useState, type FormEvent, type KeyboardEvent } from 'react';
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

/** Save As…: a name and a folder for the open clip. */
export function SaveAsDialog({ open, name, folder, folders, onClose, onSave }: {
  open: boolean;
  /** The clip's title as it is. */
  name: string;
  /** The folder offered first: the open arrangement's, or the top level. */
  folder: string | undefined;
  folders: FolderInfo[];
  onClose: () => void;
  onSave: (name: string, into: SaveInto) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Save as" className="tab-save-as">
      {/* A fresh form each time it opens, filled with the clip's name and folder as they are then. */}
      {open && <SaveAsForm name={name} folder={folder} folders={folders} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

function SaveAsForm({ name, folder, folders, onClose, onSave }: {
  name: string;
  folder: string | undefined;
  folders: FolderInfo[];
  onClose: () => void;
  onSave: (name: string, into: SaveInto) => void;
}) {
  const [typed, setTyped] = useState(name);
  const [into, setInto] = useState(folder ?? TOP);
  // A new folder's name, while one is being made; it is made only on Save, so Cancel leaves none behind.
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (newFolder !== null) onSave(typed.trim(), { newFolder: newFolder.trim() || NEW_FOLDER });
    else onSave(typed.trim(), into === TOP ? undefined : into);
  };
  // Esc in the new folder's name goes back to the list, and leaves the dialog open.
  const onNewFolderKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    setNewFolder(null);
  };
  const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return (
    <form className="settings-dialog-body grid gap-3" onSubmit={submit}>
      <label className="grid gap-1">
        <span>Name</span>
        <input
          type="text" className="input" aria-label="Name" value={typed} placeholder={UNTITLED}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog opens to type a name
          autoFocus onFocus={e => e.currentTarget.select()} onChange={e => setTyped(e.target.value)}
        />
      </label>
      <div className="grid gap-1">
        <span>Folder</span>
        <div className="flex gap-2">
          {newFolder === null ? (
            <>
              <select className="input min-w-0 flex-1" aria-label="Folder" value={into} onChange={e => setInto(e.target.value)}>
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
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Pick a folder instead" title="Pick a folder instead" onClick={() => setNewFolder(null)}>
                <CloseIcon />
              </button>
            </>
          )}
        </div>
      </div>
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
