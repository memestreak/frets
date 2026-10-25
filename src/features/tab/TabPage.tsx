'use client';

import {
  useCallback, useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState,
} from 'react';
import { Modal } from '@/features/practice/quiz/Modal';
import { usePersist } from '@/hooks/usePersist';
import { readAscii, writeAscii } from './ascii';
import { isStandardTuning } from './clip';
import {
  clipReducer, initClipState, STORAGE_KEY, type ClipState,
} from './clipState';
import { TabClip } from './TabClip';

/** What the line under the clip says: what an import guessed or ignored, why one failed, or that a copy worked. */
interface Notice {
  tone: 'info' | 'error';
  lines: string[];
}

const HASH = '#ascii=';
const TEXT_FIELDS = 'input, select, textarea, dialog';

/**
 * The Tab page: one clip, brought in as ASCII tab (Import, paste, drop or a
 * `#ascii=` link) and shown drawn or as ASCII. See
 * `docs/specs/2026-10-24-tab-editor-design.md`; the format is
 * `public/tab-ascii.txt`.
 */
export default function TabPage() {
  const [initial] = useState(startUp);
  const [state, dispatch] = useReducer(clipReducer, initial.state);
  const { clip } = state;
  usePersist(STORAGE_KEY, clip);
  const [view, setView] = useState<'tab' | 'ascii'>('tab');
  const [notice, setNotice] = useState<Notice | null>(initial.notice);
  const [importing, setImporting] = useState(false);
  const [widthRef, clipWidth] = useWidth();
  const ascii = writeAscii(clip);

  /** Reads `text`; on success replaces the clip and returns null, else the errors. */
  const importText = useCallback((text: string): string[] | null => {
    const result = readAscii(text);
    if (!result.ok) return result.errors;
    dispatch({ type: 'replace', clip: result.clip });
    setNotice(result.warnings.length > 0 ? { tone: 'info', lines: result.warnings } : null);
    setView('tab');
    return null;
  }, []);

  /** Imports `text`, or says on the page why it couldn't. */
  const importOrSay = useEffectEvent((text: string) => {
    const errors = importText(text);
    if (errors) setNotice({ tone: 'error', lines: errors });
  });
  // The link's tab was read on the first render; clear it so a reload doesn't import it again.
  useEffect(() => {
    const { hash, pathname, search } = window.location;
    if (hash.startsWith(HASH)) window.history.replaceState(null, '', pathname + search);
  }, []);

  // Paste or drop anywhere on the page; undo and redo.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      const file = [...e.dataTransfer.files].find(f => f.type.startsWith('text/') || /\.txt$/i.test(f.name));
      const text = file ? await file.text() : e.dataTransfer.getData('text/plain');
      if (text) importOrSay(text);
    };
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as Element | null)?.closest?.(TEXT_FIELDS)) return;
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      importOrSay(text);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      if ((e.target as Element | null)?.closest?.(TEXT_FIELDS)) return;
      e.preventDefault();
      dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      setNotice(null);
    };
    const onDropped = (e: DragEvent) => void onDrop(e);
    document.addEventListener('paste', onPaste);
    document.addEventListener('keydown', onKey);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDropped);
    return () => {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDropped);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ascii);
      setNotice({ tone: 'info', lines: ['ASCII copied.'] });
    } catch {
      setNotice({ tone: 'error', lines: ['The browser didn\'t allow copying.'] });
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([`${ascii}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clip.name.trim() || 'tab'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const name = clip.name.trim() || 'Untitled clip';
  const facts = [`${clip.time.beats}/${clip.time.value}`];
  if (!isStandardTuning(clip.tuning)) facts.push(`Tuning ${clip.tuning.join(' ')}`);
  const empty = clip.bars.every(b => b.columns.length === 0);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="grid gap-1">
          <h1 className="m-0">{name}</h1>
          <p className="m-0 text-(--ink-muted)" data-testid="clip-facts">{facts.join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="group" aria-label="View">
            <button type="button" className="seg-opt" aria-pressed={view === 'tab'} onClick={() => setView('tab')}>Tab</button>
            <button type="button" className="seg-opt" aria-pressed={view === 'ascii'} onClick={() => setView('ascii')}>ASCII</button>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setImporting(true)}>Import…</button>
          <button type="button" className="btn btn-secondary" onClick={() => void copy()}>Copy ASCII</button>
          <button type="button" className="btn btn-secondary" onClick={download}>Download</button>
        </div>
      </header>

      <section className="card tab-card" aria-label="Clip">
        <div ref={widthRef} className="min-w-0">
          {view === 'tab'
            ? clipWidth > 0 && <TabClip clip={clip} width={clipWidth} title={`${name}, drawn as tab`} />
            : <pre className="tab-ascii" data-testid="tab-ascii">{ascii}</pre>}
        </div>
      </section>

      <p
        className={`m-0 min-h-[1.5em] ${notice?.tone === 'error' ? 'text-(--danger)' : 'text-(--ink-muted)'}`}
        role="status" data-testid="tab-notice"
      >
        {notice ? notice.lines.join(' ') : empty ? 'Import ASCII tab, or paste it here.' : ''}
      </p>

      <ImportDialog open={importing} onClose={() => setImporting(false)} onImport={importText} />
    </div>
  );
}

/** The saved clip, or the tab in the page's `#ascii=` link with the saved clip one undo back. */
function startUp(): { state: ClipState; notice: Notice | null } {
  const saved = initClipState();
  const { hash } = window.location;
  if (!hash.startsWith(HASH)) return { state: saved, notice: null };
  let text: string;
  try {
    text = decodeURIComponent(hash.slice(HASH.length));
  } catch {
    return { state: saved, notice: { tone: 'error', lines: ['The link\'s tab is not percent-encoded correctly.'] } };
  }
  const result = readAscii(text);
  if (!result.ok) return { state: saved, notice: { tone: 'error', lines: result.errors } };
  return {
    state: clipReducer(saved, { type: 'replace', clip: result.clip }),
    notice: result.warnings.length > 0 ? { tone: 'info', lines: result.warnings } : null,
  };
}

/** The width of an element, kept up to date. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setValue(Math.floor(el.clientWidth) || 800);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, value] as const;
}

function ImportDialog({ open, onClose, onImport }: {
  open: boolean;
  onClose: () => void;
  onImport: (text: string) => string[] | null;
}) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const close = () => {
    setErrors([]);
    onClose();
  };
  const submit = () => {
    const found = onImport(text);
    if (found) {
      setErrors(found);
      return;
    }
    setText('');
    close();
  };
  return (
    <Modal open={open} onClose={close} title="Import ASCII tab" className="tab-import">
      <div className="settings-dialog-body grid gap-3">
        <textarea
          className="input tab-import-text" value={text} onChange={e => setText(e.target.value)}
          aria-label="ASCII tab" spellCheck={false} rows={12}
          placeholder={'e|-----5h7-----|\nB|---5-------8-|\n…'}
        />
        <p className="m-0 text-(--ink-muted)">
          Format: <a href="/tab-ascii.txt" target="_blank" rel="noreferrer">frets.eminor.net/tab-ascii.txt</a>.
          Importing replaces the clip; Ctrl+Z brings it back.
        </p>
        {errors.length > 0 && (
          <ul className="m-0 pl-5 text-(--danger)" data-testid="import-errors">
            {errors.map(e => <li key={e}>{e}</li>)}
          </ul>
        )}
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={submit} disabled={!text.trim()}>Import</button>
        </div>
      </div>
    </Modal>
  );
}
