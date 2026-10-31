'use client';

/**
 * Arrangements… (issue #187): My arrangements, kept in the browser, at the top level or in folders
 * (one level), then the built-in ones in their folders (`builtin_arrangements/`), which open in place
 * of the open arrangement and are never saved. One line each, by name. A click picks a line, Shift
 * and Cmd (Ctrl) pick several, as in a file browser; a double click (or double tap) opens one.
 */
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Modal } from '@/components/Modal';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, PencilIcon, TrashIcon } from '@/components/icons';
import type { ArrangementInfo, Library } from './arrangements';
import { folderTitle, loadBuiltins, type Builtin } from './builtins';
import { UNTITLED } from './clip';
import type { Deleted } from './useArrangements';

const NEW_FOLDER = 'New folder';
/** `dropAt` for the top level of My arrangements. */
const TOP = '';
/** What a dragged arrangement carries: its id (the picked ones', a line each), under a type of Frets' own (a drop elsewhere imports text). */
export const DRAG_TYPE = 'application/x-frets-arrangement';
/** Two taps on one line this close together open it, where a browser doesn't count a double tap as a double click. */
export const DOUBLE_TAP_MS = 400;

/** The lines picked: kept arrangements by id, several at once, or one built-in on its own. */
interface Picked {
  mine: string[];
  /** Where a Shift-click's range starts. */
  anchor: string | null;
  builtin: string | null;
}
const NONE_PICKED: Picked = { mine: [], anchor: null, builtin: null };

/** A press with Shift, Cmd or Ctrl held picks more lines instead of one. */
const addsToPick = (e: MouseEvent) => e.shiftKey || e.metaKey || e.ctrlKey;

/** A place an arrangement can be dropped: a folder's line and what it holds, or the list for the top level. */
interface DropTarget {
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}
const byName = <T,>(name: (t: T) => string) => (a: T, b: T) => name(a).localeCompare(name(b), undefined, { numeric: true, sensitivity: 'base' });

/** A name typed in place of a row: Enter or leaving keeps it, Esc gives it up (and leaves the dialog open). */
export function NameField({ name, label, onDone }: { name: string; label: string; onDone: (name: string | null) => void }) {
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

export function IconButton({ label, onClick, children }: { label: string; onClick: (e: MouseEvent<HTMLButtonElement>) => void; children: ReactNode }) {
  return <button type="button" className="btn btn-ghost btn-icon tab-row-tool" aria-label={label} onClick={onClick}>{children}</button>;
}

/** A folder's line: a press opens or closes it; a kept folder can be renamed and deleted. */
function FolderRow({ name, expanded, onToggle, tools, drop, dropping = false, children }: {
  name: string;
  expanded: boolean;
  onToggle: () => void;
  tools?: ReactNode;
  /** A kept folder takes arrangements dropped on it; `dropping` while one is held over it. */
  drop?: DropTarget;
  dropping?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={dropping ? 'tab-drop' : undefined} {...drop}>
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

/**
 * When a kept arrangement last changed, short enough for the end of its line and exact enough to
 * tell two of one name apart: the time today, else the day and time (and the year, from another).
 */
export function changedText(ms: number, now = Date.now()): string {
  const date = new Date(ms);
  const today = new Date(now);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return time;
  const year = date.getFullYear() === today.getFullYear() ? undefined : 'numeric';
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year })}, ${time}`;
}

/** An arrangement's line: a press picks it, a double one opens it; a kept one says when it last changed. */
function ItemRow({ name, changed, current, picked, onPress, tools, dragIds, onDragEnd }: {
  name: string;
  changed?: number;
  /** The open one, outlined. */
  current: boolean;
  /** Picked, filled. */
  picked: boolean;
  onPress: (e: MouseEvent<HTMLButtonElement>) => void;
  tools?: ReactNode;
  /** A kept arrangement can be dragged into a folder, or out to the top level: these ids go with it. */
  dragIds?: () => string[];
  onDragEnd?: () => void;
}) {
  const drag = dragIds === undefined ? {} : {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(DRAG_TYPE, dragIds().join('\n'));
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd,
  };
  return (
    <li className="tab-row" {...drag}>
      <button type="button" className="tab-row-main" aria-current={current || undefined} aria-pressed={picked} onClick={onPress}>
        <span className="tab-row-text">{name}</span>
        {/* The space keeps the name and the time apart where they are read as one, e.g. by a screen reader. */}
        {changed !== undefined && ' '}
        {changed !== undefined && <span className="tab-row-changed" data-testid="changed">{changedText(changed)}</span>}
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
  onDelete: (ids: string[]) => void;
  /** Into a folder, or to the top level with none. */
  onMove: (ids: string[], folder: string | undefined) => void;
  /** A new folder named `name`; its id. */
  onCreateFolder: (name: string) => string;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onUndoDelete: () => void;
  /** A built-in arrangement, with its text as the dialog listed it, so opening it needn't fetch again. */
  onOpenExample: (builtin: Builtin) => void;
}) {
  // The built-in arrangements now in their folders: read when the page opens, so the list is there at the first
  // opening, and again each time the dialog opens, so a file just dropped into the folder is listed.
  const [builtins, setBuiltins] = useState<Builtin[]>([]);
  const readOnce = useRef(false);
  useEffect(() => {
    // Not again on closing.
    if (!open && readOnce.current) return;
    readOnce.current = true;
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
  // The row whose name is being typed (an arrangement's or a folder's id).
  const [renaming, setRenaming] = useState<string | null>(null);
  // Where a dragged arrangement would land: a folder's id, TOP for the top level; null while none is held.
  const [dropAt, setDropAt] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked>(NONE_PICKED);
  // The last plain press on a line, to tell a double tap.
  const lastPress = useRef<{ key: string; at: number } | null>(null);
  // Reset on opening, and open the shown one's folder once the built-ins have come.
  const [seen, setSeen] = useState({ open, builtins });
  if (open !== seen.open || builtins !== seen.builtins) {
    const reopened = open !== seen.open;
    setSeen({ open, builtins });
    setExpanded(new Set([...(reopened ? [] : expanded), ...shownFolder()]));
    if (reopened) {
      setRenaming(null);
      setPicked(NONE_PICKED);
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
  const byTitle = byName((i: ArrangementInfo) => i.name.trim() || UNTITLED);
  const topLevel = library.items.filter(i => i.folder === undefined).sort(byTitle);
  const inFolder = (id: string) => library.items.filter(i => i.folder === id).sort(byTitle);
  // The kept arrangements as listed, top to bottom, leaving out those in closed folders: a Shift-click's range.
  const shown = [
    ...folders.flatMap(f => (expanded.has(`mine:${f.id}`) ? inFolder(f.id) : [])),
    ...topLevel,
  ].map(i => i.id);
  // Only what is still kept and shown counts as picked (a delete or a closed folder lets go of the rest).
  const pickedIds = picked.mine.filter(id => shown.includes(id));

  /**
   * Whether a press on the line `key` opens it: a double click, a second tap soon after the first, or a press
   * from the keyboard (Enter or Space, which has no click count). A press with Shift, Cmd or Ctrl only picks.
   */
  const opens = (key: string, e: MouseEvent): boolean => {
    if (addsToPick(e)) {
      lastPress.current = null;
      return false;
    }
    if (e.detail === 0) return true;
    const last = lastPress.current;
    const again = last !== null && last.key === key && e.timeStamp - last.at < DOUBLE_TAP_MS;
    lastPress.current = again || e.detail >= 2 ? null : { key, at: e.timeStamp };
    return again || e.detail >= 2;
  };

  /** A press on a kept arrangement: opens it, or picks it alone, a range from the last one (Shift), or toggles it (Cmd, Ctrl). */
  const pressMine = (id: string, e: MouseEvent) => {
    if (opens(`mine:${id}`, e)) {
      onOpen(id);
      return;
    }
    if (e.shiftKey && picked.anchor !== null && shown.includes(picked.anchor)) {
      const [from, to] = [shown.indexOf(picked.anchor), shown.indexOf(id)].sort((a, b) => a - b);
      setPicked({ mine: shown.slice(from, to + 1), anchor: picked.anchor, builtin: null });
    } else if (e.metaKey || e.ctrlKey) {
      const mine = pickedIds.includes(id) ? pickedIds.filter(p => p !== id) : [...pickedIds, id];
      setPicked({ mine, anchor: id, builtin: null });
    } else {
      setPicked({ mine: [id], anchor: id, builtin: null });
    }
  };

  /** A press on a built-in one: opens it, or picks it alone (they can't be deleted, so never several). */
  const pressBuiltin = (b: Builtin, e: MouseEvent) => {
    if (opens(`builtin:${b.id}`, e)) onOpenExample(b);
    else setPicked({ ...NONE_PICKED, builtin: b.id });
  };

  const remove = (ids: string[]) => {
    onDelete(ids);
    // Nothing stays picked after a delete.
    setPicked(NONE_PICKED);
  };

  /** Delete or Backspace on the list deletes the picked arrangements (not while a name is typed). */
  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (e.target instanceof HTMLInputElement || pickedIds.length === 0) return;
    e.preventDefault();
    remove(pickedIds);
  };

  /** Drops into `folder`, or to the top level with none; a folder dropped into opens. */
  const dropTarget = (folder: string | undefined): DropTarget => {
    const at = folder ?? TOP;
    const carries = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE);
    return {
      onDragOver: e => {
        if (!carries(e)) return;
        e.preventDefault();
        // A folder's line is inside the list: the innermost place takes it.
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (dropAt !== at) setDropAt(at);
      },
      onDragLeave: e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(now => (now === at ? null : now));
      },
      onDrop: e => {
        if (!carries(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropAt(null);
        const ids = e.dataTransfer.getData(DRAG_TYPE).split('\n')
          .filter(id => library.items.some(i => i.id === id && i.folder !== folder));
        if (ids.length === 0) return;
        onMove(ids, folder);
        if (folder !== undefined) setExpanded(now => new Set([...now, `mine:${folder}`]));
      },
    };
  };

  const arrangement = (info: ArrangementInfo) => {
    const name = info.name.trim() || UNTITLED;
    const isPicked = pickedIds.includes(info.id);
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
        key={info.id} name={name} changed={info.changed} current={exampleId === null && info.id === openId}
        picked={isPicked} onPress={e => pressMine(info.id, e)}
        dragIds={() => (isPicked ? pickedIds : [info.id])} onDragEnd={() => setDropAt(null)}
        tools={(
          <>
            <IconButton label={`Rename ${name}`} onClick={() => setRenaming(info.id)}><PencilIcon /></IconButton>
            {/* On a picked line it deletes every picked one, as a file browser's Delete does. */}
            <IconButton
              label={isPicked && pickedIds.length > 1 ? `Delete ${pickedIds.length} arrangements` : `Delete ${name}`}
              onClick={() => remove(isPicked ? pickedIds : [info.id])}
            ><TrashIcon /></IconButton>
          </>
        )}
      />
    );
  };

  const builtinFolders = [...new Set(builtins.map(b => b.folder))].sort(byName(folderTitle));
  const listed = library.items.some(i => i.id === openId);

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
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Delete or Backspace from a picked line, a button inside
          <ul
            className={`tab-rows m-0 p-0${dropAt === TOP ? ' tab-drop' : ''}`} aria-label="My arrangements"
            onKeyDown={onListKeyDown} {...dropTarget(undefined)}
          >
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
              const inside = inFolder(folder.id);
              return (
                <FolderRow
                  key={folder.id} name={folder.name} expanded={expanded.has(key)} onToggle={() => toggle(key)}
                  drop={dropTarget(folder.id)} dropping={dropAt === folder.id}
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
                      <ItemRow
                        key={b.id} name={b.title} current={b.id === exampleId} picked={picked.builtin === b.id}
                        onPress={e => pressBuiltin(b, e)}
                      />
                    ))}
                  </FolderRow>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
