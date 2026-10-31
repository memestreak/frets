'use client';

/**
 * Arrangements… as a file chooser (issue #259), in two layouts to choose from (`?mock=b`, `?mock=c`):
 * b, two panes as in an OS Open dialog (the places on the left, the chosen folder's files on the
 * right, the picked file's preview beside them); c, one folder at a time under a path ("Arrangements ›
 * My arrangements › Blues", the preview below the list). A press on a file picks it and shows its
 * preview, from which Insert puts it in at the page's cursor and Copy alphaTex copies its text; a
 * double click, Enter or Open opens it, and the dialog closes. On a phone the preview takes the whole
 * dialog, with a Back button.
 */
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { Modal } from '@/features/practice/quiz/Modal';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, FolderIcon, PencilIcon, TrashIcon } from '@/components/icons';
import { loadArrangement, type ArrangementInfo, type Library } from './arrangements';
import { folderTitle, loadBuiltins, type Builtin } from './builtins';
import { partOf, UNTITLED, type Clip } from './clip';
import { writeAlphaTex } from './alphatex';
import { readTab } from './readTab';
import { TabClip } from './TabClip';
import type { Parts } from './layout';
import { useWidth } from './useWidth';
import { changedText, DOUBLE_TAP_MS, DRAG_TYPE, IconButton, NameField } from './ArrangementsDialog';
import type { Deleted } from './useArrangements';

export type ChooserLayout = 'panes' | 'path';

const NEW_FOLDER = 'New folder';
/** Narrower than this, the chooser shows one thing at a time: the list, or the picked file's preview. */
const PHONE_WIDTH = 640;
/** The preview is drawn this much smaller than the page draws the clip. */
const PREVIEW_ZOOM = 0.75;
/** The preview sheet's padding, both sides (`.tab-chooser-sheet`). */
const SHEET_PADDING = 24;

/** Where the list is: the top (layout c only), My arrangements (a folder of it, or its top level), or the built-ins. */
type Place =
  | { kind: 'root' }
  | { kind: 'mine'; folder?: string }
  | { kind: 'builtin'; folder?: string };

const samePlace = (a: Place, b: Place) =>
  a.kind === b.kind && (a.kind === 'root' || a.folder === (b as { folder?: string }).folder);

/** A file in the list, by kind. */
type FileKey = `mine:${string}` | `builtin:${string}`;

const byName = <T,>(name: (t: T) => string) => (a: T, b: T) => name(a).localeCompare(name(b), undefined, { numeric: true, sensitivity: 'base' });

/** A file's clip for the preview: read from storage, or from a built-in's text. */
type Preview = { key: FileKey; clip: Clip } | { key: FileKey; error: string };

export function ArrangementChooser({
  layout, open, library, openId, exampleId, deleted, parts, onClose, onOpen, onOpenExample, onInsert, onRename, onDelete,
  onMove, onCreateFolder, onRenameFolder, onDeleteFolder, onUndoDelete,
}: {
  layout: ChooserLayout;
  open: boolean;
  library: Library;
  openId: string;
  exampleId: string | null;
  deleted: Deleted | null;
  /** How the page draws the clip (tab, staff or both), so the preview looks the same. */
  parts: Parts;
  onClose: () => void;
  onOpen: (id: string) => void;
  onOpenExample: (builtin: Builtin) => void;
  /** Puts a clip in at the page's cursor, as a paste does. */
  onInsert: (clip: Clip) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (ids: string[]) => void;
  onMove: (ids: string[], folder: string | undefined) => void;
  onCreateFolder: (name: string) => string;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onUndoDelete: () => void;
}) {
  // The built-in arrangements, read again each time the dialog opens, so a file just added is listed.
  const [builtins, setBuiltins] = useState<Builtin[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void loadBuiltins().then(found => { if (live) setBuiltins(found); });
    return () => { live = false; };
  }, [open]);

  // Where the list starts: the open arrangement's folder (or the shown example's).
  const startPlace = (): Place => {
    if (exampleId !== null) {
      const folder = builtins.find(b => b.id === exampleId)?.folder;
      return { kind: 'builtin', folder };
    }
    return { kind: 'mine', folder: library.items.find(i => i.id === openId)?.folder };
  };
  const [place, setPlace] = useState<Place>(startPlace);
  const [picked, setPicked] = useState<FileKey[]>([]);
  const [anchor, setAnchor] = useState<FileKey | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<string | null>(null);
  // On a phone: the picked file's preview in place of the list.
  const [previewing, setPreviewing] = useState(false);
  const lastPress = useRef<{ key: string; at: number } | null>(null);
  const [bodyRef, bodyWidth] = useWidth();
  const phone = bodyWidth > 0 && bodyWidth < PHONE_WIDTH;

  // Reset on opening.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPlace(startPlace());
      setPicked([]);
      setAnchor(null);
      setRenaming(null);
      setPreviewing(false);
    }
  }

  const goTo = (next: Place) => {
    setPlace(next);
    setPicked([]);
    setAnchor(null);
    setPreviewing(false);
  };

  const folders = [...library.folders].sort(byName(f => f.name));
  const byTitle = byName((i: ArrangementInfo) => i.name.trim() || UNTITLED);
  const mineIn = (folder: string | undefined) => library.items.filter(i => i.folder === folder).sort(byTitle);
  const builtinFolders = [...new Set(builtins.map(b => b.folder))].sort(byName(folderTitle));
  const builtinsIn = (folder: string) => builtins.filter(b => b.folder === folder).sort(byName(b => b.title));

  // The files listed where the list is, top to bottom: a Shift-click's range.
  const files: FileKey[] = place.kind === 'mine'
    ? mineIn(place.folder).map(i => `mine:${i.id}` as const)
    : place.kind === 'builtin' && place.folder !== undefined ? builtinsIn(place.folder).map(b => `builtin:${b.id}` as const) : [];
  const pickedHere = picked.filter(k => files.includes(k));
  const pickedMine = pickedHere.filter(k => k.startsWith('mine:')).map(k => k.slice(5));
  const single = pickedHere.length === 1 ? pickedHere[0] : null;

  const builtinOf = (key: FileKey) => builtins.find(b => `builtin:${b.id}` === key);

  // The single picked file's clip, for the preview.
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => {
    if (single === null) return;
    let live = true;
    if (single.startsWith('mine:')) {
      const clip = loadArrangement(single.slice(5));
      // Read from storage, which an effect may do; set after this effect so it isn't a cascade.
      void Promise.resolve().then(() => {
        if (live) setPreview(clip ? { key: single, clip } : { key: single, error: 'This arrangement could not be read.' });
      });
    } else {
      const builtin = builtins.find(b => `builtin:${b.id}` === single);
      if (builtin) {
        void readTab(builtin.text).then(result => {
          if (!live) return;
          setPreview(result.ok ? { key: single, clip: result.clip } : { key: single, error: result.errors.join(' ') });
        });
      }
    }
    return () => { live = false; };
  }, [single, builtins]);
  const shownPreview = preview !== null && preview.key === single ? preview : null;

  /** Opens a file and closes the dialog. */
  const openFile = (key: FileKey) => {
    if (key.startsWith('mine:')) onOpen(key.slice(5));
    else {
      const builtin = builtinOf(key);
      if (builtin) onOpenExample(builtin);
    }
  };

  /** Whether a press opens: a double click, a second tap soon after the first, or Enter / Space on the line. */
  const opens = (key: string, e: MouseEvent): boolean => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      lastPress.current = null;
      return false;
    }
    if (e.detail === 0) return true;
    const last = lastPress.current;
    const again = last !== null && last.key === key && e.timeStamp - last.at < DOUBLE_TAP_MS;
    lastPress.current = again || e.detail >= 2 ? null : { key, at: e.timeStamp };
    return again || e.detail >= 2;
  };

  const pressFile = (key: FileKey, e: MouseEvent) => {
    if (!phone && opens(key, e)) {
      openFile(key);
      return;
    }
    const mine = key.startsWith('mine:');
    if (mine && e.shiftKey && anchor !== null && files.includes(anchor)) {
      const [from, to] = [files.indexOf(anchor), files.indexOf(key)].sort((a, b) => a - b);
      setPicked(files.slice(from, to + 1));
    } else if (mine && (e.metaKey || e.ctrlKey)) {
      setPicked(pickedHere.includes(key) ? pickedHere.filter(k => k !== key) : [...pickedHere, key]);
      setAnchor(key);
    } else {
      setPicked([key]);
      setAnchor(key);
      // On a phone a tap shows the file's preview, with Open there.
      if (phone) setPreviewing(true);
    }
  };

  const remove = (ids: string[]) => {
    onDelete(ids);
    setPicked([]);
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (e.target instanceof HTMLInputElement || pickedMine.length === 0) return;
    e.preventDefault();
    remove(pickedMine);
  };

  /** Drops dragged arrangements into `folder`, or to the top level with none. */
  const dropTarget = (folder: string | undefined) => {
    const at = folder ?? '';
    const carries = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE);
    return {
      onDragOver: (e: DragEvent) => {
        if (!carries(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (dropAt !== at) setDropAt(at);
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(now => (now === at ? null : now));
      },
      onDrop: (e: DragEvent) => {
        if (!carries(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropAt(null);
        const ids = e.dataTransfer.getData(DRAG_TYPE).split('\n')
          .filter(id => library.items.some(i => i.id === id && i.folder !== folder));
        if (ids.length > 0) onMove(ids, folder);
      },
    };
  };

  const newFolder = () => {
    const id = onCreateFolder(NEW_FOLDER);
    setRenaming(id);
  };

  // ---- The list where `place` is ----

  const folderLine = (key: string, name: string, onEnter: () => void, mineFolder?: string) => {
    if (mineFolder !== undefined && renaming === mineFolder) {
      return (
        <li key={key} className="tab-row">
          <NameField name={name} label="Folder name" onDone={next => {
            setRenaming(null);
            if (next !== null && next !== name) onRenameFolder(mineFolder, next || NEW_FOLDER);
          }} />
        </li>
      );
    }
    return (
      <li
        key={key} className={`tab-row${mineFolder !== undefined && dropAt === mineFolder ? ' tab-drop' : ''}`}
        {...(mineFolder !== undefined ? dropTarget(mineFolder) : {})}
      >
        <button type="button" className="tab-row-main tab-folder" onClick={onEnter}>
          <FolderIcon />
          <span className="tab-row-text">{name}</span>
          <span className="tab-chooser-enter"><ChevronRightIcon /></span>
        </button>
        {mineFolder !== undefined && (
          <>
            <IconButton label={`Rename ${name}`} onClick={() => setRenaming(mineFolder)}><PencilIcon /></IconButton>
            <IconButton label={`Delete ${name}`} onClick={() => onDeleteFolder(mineFolder)}><TrashIcon /></IconButton>
          </>
        )}
      </li>
    );
  };

  const mineLine = (info: ArrangementInfo) => {
    const key = `mine:${info.id}` as const;
    const name = info.name.trim() || UNTITLED;
    const isPicked = pickedHere.includes(key);
    if (renaming === info.id) {
      return (
        <li key={key} className="tab-row">
          <NameField name={info.name} label="Arrangement name" onDone={next => {
            setRenaming(null);
            if (next !== null && next !== info.name) onRename(info.id, next);
          }} />
        </li>
      );
    }
    return (
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the line is dragged; the button inside is pressed
      <li
        key={key} className="tab-row" draggable
        onDragStart={e => {
          e.dataTransfer.setData(DRAG_TYPE, (isPicked ? pickedMine : [info.id]).join('\n'));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => setDropAt(null)}
      >
        <button
          type="button" className="tab-row-main" aria-current={(exampleId === null && info.id === openId) || undefined}
          aria-pressed={isPicked} onClick={e => pressFile(key, e)}
        >
          <span className="tab-row-text">{name}</span>{' '}
          <span className="tab-row-changed" data-testid="changed">{changedText(info.changed)}</span>
        </button>
        <IconButton label={`Rename ${name}`} onClick={() => setRenaming(info.id)}><PencilIcon /></IconButton>
        <IconButton
          label={isPicked && pickedMine.length > 1 ? `Delete ${pickedMine.length} arrangements` : `Delete ${name}`}
          onClick={() => remove(isPicked ? pickedMine : [info.id])}
        ><TrashIcon /></IconButton>
      </li>
    );
  };

  const builtinLine = (b: Builtin) => {
    const key = `builtin:${b.id}` as const;
    return (
      <li key={key} className="tab-row">
        <button
          type="button" className="tab-row-main" aria-current={b.id === exampleId || undefined}
          aria-pressed={pickedHere.includes(key)} onClick={e => pressFile(key, e)}
        >
          <span className="tab-row-text">{b.title}</span>
        </button>
      </li>
    );
  };

  const placeName = (p: Place): string => {
    if (p.kind === 'root') return 'Arrangements';
    if (p.kind === 'mine') return p.folder === undefined ? 'My arrangements' : (library.folders.find(f => f.id === p.folder)?.name ?? 'My arrangements');
    return p.folder === undefined ? 'Built-in' : folderTitle(p.folder);
  };

  const listItems = () => {
    if (place.kind === 'root') {
      return [
        folderLine('root:mine', 'My arrangements', () => goTo({ kind: 'mine' })),
        folderLine('root:builtin', 'Built-in', () => goTo({ kind: 'builtin' })),
      ];
    }
    if (place.kind === 'mine') {
      // In the two panes the folders are on the left; one folder at a time, they head the list.
      const folderLines = place.folder === undefined && (layout === 'path' || phone)
        ? folders.map(f => folderLine(`folder:${f.id}`, f.name, () => goTo({ kind: 'mine', folder: f.id }), f.id))
        : [];
      return [...folderLines, ...mineIn(place.folder).map(mineLine)];
    }
    if (place.folder === undefined) {
      return builtinFolders.map(f => folderLine(`bfolder:${f}`, folderTitle(f), () => goTo({ kind: 'builtin', folder: f })));
    }
    return builtinsIn(place.folder).map(builtinLine);
  };

  const items = listItems();
  const emptyNote = place.kind === 'mine' ? 'Nothing saved here yet.' : 'Nothing here.';
  const list = (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Delete or Backspace from a picked line, a button inside
    <ul
      className={`tab-rows tab-chooser-list m-0 p-0${dropAt === '' && place.kind === 'mine' && place.folder === undefined ? ' tab-drop' : ''}`}
      aria-label={placeName(place)} onKeyDown={onListKeyDown}
      {...(place.kind === 'mine' ? dropTarget(place.folder) : {})}
    >
      {items.length > 0 ? items : <li className="tab-row tab-examples-note tab-folder-empty">{emptyNote}</li>}
    </ul>
  );

  // ---- The path (layout c, and phones) ----

  const trail: Place[] = place.kind === 'root' ? [place]
    : [{ kind: 'root' }, { kind: place.kind }, ...(place.folder !== undefined ? [place] : [])];
  const path = (
    <nav className="tab-chooser-path" aria-label="Folder">
      {trail.map((p, i) => (
        <span key={i} className="tab-chooser-crumb">
          {i > 0 && <ChevronRightIcon />}
          {i === trail.length - 1
            ? <span aria-current="location">{placeName(p)}</span>
            : <button type="button" className="btn btn-ghost" onClick={() => goTo(p)}>{placeName(p)}</button>}
        </span>
      ))}
    </nav>
  );

  // ---- The places (layout b) ----

  const placeButton = (p: Place, name: string, mineFolder?: string | null) => {
    const dropKey = mineFolder === null ? '' : mineFolder;
    const takesDrops = mineFolder !== undefined;
    return (
      <li
        key={`${p.kind}:${'folder' in p ? p.folder ?? '' : ''}`}
        className={takesDrops && dropAt === dropKey ? 'tab-drop' : undefined}
        {...(takesDrops ? dropTarget(mineFolder ?? undefined) : {})}
      >
        <button
          type="button" className={`tab-row-main tab-chooser-place${mineFolder === null || p.kind === 'builtin' && p.folder === undefined ? ' tab-folder' : ''}`}
          aria-current={samePlace(p, place) || undefined} onClick={() => goTo(p)}
        >
          <FolderIcon />
          <span className="tab-row-text">{name}</span>
        </button>
      </li>
    );
  };
  const places = (
    <nav className="tab-chooser-places" aria-label="Places">
      <ul className="tab-rows m-0 p-0">
        {placeButton({ kind: 'mine' }, 'My arrangements', null)}
        {folders.map(f => (
          <li key={f.id} className="tab-chooser-sub">
            <ul className="tab-rows m-0 p-0">{placeButton({ kind: 'mine', folder: f.id }, f.name, f.id)}</ul>
          </li>
        ))}
      </ul>
      <h3 className="tab-examples-heading m-0 mt-3">Built-in</h3>
      <ul className="tab-rows m-0 p-0">
        {builtinFolders.map(f => placeButton({ kind: 'builtin', folder: f }, folderTitle(f)))}
      </ul>
    </nav>
  );

  // ---- The preview ----

  const pickedName = single === null ? ''
    : single.startsWith('mine:') ? (library.items.find(i => `mine:${i.id}` === single)?.name.trim() || UNTITLED)
      : (builtinOf(single)?.title ?? '');
  const previewPane = (
    <PreviewPane
      name={pickedName} preview={single === null ? null : shownPreview} parts={parts}
      onInsert={clip => { onInsert(clip); }}
    />
  );

  const deletedNote = deleted && (
    <p className="m-0 px-3 tab-examples-note" role="status">
      Deleted {deleted.folder ? `the folder ${deleted.name}` : deleted.name.trim() || UNTITLED}.{' '}
      <button type="button" className="btn btn-ghost tab-undo-delete" onClick={onUndoDelete}>Undo</button>
    </p>
  );

  const footer = (
    <div className="tab-chooser-footer">
      {place.kind === 'mine' && place.folder === undefined && !previewing && (
        <button type="button" className="btn btn-secondary" onClick={newFolder}>New folder</button>
      )}
      <div className="flex gap-2 ml-auto">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={single === null} onClick={() => { if (single) openFile(single); }}>Open</button>
      </div>
    </div>
  );

  let body;
  if (phone && previewing && single !== null) {
    body = (
      <>
        <button type="button" className="btn btn-ghost tab-chooser-back" onClick={() => setPreviewing(false)}>
          <ChevronLeftIcon /> {placeName(place)}
        </button>
        {previewPane}
      </>
    );
  } else if (phone || layout === 'path') {
    body = (
      <>
        {path}
        {deletedNote}
        {list}
        {!phone && previewPane}
      </>
    );
  } else {
    body = (
      <div className="tab-chooser-panes">
        {places}
        <div className="tab-chooser-files">
          {deletedNote}
          {list}
        </div>
        {previewPane}
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Arrangements" className={layout === 'panes' && !phone ? 'tab-chooser-wide' : 'tab-chooser-narrow'}>
      <div ref={bodyRef} className="settings-dialog-body grid gap-3">
        {body}
        {footer}
      </div>
    </Modal>
  );
}

/** The picked file drawn read-only, with Insert and Copy alphaTex; an empty sheet while nothing is picked. */
function PreviewPane({ name, preview, parts, onInsert }: {
  name: string;
  preview: Preview | null;
  parts: Parts;
  onInsert: (clip: Clip) => void;
}) {
  const [ref, width] = useWidth();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const clip = preview && 'clip' in preview ? preview.clip : null;
  const copy = async () => {
    if (!clip) return;
    await navigator.clipboard.writeText(writeAlphaTex(clip));
    setCopied(true);
  };

  return (
    <section className="tab-chooser-preview" aria-label="Preview">
      <div ref={ref} className="tab-chooser-sheet">
        {preview && 'error' in preview && <p className="m-0 tab-examples-note">⚠ {preview.error}</p>}
        {clip && width > 0 && (
          <div style={{ zoom: PREVIEW_ZOOM }}>
            <p className="m-0 mb-2 font-semibold">{name}</p>
            <TabClip clip={partOf(clip)} width={(width - SHEET_PADDING) / PREVIEW_ZOOM} parts={parts} title={`${name}, a preview`} />
          </div>
        )}
      </div>
      {clip && (
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => onInsert(clip)} title="Put it in at the cursor">Insert</button>
          <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
            {copied ? <CheckIcon /> : <CopyIcon />} Copy alphaTex
          </button>
        </div>
      )}
    </section>
  );
}
