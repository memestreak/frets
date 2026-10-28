'use client';

/**
 * Arrangements… (issue #187): My arrangements, kept in the browser, at the top level or in folders
 * (one level), then the built-in ones in their folders (`builtin_arrangements/`), which open in place
 * of the open arrangement and are never saved. One line each, by name.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Modal } from '@/features/practice/quiz/Modal';
import { ShapeMenu } from '@/components/chords/export/ShapeMenu';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, FolderMoveIcon, PencilIcon, TrashIcon } from '@/components/icons';
import type { ArrangementInfo, Library } from './arrangements';
import { folderTitle, loadBuiltins, type Builtin } from './builtins';
import { UNTITLED } from './ClipTitle';
import type { Deleted } from './useArrangements';

const NEW_FOLDER = 'New folder';
const byName = <T,>(name: (t: T) => string) => (a: T, b: T) => name(a).localeCompare(name(b), undefined, { numeric: true, sensitivity: 'base' });

/** A name typed in place of a row: Enter or leaving keeps it, Esc gives it up (and leaves the dialog open). */
function NameField({ name, label, onDone }: { name: string; label: string; onDone: (name: string | null) => void }) {
  const [draft, setDraft] = useState(name);
  const done = useRef(false);
  const finish = (next: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(next === null ? null : next.trim());
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(null);
    } else if (e.key === 'Enter') finish(draft);
  };
  return (
    <input
      type="text" className="input tab-row-name" aria-label={label} placeholder={UNTITLED} value={draft}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- it opens on a press of the pencil, to type in
      autoFocus onFocus={e => e.currentTarget.select()}
      onChange={e => setDraft(e.target.value)} onBlur={() => finish(draft)} onKeyDown={onKeyDown}
    />
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: (e: MouseEvent<HTMLButtonElement>) => void; children: ReactNode }) {
  return <button type="button" className="btn btn-ghost btn-icon tab-row-tool" aria-label={label} onClick={onClick}>{children}</button>;
}

/** A folder's line: a press opens or closes it; a kept folder can be renamed and deleted. */
function FolderRow({ name, expanded, onToggle, tools, children }: {
  name: string;
  expanded: boolean;
  onToggle: () => void;
  tools?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li>
      <div className="tab-row">
        <button type="button" className="tab-row-main tab-folder" aria-expanded={expanded} onClick={onToggle}>
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          <FolderIcon />
          <span className="tab-row-text">{name}</span>
        </button>
        {tools}
      </div>
      {expanded && <ul className="tab-rows tab-folder-items m-0 py-0 pr-0" aria-label={name}>{children}</ul>}
    </li>
  );
}

/** An arrangement's line: a press opens it. */
function ItemRow({ name, current, onOpen, tools }: { name: string; current: boolean; onOpen: () => void; tools?: ReactNode }) {
  return (
    <li className="tab-row">
      <button type="button" className="tab-row-main" aria-current={current || undefined} onClick={onOpen}>
        <span className="tab-row-text">{name}</span>
      </button>
      {tools}
    </li>
  );
}

export function ArrangementsDialog({
  open, library, openId, exampleId, deleted, onClose, onOpen, onNew, onDuplicate, onRename, onDelete, onMove,
  onCreateFolder, onRenameFolder, onDeleteFolder, onUndoDelete, onOpenExample,
}: {
  open: boolean;
  library: Library;
  /** The open arrangement (set aside while an example is shown). */
  openId: string;
  /** The built-in arrangement shown in its place, if any. */
  exampleId: string | null;
  deleted: Deleted | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  /** A copy of the open arrangement, opened. */
  onDuplicate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** Into a folder, or to the top level with none. */
  onMove: (id: string, folder: string | undefined) => void;
  /** A new folder named `name`; its id. */
  onCreateFolder: (name: string) => string;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onUndoDelete: () => void;
  onOpenExample: (id: string) => void;
}) {
  // The built-in arrangements now in their folders, read each time the dialog opens.
  const [builtins, setBuiltins] = useState<Builtin[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void loadBuiltins().then(found => { if (live) setBuiltins(found); });
    return () => { live = false; };
  }, [open]);

  // The open folders, by `mine:<id>` or `builtin:<folder>`; on opening, the one holding what is shown.
  const shownFolder = (): string[] => {
    if (exampleId !== null) {
      const folder = builtins.find(b => b.id === exampleId)?.folder;
      return folder === undefined ? [] : [`builtin:${folder}`];
    }
    const folder = library.items.find(i => i.id === openId)?.folder;
    return folder === undefined ? [] : [`mine:${folder}`];
  };
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(shownFolder()));
  // The row whose name is being typed (an arrangement's or a folder's id), and the open Move menu.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null);
  // Reset on opening, and open the shown one's folder once the built-ins have come.
  const [seen, setSeen] = useState({ open, builtins });
  if (open !== seen.open || builtins !== seen.builtins) {
    const reopened = open !== seen.open;
    setSeen({ open, builtins });
    setExpanded(new Set([...(reopened ? [] : expanded), ...shownFolder()]));
    if (reopened) {
      setRenaming(null);
      setMoving(null);
    }
  }
  const toggle = (key: string) => setExpanded(now => {
    const next = new Set(now);
    if (!next.delete(key)) next.add(key);
    return next;
  });

  const newFolder = () => {
    const id = onCreateFolder(NEW_FOLDER);
    setExpanded(now => new Set([...now, `mine:${id}`]));
    setRenaming(id);
  };

  const folders = [...library.folders].sort(byName(f => f.name));

  const arrangement = (info: ArrangementInfo) => {
    const name = info.name.trim() || UNTITLED;
    if (renaming === info.id) {
      return (
        <li key={info.id} className="tab-row">
          <NameField name={info.name} label="Arrangement name" onDone={next => {
            setRenaming(null);
            if (next !== null && next !== info.name) onRename(info.id, next);
          }} />
        </li>
      );
    }
    return (
      <ItemRow
        key={info.id} name={name} current={exampleId === null && info.id === openId} onOpen={() => onOpen(info.id)}
        tools={(
          <>
            {folders.length > 0 && (
              <IconButton label={`Move ${name}`} onClick={e => {
                const box = e.currentTarget.getBoundingClientRect();
                setMoving({ id: info.id, x: box.right, y: box.bottom });
              }}>
                <FolderMoveIcon />
              </IconButton>
            )}
            <IconButton label={`Rename ${name}`} onClick={() => setRenaming(info.id)}><PencilIcon /></IconButton>
            <IconButton label={`Delete ${name}`} onClick={() => onDelete(info.id)}><TrashIcon /></IconButton>
          </>
        )}
      />
    );
  };

  const byTitle = byName((i: ArrangementInfo) => i.name.trim() || UNTITLED);
  const topLevel = library.items.filter(i => i.folder === undefined).sort(byTitle);
  const builtinFolders = [...new Set(builtins.map(b => b.folder))].sort(byName(folderTitle));
  const listed = library.items.some(i => i.id === openId);
  const movingInfo = moving && library.items.find(i => i.id === moving.id);

  return (
    <Modal open={open} onClose={onClose} title="Arrangements" className="tab-examples-dialog">
      <div className="settings-dialog-body grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="tab-examples-heading m-0">My arrangements</h3>
          <div className="flex flex-wrap gap-2 ml-auto">
            {exampleId === null && listed && (
              <button type="button" className="btn btn-secondary" onClick={onDuplicate}>Duplicate</button>
            )}
            <button type="button" className="btn btn-secondary" onClick={newFolder}>New folder</button>
            <button type="button" className="btn btn-secondary" onClick={onNew}>New arrangement</button>
          </div>
        </div>
        {deleted && (
          <p className="m-0 px-3 tab-examples-note" role="status">
            Deleted {deleted.folder ? `the folder ${deleted.name}` : deleted.name.trim() || UNTITLED}.{' '}
            <button type="button" className="btn btn-ghost tab-undo-delete" onClick={onUndoDelete}>Undo</button>
          </p>
        )}
        {folders.length === 0 && topLevel.length === 0 ? (
          <p className="m-0 px-3 tab-examples-note">Nothing kept yet: what you write is kept here as you go.</p>
        ) : (
          <ul className="tab-rows m-0 p-0" aria-label="My arrangements">
            {folders.map(folder => {
              const key = `mine:${folder.id}`;
              if (renaming === folder.id) {
                return (
                  <li key={folder.id} className="tab-row">
                    <NameField name={folder.name} label="Folder name" onDone={next => {
                      setRenaming(null);
                      if (next !== null && next !== folder.name) onRenameFolder(folder.id, next || NEW_FOLDER);
                    }} />
                  </li>
                );
              }
              const inside = library.items.filter(i => i.folder === folder.id).sort(byTitle);
              return (
                <FolderRow
                  key={folder.id} name={folder.name} expanded={expanded.has(key)} onToggle={() => toggle(key)}
                  tools={(
                    <>
                      <IconButton label={`Rename ${folder.name}`} onClick={() => setRenaming(folder.id)}><PencilIcon /></IconButton>
                      <IconButton label={`Delete ${folder.name}`} onClick={() => onDeleteFolder(folder.id)}><TrashIcon /></IconButton>
                    </>
                  )}
                >
                  {inside.length === 0 ? <li className="tab-row tab-examples-note tab-folder-empty">Empty</li> : inside.map(arrangement)}
                </FolderRow>
              );
            })}
            {topLevel.map(arrangement)}
          </ul>
        )}

        {builtinFolders.length > 0 && (
          <>
            <h3 className="tab-examples-heading m-0">Built-in</h3>
            <p className="m-0 px-3 tab-examples-note">Edit one freely: it is never saved, and your arrangement waits.</p>
            <ul className="tab-rows m-0 p-0" aria-label="Built-in">
              {builtinFolders.map(folder => {
                const key = `builtin:${folder}`;
                const inside = builtins.filter(b => b.folder === folder).sort(byName(b => b.title));
                return (
                  <FolderRow key={folder} name={folderTitle(folder)} expanded={expanded.has(key)} onToggle={() => toggle(key)}>
                    {inside.map(b => (
                      <ItemRow key={b.id} name={b.title} current={b.id === exampleId} onOpen={() => onOpenExample(b.id)} />
                    ))}
                  </FolderRow>
                );
              })}
            </ul>
          </>
        )}
      </div>
      {moving && movingInfo && (
        <ShapeMenu
          x={moving.x} y={moving.y} align="end" label="Move to"
          onClose={() => setMoving(null)}
          items={[
            ...(movingInfo.folder === undefined ? [] : [{ label: 'Top level', onSelect: () => onMove(moving.id, undefined) }]),
            ...folders.filter(f => f.id !== movingInfo.folder).map(f => ({ label: f.name, onSelect: () => onMove(moving.id, f.id) })),
          ]}
        />
      )}
    </Modal>
  );
}
