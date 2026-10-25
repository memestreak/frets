'use client';

import {
  useCallback, useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState,
} from 'react';
import { CheckIcon, CopyIcon } from '@/components/icons';
import { Modal } from '@/features/practice/quiz/Modal';
import { usePersist } from '@/hooks/usePersist';
import { writeAscii } from './ascii';
import { isStandardTuning } from './clip';
import {
  clipReducer, initClipState, STORAGE_KEY,
} from './clipState';
import { TabClip } from './TabClip';
import { writeAlphaTex } from './alphatex';
import { readTab } from './readTab';

/** What the line under the clip says: what an import guessed or ignored, why one failed, or that a copy worked. */
interface Notice {
  tone: 'info' | 'error';
  lines: string[];
}

const HASH = '#tab=';
const TEXT_FIELDS = 'input, select, textarea, dialog';

type View = 'tab' | 'alphatex' | 'ascii';
const VIEWS: { id: View; label: string }[] = [
  { id: 'tab', label: 'Tab' }, { id: 'alphatex', label: 'alphaTex' }, { id: 'ascii', label: 'ASCII' },
];

/**
 * The Tab page: one clip, brought in as alphaTex or ASCII tab (Import,
 * paste, drop or a `#tab=` link) and shown drawn, as alphaTex or as ASCII.
 * See `docs/specs/2026-10-24-tab-editor-design.md`; the formats are
 * `public/tab-alphatex.txt` and `public/tab-ascii.txt`.
 */
export default function TabPage() {
  const [state, dispatch] = useReducer(clipReducer, undefined, initClipState);
  const { clip } = state;
  usePersist(STORAGE_KEY, clip);
  const [view, setView] = useState<View>('tab');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [importing, setImporting] = useState(false);
  /** Whether the ASCII view's copy button shows its tick, briefly after a copy. */
  const [copied, setCopied] = useState(false);
  const [widthRef, clipWidth] = useWidth();
  // The alphaTex for Tab and Download, too: it is the clip's own format.
  const shownText = view === 'ascii' ? writeAscii(clip) : writeAlphaTex(clip);

  /** Reads `text`; on success replaces the clip and returns null, else the errors. */
  const importText = useCallback(async (text: string): Promise<string[] | null> => {
    const result = await readTab(text);
    if (!result.ok) return result.errors;
    dispatch({ type: 'replace', clip: result.clip });
    setNotice(result.warnings.length > 0 ? { tone: 'info', lines: result.warnings } : null);
    setView('tab');
    return null;
  }, []);

  /** Imports `text`, or says on the page why it couldn't. */
  const importOrSay = useEffectEvent(async (text: string) => {
    const errors = await importText(text);
    if (errors) setNotice({ tone: 'error', lines: errors });
  });
  // The tab in a `#tab=` link, on load or when a link is followed while the page is open.
  // The hash is cleared so a reload doesn't import it again.
  useEffect(() => {
    const readLink = () => {
      const text = linkText(window.location.hash);
      if (text === null) return;
      const { pathname, search } = window.location;
      window.history.replaceState(null, '', pathname + search);
      if (text instanceof Error) setNotice({ tone: 'error', lines: [BAD_ENCODING] });
      else void importOrSay(text);
    };
    readLink();
    window.addEventListener('hashchange', readLink);
    return () => window.removeEventListener('hashchange', readLink);
  }, []);

  // Paste or drop anywhere on the page; undo and redo.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      const file = [...e.dataTransfer.files].find(f => f.type.startsWith('text/') || /\.txt$/i.test(f.name));
      const text = file ? await file.text() : e.dataTransfer.getData('text/plain');
      if (text) await importOrSay(text);
    };
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as Element | null)?.closest?.(TEXT_FIELDS)) return;
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      void importOrSay(text);
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
      await navigator.clipboard.writeText(shownText);
      setNotice({ tone: 'info', lines: [view === 'ascii' ? 'ASCII copied.' : 'alphaTex copied.'] });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice({ tone: 'error', lines: ['The browser didn\'t allow copying.'] });
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([shownText], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clip.name.trim() || 'tab'}${view === 'ascii' ? '' : '.alphatex'}.txt`;
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
            {VIEWS.map(v => (
              <button key={v.id} type="button" className="seg-opt" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setImporting(true)}>Import…</button>
          <button type="button" className="btn btn-secondary" onClick={download}>Download</button>
        </div>
      </header>

      <section className="card tab-card" aria-label="Clip">
        <div ref={widthRef} className="min-w-0">
          {view === 'tab'
            ? clipWidth > 0 && <TabClip clip={clip} width={clipWidth} title={`${name}, drawn as tab`} />
            : (
              <div className="relative">
                <pre className="tab-ascii" data-testid="tab-ascii">{shownText}</pre>
                <button
                  type="button" className="btn btn-secondary btn-icon tab-ascii-copy"
                  aria-label={view === 'ascii' ? 'Copy ASCII' : 'Copy alphaTex'}
                  title={view === 'ascii' ? 'Copy ASCII' : 'Copy alphaTex'} onClick={() => void copy()}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            )}
        </div>
      </section>

      <p
        className={`m-0 min-h-[1.5em] ${notice?.tone === 'error' ? 'text-(--danger)' : 'text-(--ink-muted)'}`}
        role="status" data-testid="tab-notice"
      >
        {notice ? notice.lines.join(' ') : empty ? 'Import alphaTex or ASCII tab, or paste it here.' : ''}
      </p>

      <ImportDialog open={importing} onClose={() => setImporting(false)} onImport={importText} />
    </div>
  );
}

const BAD_ENCODING = 'The link\'s tab is not percent-encoded correctly.';

/** The tab in a `#tab=` hash; null when the hash is something else, an Error when it can't be decoded. */
function linkText(hash: string): string | Error | null {
  if (!hash.startsWith(HASH)) return null;
  try {
    return decodeURIComponent(hash.slice(HASH.length));
  } catch (e) {
    return e as Error;
  }
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
  onImport: (text: string) => Promise<string[] | null>;
}) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const close = () => {
    setErrors([]);
    onClose();
  };
  const submit = async () => {
    const found = await onImport(text);
    if (found) {
      setErrors(found);
      return;
    }
    setText('');
    close();
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
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={!text.trim()}>Import</button>
        </div>
      </div>
    </Modal>
  );
}
