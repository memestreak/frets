'use client';

import {
  useCallback, useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState,
} from 'react';
import { HoverTips } from '@/components/HoverTips';
import { CheckIcon, CopyIcon } from '@/components/icons';
import { Modal } from '@/features/practice/quiz/Modal';
import { ShapeMenu } from '@/components/chords/export/ShapeMenu';
import { copySvgAsPng } from '@/components/chords/export/exportImage';
import { menuSpot, useMenuTrigger } from '@/components/chords/export/useMenuTrigger';
import { usePersist } from '@/hooks/usePersist';
import { loadJson, saveJson } from '@/lib/storage';
import { writeAscii } from './ascii';
import { isStandardTuning, unevenMessage, MAX_BPM, MAX_CAPO, MIN_BPM, type Clip } from './clip';
import {
  clipReducer, initClipState, STORAGE_KEY,
} from './clipState';
import {
  clampCursor, clearNote, columnAt, columnCount, copyText, deleteColumns, indexOf, insertColumn,
  isEmpty, MAX_FRET, moveColumn, noteAt, pasteAt, placeOf, runAround, selectedRange, setBarTime, setCapo, setChordName,
  setFret, setSection, setTempo, START, stepDuration, type Cursor, type Selection,
} from './editing';
import { layoutClip, RUN_MARKS, type RunMark, type TextHit } from './layout';
import { BarTimePanel } from './BarTimePanel';
import { WordField } from './WordField';
import { TabClip } from './TabClip';
import { TabPalette } from './TabPalette';
import { TabExportDialog } from './TabExportDialog';
import { parseTabExportStyle, TAB_EXPORT_KEY, tabSvg } from './exportTab';
import { writeAlphaTex } from './alphatex';
import { readTab } from './readTab';
import { applyCyclingKey, applyTool, isOn, toolForKey, WORD_TOOLS, type ToolId, type WordKind } from './tools';
import { exampleById, TAB_EXAMPLES } from './examples';

/** What the line under the clip says: what an import guessed or ignored, why one failed, or that a copy worked. */
interface Notice {
  tone: 'info' | 'error';
  lines: string[];
}

const HASH = '#tab=';
/** An example's link, /tab#example=bends; it stays in the address while the example is shown. */
const EXAMPLE_HASH = '#example=';
const TEXT_FIELDS = 'input, select, textarea, dialog';

type View = 'tab' | 'alphatex' | 'ascii';
const VIEWS: { id: View; label: string }[] = [
  { id: 'tab', label: 'Tab' }, { id: 'ascii', label: 'ASCII' }, { id: 'alphatex', label: 'alphaTex' },
];

/** How long after one digit a second one joins it into a two-digit fret. */
const SECOND_DIGIT_MS = 1000;

/**
 * The Tab page: one clip, brought in as alphaTex or ASCII tab (Import, a
 * drop or a `#tab=` link replace it; a paste goes in at the cursor), or one
 * of the examples in its place (Examples… or a `#example=` link; never
 * saved, and Back to my clip brings the clip back), edited
 * on the tab with the keys and the symbol palette, and shown drawn, as
 * alphaTex or as ASCII. See `docs/specs/2026-10-24-tab-editor-design.md` and
 * `docs/specs/2026-10-25-tab-editing-design.md`; the formats are
 * `public/tab-alphatex.txt` and `public/tab-ascii.txt`.
 */
export default function TabPage() {
  const [state, dispatch] = useReducer(clipReducer, undefined, initClipState);
  const { clip } = state;
  const example = state.example ? exampleById(state.example.id) ?? null : null;
  // An example's edits are never saved: the saved clip waits, untouched, until the example is left.
  useEffect(() => {
    if (!example) saveJson(STORAGE_KEY, clip);
  }, [clip, example]);
  const [choosingExample, setChoosingExample] = useState(false);
  const [view, setView] = useState<View>('tab');
  const [notice, setNotice] = useState<Notice | null>(null);
  // Export: the saved choices, the right-click menu (where it opened) and the dialog.
  const [exportStyle, setExportStyle] = useState(() => parseTabExportStyle(loadJson(TAB_EXPORT_KEY)));
  usePersist(TAB_EXPORT_KEY, exportStyle);
  const [exportMenu, setExportMenu] = useState<{ x: number; y: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const menuTrigger = useMenuTrigger();
  const [importing, setImporting] = useState(false);
  /** Whether the ASCII view's copy button shows its tick, briefly after a copy. */
  const [copied, setCopied] = useState(false);
  const [widthRef, clipWidth] = useWidth();
  // What the text views show; the Tab view's copy writes alphaTex too, the clip's own format.
  const shownText = view === 'ascii' ? writeAscii(clip) : writeAlphaTex(clip);

  /* — the editor: a cursor on a column and string, and a run of selected columns — */
  const [cursorAsSet, setCursor] = useState<Cursor>(START);
  const [selectionAsSet, setSelection] = useState<Selection | null>(null);
  const [editing, setEditing] = useState(false);
  /** The chord name, section or tempo being typed, and where: the cursor's column or bar when it opened. */
  const [word, setWord] = useState<{ kind: WordKind; bar: number; column: number } | null>(null);
  /** The bar whose time signature panel is open. */
  const [timeBar, setTimeBar] = useState<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  /** The digit just typed, so a second one soon after on the same spot makes a two-digit fret. */
  const lastDigit = useRef<{ spot: string; digit: number; at: number } | null>(null);
  // An undo can take away the columns the cursor or the selection were on.
  const cursor = clampCursor(clip, cursorAsSet);
  const count = columnCount(clip);
  const selection = selectionAsSet && Math.max(selectionAsSet.anchor, selectionAsSet.focus) < count ? selectionAsSet : null;
  const target = { cursor, selection };

  /** Records an edit as one undo step and moves the cursor; a change that changed nothing is not a step. */
  const commit = (next: Clip, nextCursor: Cursor = cursor, nextSelection: Selection | null = selection) => {
    if (next !== clip) dispatch({ type: 'replace', clip: next });
    setCursor(nextCursor);
    setSelection(nextSelection);
    setNotice(null);
  };

  const openWord = (kind: WordKind, at: Cursor = cursor) => {
    // A chord name belongs to a column; an empty bar has none yet.
    if (kind === 'chord' && !columnAt(clip, at)) return;
    // The capo belongs to the whole clip, written over its first line.
    if (kind === 'capo') setWord({ kind, bar: 0, column: 0 });
    else setWord({ kind, bar: at.bar, column: at.column });
  };

  const onTool = (id: ToolId) => {
    if (id in WORD_TOOLS) openWord(WORD_TOOLS[id as keyof typeof WORD_TOOLS]);
    // The cursor bar's time signature panel, as a press on its drawn numbers opens (the clip's own in the first bar).
    else if (id === 'barTime') setTimeBar(cursor.bar);
    else commit(applyTool(clip, target, id));
  };

  const closeTimeBar = useCallback((byKey: boolean) => {
    setTimeBar(null);
    if (byKey) editorRef.current?.focus();
  }, []);

  /** A typed chord name, section or tempo set (an empty one clears it); null leaves it as it was. */
  const finishWord = (value: string | null, byKey: boolean) => {
    const w = word;
    setWord(null);
    // After Enter or Esc the keys go back to the tab; leaving the field leaves the focus where it went.
    if (byKey) editorRef.current?.focus();
    if (!w || value === null) return;
    if (w.kind === 'chord') commit(setChordName(clip, { bar: w.bar, column: w.column, string: cursor.string }, value));
    if (w.kind === 'section') commit(setSection(clip, w.bar, value));
    if (w.kind === 'tempo') {
      const typed = Number(value);
      commit(setTempo(clip, w.bar, value === '' ? null : Math.min(MAX_BPM, Math.max(MIN_BPM, typed))));
    }
    // A capo of 0 is no capo.
    if (w.kind === 'capo') commit(setCapo(clip, value === '' || Number(value) === 0 ? null : Math.min(MAX_CAPO, Number(value))));
  };

  /**
 * A press on a drawn chord name, section, tempo or capo opens its field there, with the cursor on its
 * column or bar; one on a time signature opens its bar's panel.
 */
  const onPickText = (hit: TextHit) => {
    const place = hit.kind === 'chord' ? placeOf(clip, hit.index) : { bar: hit.bar, column: 0 };
    const at = { ...cursor, ...place };
    commit(clip, at, null);
    if (hit.kind === 'time') setTimeBar(hit.bar);
    else openWord(hit.kind, at);
  };

  /** The selected columns, or the cursor's column when nothing is selected; null in an empty bar. */
  const copiedRange = (): [number, number] | null => {
    if (selection) return selectedRange(selection);
    if (!columnAt(clip, cursor)) return null;
    const i = indexOf(clip, cursor.bar, cursor.column);
    return [i, i];
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = e;
    if (e.ctrlKey || e.metaKey) {
      if (key.toLowerCase() === 'a' && count > 0) {
        e.preventDefault();
        const last = placeOfLast(clip);
        commit(clip, { ...cursor, ...last }, { anchor: 0, focus: count - 1 });
      }
      // Copy, cut and paste arrive as clipboard events; undo is the page's.
      return;
    }
    const handled = () => e.preventDefault();
    // With Alt, a digit is a tuplet (Alt+3 a triplet), not a fret.
    if (/^[0-9]$/.test(key) && !e.altKey) {
      handled();
      const digit = Number(key);
      const spot = `${cursor.bar}:${cursor.column}:${cursor.string}`;
      const before = lastDigit.current;
      const joined = before && before.spot === spot && e.timeStamp - before.at < SECOND_DIGIT_MS ? before.digit * 10 + digit : null;
      if (joined !== null && joined <= MAX_FRET) {
        lastDigit.current = null;
        commit(setFret(clip, cursor, joined));
      } else {
        lastDigit.current = { spot, digit, at: e.timeStamp };
        commit(setFret(clip, cursor, digit));
      }
      return;
    }
    lastDigit.current = null;
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      handled();
      const string = Math.min(5, Math.max(0, cursor.string + (key === 'ArrowUp' ? -1 : 1)));
      commit(clip, { ...cursor, string });
      return;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      handled();
      const step = key === 'ArrowLeft' ? -1 : 1;
      if (e.shiftKey) {
        if (!columnAt(clip, cursor)) return;
        const moved = moveColumn(clip, cursor, step, false).cursor;
        const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
        commit(clip, moved, { anchor, focus: indexOf(clip, moved.bar, moved.column) });
      } else {
        const moved = moveColumn(clip, cursor, step);
        commit(moved.clip, moved.cursor, null);
      }
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      handled();
      if (selection) {
        const cut = deleteColumns(clip, selectedRange(selection));
        commit(cut.clip, { ...cursor, ...cut.cursor }, null);
      } else if (noteAt(clip, cursor)) {
        commit(clearNote(clip, cursor));
      } else if (columnAt(clip, cursor)) {
        const i = indexOf(clip, cursor.bar, cursor.column);
        const cut = deleteColumns(clip, [i, i]);
        commit(cut.clip, { ...cursor, ...cut.cursor }, null);
      }
      return;
    }
    if (key === '+' || key === '-') {
      handled();
      commit(stepDuration(clip, target, key === '+' ? 1 : -1));
      return;
    }
    if (key === 'Insert') {
      handled();
      commit(insertColumn(clip, cursor), cursor, null);
      return;
    }
    if (key === 'Escape') {
      handled();
      setSelection(null);
      editorRef.current?.blur();
      return;
    }
    const cycled = applyCyclingKey(clip, target, key);
    if (cycled) {
      handled();
      commit(cycled);
      return;
    }
    const tool = toolForKey(key, e.altKey, e.code);
    if (tool) {
      handled();
      onTool(tool);
    }
  };

  const onPick = (hit: Cursor, extend: boolean) => {
    lastDigit.current = null;
    const hasColumn = clip.bars[hit.bar].columns.length > 0;
    if (extend && hasColumn && columnAt(clip, cursor)) {
      const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
      commit(clip, hit, { anchor, focus: indexOf(clip, hit.bar, hit.column) });
    } else {
      commit(clip, hit, null);
    }
  };

  /**
   * A press on a P.M. or let ring line selects every column under it, so its palette button shows
   * pressed and one press turns the whole run off. The cursor goes to the run's first marked note.
   */
  const onPickRun = (mark: RunMark, index: number) => {
    lastDigit.current = null;
    const { has } = RUN_MARKS.find(r => r.mark === mark)!;
    const [from, to] = runAround(clip, index, has);
    const place = placeOf(clip, from);
    const notes = clip.bars[place.bar].columns[place.column].notes;
    const string = notes.findIndex(n => n?.[mark]);
    commit(clip, { ...place, string }, { anchor: from, focus: to });
  };

  /** Puts pasted tab in at the cursor, over the selection if there is one, or says why it can't. */
  const pasteText = useEffectEvent(async (text: string) => {
    const result = await readTab(text);
    if (!result.ok) {
      setNotice({ tone: 'error', lines: result.errors });
      return;
    }
    let into = clip;
    let at = cursor;
    if (selection) {
      const cut = deleteColumns(clip, selectedRange(selection));
      into = cut.clip;
      at = { ...cursor, ...cut.cursor };
    }
    const pasted = pasteAt(into, at, result.clip);
    commit(pasted.clip, pasted.cursor, null);
    if (result.warnings.length > 0) setNotice({ tone: 'info', lines: result.warnings });
    setView('tab');
  });

  /** Writes the selected columns (or the cursor's) to the clipboard as alphaTex; a cut also removes them. */
  const copyOrCut = useEffectEvent((e: ClipboardEvent, cut: boolean) => {
    const range = copiedRange();
    if (!range || !e.clipboardData) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', copyText(clip, range));
    if (!cut) return;
    const left = deleteColumns(clip, range);
    commit(left.clip, { ...cursor, ...left.cursor }, null);
  });

  /** Reads `text`; on success replaces the clip (an example too: it becomes the saved clip) and returns null, else the errors. */
  const importText = useCallback(async (text: string): Promise<string[] | null> => {
    const result = await readTab(text);
    if (!result.ok) return result.errors;
    dispatch({ type: 'import', clip: result.clip });
    clearHash(EXAMPLE_HASH);
    setNotice(result.warnings.length > 0 ? { tone: 'info', lines: result.warnings } : null);
    setView('tab');
    return null;
  }, []);

  /** Shows the example with this id in place of the clip; null when it opened, else why it couldn't. */
  const openExample = useCallback(async (id: string): Promise<string | null> => {
    const chosen = exampleById(id);
    if (!chosen) return `There is no example called "${id}".`;
    const result = await readTab(chosen.text);
    if (!result.ok) return result.errors.join(' ');
    dispatch({ type: 'openExample', id, clip: result.clip });
    setCursor(START);
    setSelection(null);
    setNotice(null);
    setView('tab');
    // The address names the example, so a reload or a copied link shows it again.
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', `${pathname}${search}${EXAMPLE_HASH}${id}`);
    return null;
  }, []);

  const leaveExample = () => {
    dispatch({ type: 'leaveExample' });
    setCursor(START);
    setSelection(null);
    setNotice(null);
    clearHash(EXAMPLE_HASH);
  };

  /** Opens the example in an `#example=` link, or says on the page why it couldn't. */
  const openExampleOrSay = useEffectEvent(async (id: string) => {
    const error = await openExample(id);
    if (error) setNotice({ tone: 'error', lines: [error] });
  });

  /** Imports `text`, or says on the page why it couldn't. */
  const importOrSay = useEffectEvent(async (text: string) => {
    const errors = await importText(text);
    if (errors) setNotice({ tone: 'error', lines: errors });
  });
  // The tab in a `#tab=` link, on load or when a link is followed while the page is open.
  // The hash is cleared so a reload doesn't import it again.
  useEffect(() => {
    const readLink = () => {
      const { hash } = window.location;
      if (hash.startsWith(EXAMPLE_HASH)) {
        void openExampleOrSay(decodeURIComponent(hash.slice(EXAMPLE_HASH.length)));
        return;
      }
      const text = linkText(hash);
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
      void pasteText(text);
    };
    // Copy and cut belong to the editor only; elsewhere they copy the page's own selected text.
    const inEditor = (e: Event) => editorRef.current !== null && editorRef.current.contains(e.target as Node);
    const onCopy = (e: ClipboardEvent) => { if (inEditor(e)) copyOrCut(e, false); };
    const onCut = (e: ClipboardEvent) => { if (inEditor(e)) copyOrCut(e, true); };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      if ((e.target as Element | null)?.closest?.(TEXT_FIELDS)) return;
      e.preventDefault();
      dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      setNotice(null);
    };
    const onDropped = (e: DragEvent) => void onDrop(e);
    document.addEventListener('paste', onPaste);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('keydown', onKey);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDropped);
    return () => {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
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

  const name = clip.name.trim() || 'Untitled clip';
  const empty = isEmpty(clip);
  const unevenLine = unevenMessage(clip) ?? '';

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="grid gap-1">
          <h1 className="m-0">{name}</h1>
          {/* The time signature and capo are drawn on the tab, and set there; this line says only what the tab doesn't. */}
          <p className="m-0 min-h-[1.5em] text-(--ink-muted)" data-testid="clip-facts">
            {[
              !isStandardTuning(clip.tuning) && `Tuning ${clip.tuning.join(' ')}`,
              example && "Example: edits aren't saved",
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="group" aria-label="View">
            {VIEWS.map(v => (
              <button key={v.id} type="button" className="seg-opt" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
          {example && <button type="button" className="btn btn-primary" onClick={leaveExample}>Back to my clip</button>}
          <button type="button" className="btn btn-secondary" onClick={() => setChoosingExample(true)}>Examples…</button>
          <button type="button" className="btn btn-secondary" onClick={() => setImporting(true)}>Import…</button>
          <button type="button" className="btn btn-secondary" onClick={() => setExporting(true)}>Export…</button>
        </div>
      </header>

      <HoverTips>
        <TabPalette isOn={id => isOn(clip, cursor, id)} onTool={onTool} disabled={view !== 'tab'} />
      </HoverTips>

      <section className="card tab-card" aria-label="Clip">
        <div ref={widthRef} className="relative min-w-0">
          {view === 'tab'
            ? clipWidth > 0 && (
              <div
                // A textbox, so screen readers pass the keys through to it as they do to a text field.
                ref={editorRef} className="tab-editor export-trigger" tabIndex={0} role="textbox" aria-multiline="true"
                aria-label="Tab editor: type frets, arrows move, Shift+arrows select; Shift+F10 to export"
                onKeyDown={onKeyDown} onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
                // Right-click, a long press or Shift+F10: Copy as PNG and Export options….
                {...menuTrigger.props((el, x, y) => setExportMenu(menuSpot(el, x, y)))}
              >
                <TabClip
                  clip={clip} width={clipWidth} title={`${name}, drawn as tab`} onPick={onPick} onPickRun={onPickRun}
                  onMiss={() => { setSelection(null); (document.activeElement as HTMLElement | null)?.blur(); }} onPickText={onPickText}
                  highlight={{ cursor: editing ? cursor : null, range: selection ? selectedRange(selection) : null }}
                />
              </div>
            )
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
          {view === 'tab' && word && clipWidth > 0 && (
            <WordField
              key={`${word.kind}-${word.bar}-${word.column}`} kind={word.kind} {...wordSpot(clip, clipWidth, word)}
              initial={wordNow(clip, word)} onDone={finishWord}
            />
          )}
          {view === 'tab' && timeBar !== null && timeBar < clip.bars.length && clipWidth > 0 && (
            <BarTimePanel
              clip={clip} bar={timeBar} {...barTimeSpot(clip, clipWidth, timeBar)}
              onChange={time => commit(setBarTime(clip, timeBar, time))} onClose={closeTimeBar}
            />
          )}
        </div>
      </section>

      <p
        className={`m-0 min-h-[1.5em] ${notice?.tone === 'error' ? 'text-(--danger)' : 'text-(--ink-muted)'}`}
        role="status" data-testid="tab-notice"
      >
        {notice ? notice.lines.join(' ') : empty ? 'Click the tab and type frets, or import or paste alphaTex or ASCII tab.' : unevenLine}
      </p>

      <ImportDialog open={importing} onClose={() => setImporting(false)} onImport={importText} />
      <ExamplesDialog
        open={choosingExample} current={example?.id ?? null} onClose={() => setChoosingExample(false)}
        onOpen={async id => {
          const error = await openExample(id);
          setChoosingExample(false);
          if (error) setNotice({ tone: 'error', lines: [error] });
        }}
      />
      {exportMenu && (
        <ShapeMenu
          x={exportMenu.x} y={exportMenu.y} label="Tab"
          onClose={refocus => {
            if (refocus) editorRef.current?.focus();
            setExportMenu(null);
          }}
          items={[
            {
              label: 'Copy as PNG',
              onSelect: () => {
                copySvgAsPng(tabSvg(clip, exportStyle, clip.name)).then(
                  line => setNotice({ tone: 'info', lines: [`${line}.`] }),
                  (e: unknown) => setNotice({ tone: 'error', lines: [`Couldn't copy: ${e instanceof Error ? e.message : String(e)}`] }),
                );
              },
            },
            { label: 'Export options…', onSelect: () => setExporting(true) },
          ]}
        />
      )}
      <TabExportDialog
        clip={clip} open={exporting} style={exportStyle} onStyle={setExportStyle}
        onClose={() => setExporting(false)}
      />
    </div>
  );
}

/** What a chord name, section or tempo field starts with: what is there now. */
function wordNow(clip: Clip, { kind, bar, column }: { kind: WordKind; bar: number; column: number }): string {
  const b = clip.bars[bar];
  if (kind === 'chord') return b?.columns[column]?.chord ?? '';
  if (kind === 'section') return b?.section?.text ?? '';
  if (kind === 'capo') return clip.capo ? String(clip.capo) : '';
  return b?.tempo ? String(b.tempo.bpm) : '';
}

/** Where a word's field goes over the drawing: above the spot the word is drawn, kept inside the tab's width. */
function wordSpot(clip: Clip, width: number, { kind, bar, column }: { kind: WordKind; bar: number; column: number }): { x: number; y: number } {
  const layout = layoutClip(clip, width);
  const { rows } = layout;
  const FIELD_WIDTH = 180;
  const FIELD_HEIGHT = 64;
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (!placed) continue;
    const row = { chord: rows.chords, section: rows.section, tempo: rows.tempo, capo: rows.capo }[kind];
    const y = s * rows.height + (row ?? rows.staffTop - 20) - FIELD_HEIGHT;
    // The capo is written at the start of the first line, over the time signature.
    const x = kind === 'chord' ? (placed.columns[column]?.x ?? placed.x0) : kind === 'capo' ? 0 : placed.x0 + FIELD_WIDTH / 2;
    return { x: Math.min(width - FIELD_WIDTH / 2, Math.max(FIELD_WIDTH / 2, x)), y: Math.max(0, y) };
  }
  return { x: FIELD_WIDTH / 2, y: 0 };
}

/** Where a bar's time signature panel goes: under the staff of the line the bar is on, from the bar's start, inside the tab's width. */
function barTimeSpot(clip: Clip, width: number, bar: number): { x: number; y: number } {
  const layout = layoutClip(clip, width);
  const PANEL_WIDTH = 230;
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (placed) return { x: Math.max(0, Math.min(width - PANEL_WIDTH, placed.x0)), y: s * layout.rows.height + layout.rows.staffBottom + 12 };
  }
  return { x: 0, y: 0 };
}

/** The last column of the clip, for Ctrl+A. */
function placeOfLast(clip: Clip): { bar: number; column: number } {
  for (let b = clip.bars.length - 1; b >= 0; b--) {
    if (clip.bars[b].columns.length > 0) return { bar: b, column: clip.bars[b].columns.length - 1 };
  }
  return { bar: 0, column: 0 };
}

const BAD_ENCODING = 'The link\'s tab is not percent-encoded correctly.';

/** Takes a `#tab=` or `#example=` hash out of the address, so a reload doesn't bring it back. */
function clearHash(prefix: string) {
  const { pathname, search, hash } = window.location;
  if (hash.startsWith(prefix)) window.history.replaceState(null, '', pathname + search);
}

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

/** The example clips, each with a line on what it shows; choosing one shows it in place of the clip. */
function ExamplesDialog({ open, current, onClose, onOpen }: {
  open: boolean;
  /** The example shown now, marked in the list. */
  current: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Examples" className="tab-examples-dialog">
      <div className="settings-dialog-body grid gap-3">
        <p className="m-0 text-(--ink-muted)">Each shows what Frets draws. Edit one freely: it is never saved, and your own clip waits.</p>
        <ul className="tab-examples m-0 p-0">
          {TAB_EXAMPLES.map(e => (
            <li key={e.id}>
              <button type="button" className="tab-example" aria-current={e.id === current || undefined} onClick={() => onOpen(e.id)}>
                <span className="tab-example-title">{e.title}</span>
                <span className="tab-example-shows">{e.shows}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
