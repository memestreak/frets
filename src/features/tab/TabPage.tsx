'use client';

import {
  type FocusEvent, useCallback, useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState,
} from 'react';
import { HoverTips } from '@/components/HoverTips';
import { CheckIcon, CopyIcon, PencilIcon, TrashIcon } from '@/components/icons';
import { Modal } from '@/features/practice/quiz/Modal';
import { DIVIDER, ShapeMenu, type MenuEntry, type MenuItem } from '@/components/chords/export/ShapeMenu';
import { copySvgAsPng, svgToPng } from '@/components/chords/export/exportImage';
import { SAVE_KINDS, saveFile, type SaveKind } from './saveFile';
import { menuSpot, useMenuTrigger } from '@/components/chords/export/useMenuTrigger';
import { usePersist } from '@/hooks/usePersist';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { loadJson, saveJson } from '@/lib/storage';
import { writeAscii } from './ascii';
import { barErrors, brokenTupletMessage, isRest, isStandardTuning, unevenMessage, MAX_CAPO, type Clip } from './clip';
import {
  clipReducer, initClipState, STORAGE_KEY,
} from './clipState';
import {
  clampCursor, clearNote, columnAt, columnCount, copyText, deleteColumns, indexOf, insertBar, insertColumn,
  fillBar, isEmpty, makeRest, MAX_FRET, moveColumn, noteAt, pasteAt, placeOf, readTempo, removeEmptyBar, runAround, selectedRange, setBarTime, setCapo, setChordName,
  setBeatText, setBend, setFret, setTuplet, setSection, setTempo, tempoText, START, stepDuration, type Cursor, type Selection,
} from './editing';
import { layoutClip, RUN_MARKS, textBox, type RunMark, type TextHit, type WordHit } from './layout';
import { BarTimePanel } from './BarTimePanel';
import { WordField } from './WordField';
import { TabClip } from './TabClip';
import { TabPalette } from './TabPalette';
import { TabExportDialog } from './TabExportDialog';
import { parseTabExportStyle, TAB_EXPORT_KEY, tabSvg } from './exportTab';
import { writeAlphaTex } from './alphatex';
import { AlphaTexEditor } from './AlphaTexEditor';
import { readTab } from './readTab';
import { applyCyclingKey, applyTool, applyTupletKey, isOn, noteKinds, toolForKey, WORD_TOOL, WORD_TOOLS, type ToolId, type WordKind } from './tools';
import { exampleById, TAB_EXAMPLES } from './examples';
import { LoopHandles, PLAYBACK_KEY, PlaybackFooter, Playhead, parsePlaybackSettings, usePlayback } from './PlaybackFooter';

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
  { id: 'tab', label: 'Standard' }, { id: 'ascii', label: 'ASCII Tab' }, { id: 'alphatex', label: 'AlphaTex' },
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
  // Export: the saved choices and the dialog. The right-click menu (where it opened) inserts bars.
  const [exportStyle, setExportStyle] = useState(() => parseTabExportStyle(loadJson(TAB_EXPORT_KEY)));
  usePersist(TAB_EXPORT_KEY, exportStyle);
  /** The right-click menu, where it opened and over which view: inserting bars and Save as in Standard, Save as in the text views. */
  const [menu, setMenu] = useState<{ x: number; y: number; view: View } | null>(null);
  /** Which mock of the Save as items the menu shows (?mock=a, b or c; a without one). */
  const [mock] = useState(() => new URLSearchParams(window.location.search).get('mock') ?? 'a');
  const [exporting, setExporting] = useState(false);
  const menuTrigger = useMenuTrigger();
  const [importing, setImporting] = useState(false);
  /** Whether the ASCII view's copy button shows its tick, briefly after a copy. */
  const [copied, setCopied] = useState(false);
  const [widthRef, boxWidth] = useWidth();
  // The view switch and the copy button sit in a strip above it, so the tab takes the card's whole width.
  const clipWidth = boxWidth;
  /**
   * The AlphaTex view's text as typed, and the clip it was typed against: kept, across changes of
   * view, until an edit elsewhere (on the Standard view, an undo, an import) changes the clip; then the
   * clip is written out again in Frets' own layout, without comments (Jeremy, 2026-10-27).
   */
  const [draft, setDraft] = useState<{ text: string; clip: Clip } | null>(null);
  const alphaTexText = draft && draft.clip === clip ? draft.text : writeAlphaTex(clip);
  // What the text views show and copy.
  const shownText = view === 'ascii' ? writeAscii(clip) : alphaTexText;

  /* — the editor: a cursor on a column and string, and a run of selected columns — */
  const [cursorAsSet, setCursor] = useState<Cursor>(START);
  const [selectionAsSet, setSelection] = useState<Selection | null>(null);
  const [editing, setEditing] = useState(false);
  /**
   * The cursor is on its column only, with no string picked (Jeremy, 2026-10-27): Esc on a string, or a
   * press above or below the staff while the playback controls are hidden. The tools and keys then work
   * on the whole column; ↑ ↓ or a press on a string pick a string again.
   */
  const [columnOnly, setColumnOnly] = useState(false);
  /** The chord name, text, section, tempo or capo being typed, and where: the cursor's column or bar when it opened. */
  const [word, setWord] = useState<{ kind: WordKind; bar: number; column: number } | null>(null);
  /** The chord name, text, section, tempo or capo picked by a press: outlined, with Edit and Delete beside it. */
  const [picked, setPicked] = useState<WordHit | null>(null);
  /** Whether the palette shows the cursor's notes: only while the tab has the keys and no word is picked. */
  const lit = editing && !picked;
  /** The palette tool that sets the picked word, lit while it is picked. */
  const pickedTool = editing && picked ? WORD_TOOL[picked.kind] : null;
  /** The bar whose time signature panel is open. */
  const [timeBar, setTimeBar] = useState<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  /** The digit just typed, so a second one soon after on the same spot makes a two-digit fret. */
  const lastDigit = useRef<{ spot: string; digit: number; at: number } | null>(null);
  // An undo can take away the columns the cursor or the selection were on.
  const cursor = clampCursor(clip, cursorAsSet);
  const count = columnCount(clip);
  const selection = selectionAsSet && Math.max(selectionAsSet.anchor, selectionAsSet.focus) < count ? selectionAsSet : null;
  // With no string picked, the tools work on the cursor's whole column, as on a one-column selection.
  const cursorIndex = indexOf(clip, cursor.bar, cursor.column);
  const target = {
    cursor,
    selection: selection ?? (columnOnly && columnAt(clip, cursor) ? { anchor: cursorIndex, focus: cursorIndex } : null),
  };
  // The controls show only when chosen (the small button under the tab); hidden, Space doesn't play.
  const [playbackSettings, setPlaybackSettings] = useState(() => parsePlaybackSettings(loadJson(PLAYBACK_KEY)));
  usePersist(PLAYBACK_KEY, playbackSettings);
  const showPlayback = playbackSettings.shown;
  // The playback line: put on a column by a press above or below the staff (Jeremy,
  // 2026-10-26); it holds until the clip, the cursor or the selection changes. Play starts there,
  // else at the selection's first column, else the cursor's, else the first; Loop takes the selection.
  const [playMark, setPlayMark] = useState<{ index: number; clip: Clip; cursor: Cursor; selection: Selection | null } | null>(null);
  const playback = usePlayback(clip, playbackSettings.sound, playbackSettings.volume);
  /**
   * A text view has no playback, so leaving the Tab view stops it. The editor goes away with the
   * view without a blur, so it is no longer being edited.
   */
  const chooseView = (next: View) => {
    if (next !== 'tab') {
      playback.stop();
      setEditing(false);
      setPicked(null);
    }
    setView(next);
  };
  /** A clip read from the AlphaTex view's text: one undo step, and the text stays as typed. */
  const applyAlphaTex = (next: Clip, text: string) => {
    dispatch({ type: 'replace', clip: next });
    setDraft(d => (d && d.text === text ? { text, clip: next } : d));
  };
  const showPlaybackControls = (shown: boolean) => {
    if (!shown) playback.stop();
    setPlaybackSettings(s => ({ ...s, shown }));
  };
  const selectedColumns = selection ? selectedRange(selection) : null;
  const markAt = playMark && playMark.clip === clip && playMark.cursor === cursorAsSet && playMark.selection === selectionAsSet
    ? playMark.index : null;
  // Else Play starts at the selection, else the cursor; with no cursor on the tab, from the beginning.
  const playFrom = markAt ?? (selectedColumns ? selectedColumns[0] : editing ? indexOf(clip, cursor.bar, cursor.column) : 0);
  /**
   * A press above or below the staff: the playback line goes there (while playing, playback jumps
   * there), and any selection goes. With Shift, the columns from the line (else the selection's
   * anchor, else the cursor) to there are selected, with no string picked (Jeremy, 2026-10-27).
   */
  const pickColumn = (index: number, extend: boolean) => {
    const anchor = markAt ?? selection?.anchor ?? (editing ? indexOf(clip, cursor.bar, cursor.column) : null);
    if (extend && anchor !== null) {
      setSelection({ anchor, focus: index });
      return;
    }
    if (playback.seek(index)) return;
    setSelection(null);
    setPlayMark({ index, clip, cursor: cursorAsSet, selection: null });
  };
  /**
   * A press above or below the staff while the playback controls are hidden: the cursor goes to that
   * column with no string picked (Jeremy, 2026-10-27). With Shift, the columns from the cursor to there are selected.
   */
  const pickColumnOnly = (index: number, extend: boolean) => {
    lastDigit.current = null;
    const place = placeOf(clip, index);
    const at = { ...cursor, bar: place.bar, column: place.column };
    if (extend && editing && columnAt(clip, cursor)) {
      commit(clip, at, { anchor: selection?.anchor ?? cursorIndex, focus: index });
    } else {
      const left = editing && at.bar !== cursor.bar ? fillBar(clip, cursor.bar) : clip;
      commit(left, at, null);
    }
    setColumnOnly(true);
    editorRef.current?.focus();
  };
  /**
   * Off the tab (no string picked), the arrow keys work on the playback line while the footer shows
   * (Jeremy, 2026-10-27): ← → move it a column, Shift+← → select from it (or grow the selection
   * made so), and Esc drops both. On the tab, in a field or a dialog, the keys do what they did.
   */
  const onLineKey = useEffectEvent((e: KeyboardEvent) => {
    if (!showPlayback || view !== 'tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as Element | null;
    if (target?.closest?.('input, select, textarea, dialog, [role="menu"], [role="slider"], .tab-editor')) return;
    if (e.key === 'Escape') {
      if (markAt === null && !selection) return;
      setPlayMark(null);
      setSelection(null);
      e.preventDefault();
      return;
    }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const within = (i: number) => Math.min(count - 1, Math.max(0, i));
    if (e.shiftKey) {
      const anchor = markAt ?? selection?.anchor;
      const from = selection ? selection.focus : markAt;
      if (anchor === undefined || anchor === null || from === null) return;
      setSelection({ anchor, focus: within(from + step) });
    } else {
      const from = markAt ?? selection?.focus;
      if (from === undefined) return;
      setSelection(null);
      setPlayMark({ index: within(from + step), clip, cursor: cursorAsSet, selection: null });
    }
    e.preventDefault();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onLineKey(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // While the footer shows, Space anywhere on the page plays and stops (Jeremy, 2026-10-26), but not
  // in a field or a dialog; the tab keeps the focus, so its cursor stays.
  useSpaceKey(() => playback.toggle(playFrom), { enabled: showPlayback, keepFocusOn: '.tab-editor' });

  /** Records an edit as one undo step and moves the cursor; a change that changed nothing is not a step. */
  const commit = (next: Clip, nextCursor: Cursor = cursor, nextSelection: Selection | null = selection) => {
    if (next !== clip) dispatch({ type: 'replace', clip: next });
    setCursor(nextCursor);
    setSelection(nextSelection);
    setPicked(null);
    setNotice(null);
  };

  const openWord = (kind: WordKind, at: Cursor = cursor) => {
    // A chord name or text belongs to a column; an empty bar has none yet.
    if ((kind === 'chord' || kind === 'text') && !columnAt(clip, at)) return;
    // The capo belongs to the whole clip, written over its first line.
    if (kind === 'capo') setWord({ kind, bar: 0, column: 0 });
    else setWord({ kind, bar: at.bar, column: at.column });
  };

  /** A bar of rests before or after the cursor's bar (Ctrl+Shift+Enter or Ctrl+Enter, the Bars group, the menu), with the cursor in it. */
  const addBar = (where: 'before' | 'after') => {
    const next = insertBar(clip, cursor, where);
    commit(next.clip, next.cursor, null);
  };

  const onTool = (id: ToolId) => {
    if (id in WORD_TOOLS) openWord(WORD_TOOLS[id as keyof typeof WORD_TOOLS]);
    // The cursor bar's time signature panel, as a press on its drawn numbers opens (the clip's own in the first bar).
    else if (id === 'barTime') setTimeBar(cursor.bar);
    else if (id === 'insertBar') addBar('after');
    else if (id === 'insertBarBefore') addBar('before');
    // A dead note goes on one string; with none picked there is nothing to mark.
    else if (!(columnOnly && id === 'dead')) commit(applyTool(clip, target, id));
  };

  const closeTimeBar = useCallback((byKey: boolean) => {
    setTimeBar(null);
    if (byKey) editorRef.current?.focus();
  }, []);

  /** A typed chord name, text, section, tempo or capo set (an empty one clears it); null leaves it as it was. */
  const finishWord = (value: string | null, byKey: boolean) => {
    const w = word;
    setWord(null);
    // After Enter or Esc the keys go back to the tab; leaving the field leaves the focus where it went.
    if (byKey) editorRef.current?.focus();
    if (!w || value === null) return;
    if (w.kind === 'chord') commit(setChordName(clip, { bar: w.bar, column: w.column, string: cursor.string }, value));
    if (w.kind === 'text') commit(setBeatText(clip, { bar: w.bar, column: w.column, string: cursor.string }, value));
    if (w.kind === 'section') commit(setSection(clip, w.bar, value));
    if (w.kind === 'tempo') {
      // Text that isn't a tempo leaves it as it was.
      const tempo = readTempo(value);
      if (tempo !== undefined) commit(setTempo(clip, w.bar, tempo));
    }
    // A capo of 0 is no capo.
    if (w.kind === 'capo') commit(setCapo(clip, value === '' || Number(value) === 0 ? null : Math.min(MAX_CAPO, Number(value))));
  };

  /** Where a word over the tab belongs: its column, or its bar's first. */
  const wordPlace = (hit: TextHit): Cursor => ({ ...cursor, ...('index' in hit ? placeOf(clip, hit.index) : { bar: hit.bar, column: 0 }) });

  /**
   * A press on a drawn chord name, text, section, tempo or capo picks it, with the cursor on its column or
   * bar: outlined, with Edit and Delete to its right, and Enter or Delete do the same (Jeremy, 2026-10-27;
   * a press had opened its field at once). One on a time signature opens its bar's panel.
   */
  const onPickText = (hit: TextHit) => {
    const at = wordPlace(hit);
    commit(clip, at, null);
    if (hit.kind === 'time') {
      setTimeBar(hit.bar);
      return;
    }
    setPicked(hit);
    editorRef.current?.focus();
  };

  /** Opens the picked word's field. */
  const editPicked = (hit: WordHit) => {
    const at = wordPlace(hit);
    commit(clip, at, null);
    openWord(hit.kind, at);
  };

  /** Takes the picked word away; the cursor stays where it was put. */
  const deletePicked = (hit: WordHit) => {
    const at = wordPlace(hit);
    if (hit.kind === 'chord') commit(setChordName(clip, at, ''), at);
    if (hit.kind === 'text') commit(setBeatText(clip, at, ''), at);
    if (hit.kind === 'section') commit(setSection(clip, at.bar, ''), at);
    if (hit.kind === 'tempo') commit(setTempo(clip, at.bar, null), at);
    if (hit.kind === 'capo') commit(setCapo(clip, null), at);
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
    // A picked word: Delete takes it away, Enter edits it, Esc lets it go; any other key lets it go and does what it does.
    if (picked) {
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        deletePicked(picked);
        return;
      }
      if (key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        editPicked(picked);
        return;
      }
      setPicked(null);
      if (key === 'Escape') {
        e.preventDefault();
        return;
      }
    }
    if (key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Space on the tab never types or scrolls; while the footer shows, the page-wide key plays.
      e.preventDefault();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (key === 'Enter') {
        e.preventDefault();
        addBar(e.shiftKey ? 'before' : 'after');
      }
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
      // A fret goes on a string; with none picked, ↑ ↓ or a press picks one first.
      if (columnOnly) return;
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
      // With no string picked, ↑ ↓ pick back the string the cursor was last on.
      const string = columnOnly ? cursor.string : Math.min(5, Math.max(0, cursor.string + (key === 'ArrowUp' ? -1 : 1)));
      commit(clip, { ...cursor, string });
      setColumnOnly(false);
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
      const column = columnAt(clip, cursor);
      if (selection) {
        const cut = deleteColumns(clip, selectedRange(selection));
        commit(cut.clip, { ...cursor, ...cut.cursor }, null);
      } else if (!columnOnly && noteAt(clip, cursor)) {
        commit(clearNote(clip, cursor));
      } else if (column && !isRest(column)) {
        // On an empty string of a column with notes: the column becomes a rest first (Jeremy, 2026-10-27).
        commit(makeRest(clip, { cursor, selection: null }));
      } else if (column) {
        const i = indexOf(clip, cursor.bar, cursor.column);
        const cut = deleteColumns(clip, [i, i]);
        commit(cut.clip, { ...cursor, ...cut.cursor }, null);
      } else {
        // An empty bar: Delete takes the bar itself away.
        const cut = removeEmptyBar(clip, cursor.bar);
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
      setPlayMark(null);
      // On a string, Esc first drops the string and keeps the column (Jeremy, 2026-10-27); then it leaves the tab.
      if (!columnOnly && !selection && columnAt(clip, cursor)) setColumnOnly(true);
      else editorRef.current?.blur();
      return;
    }
    // B (the bend's shape) and / (the slide's kind) step one string's note; with none picked they do nothing.
    const cycled = columnOnly && (key === 'B' || key === '/') ? null : applyCyclingKey(clip, target, key);
    if (cycled) {
      handled();
      commit(cycled);
      return;
    }
    const tupleted = e.altKey ? applyTupletKey(clip, target, e.code) : null;
    if (tupleted) {
      handled();
      commit(tupleted);
      return;
    }
    const tool = toolForKey(key, e.altKey);
    if (tool) {
      handled();
      onTool(tool);
    }
  };

  const onPick = (hit: Cursor, extend: boolean) => {
    lastDigit.current = null;
    setColumnOnly(false);
    const hasColumn = clip.bars[hit.bar].columns.length > 0;
    if (extend && hasColumn && columnAt(clip, cursor)) {
      const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
      commit(clip, hit, { anchor, focus: indexOf(clip, hit.bar, hit.column) });
    } else {
      // A press in another bar leaves the cursor's bar, which fills up; the rests go after its last
      // column, so the bar pressed keeps its columns.
      const left = editing && hit.bar !== cursor.bar ? fillBar(clip, cursor.bar) : clip;
      commit(left, hit, null);
    }
  };

  /**
   * The tab losing the focus leaves the cursor's bar, which fills up (Jeremy, 2026-10-27): a press
   * off the tab, Esc. Not while the focus stays on the clip's own parts (a chord name's field, the
   * time signature panel) or goes to the palette, nor when the whole window loses it.
   */
  const onEditorBlur = (e: FocusEvent<HTMLDivElement>) => {
    setEditing(false);
    setPicked(null);
    setColumnOnly(false);
    const to = e.relatedTarget;
    if (to instanceof Element && to.closest('.tab-card, .tab-palette')) return;
    if (!document.hasFocus()) return;
    const filled = fillBar(clip, cursor.bar);
    if (filled !== clip) dispatch({ type: 'replace', clip: filled });
  };

  /**
   * A press on a P.M. or let ring line selects every column under it, so its palette button shows
   * pressed and one press turns the whole run off. The cursor goes to the run's first marked note.
   */
  const onPickRun = (mark: RunMark, index: number) => {
    lastDigit.current = null;
    setColumnOnly(false);
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
      const file = [...e.dataTransfer.files].find(isTabFile);
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

  const showCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  /** Copies the tab as the Export dialog's PNG: the Tab view's copy button. */
  const copyPng = async () => {
    try {
      const line = await copySvgAsPng(tabSvg(clip, exportStyle, clip.name));
      setNotice({ tone: 'info', lines: [`${line}.`] });
      showCopied();
    } catch (e) {
      setNotice({ tone: 'error', lines: [`Couldn't copy: ${e instanceof Error ? e.message : String(e)}`] });
    }
  };

  /** The ASCII and alphaTex views copy their text; the Tab view copies the picture. */
  const copy = async () => {
    if (view === 'tab') return copyPng();
    try {
      await navigator.clipboard.writeText(shownText);
      setNotice({ tone: 'info', lines: ['Copied as text.'] });
      showCopied();
    } catch {
      setNotice({ tone: 'error', lines: ['The browser didn\'t allow copying.'] });
    }
  };
  const copyLabel = { tab: 'Copy as PNG', ascii: 'Copy as text', alphatex: 'Copy as text' }[view];
  const copyButton = (
    <button
      type="button" className="btn btn-secondary btn-icon"
      aria-label={copyLabel} title={copyLabel} onClick={() => void copy()}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );

  /** Saves the clip in one format, through the browser's Save As dialog where it has one. */
  const save = (kind: SaveKind, make: () => Blob | Promise<Blob>) => {
    saveFile(clip.name.trim() || 'tab', kind, make).then(
      line => { if (line) setNotice({ tone: 'info', lines: [line] }); },
      (e: unknown) => setNotice({ tone: 'error', lines: [`Couldn't save: ${e instanceof Error ? e.message : String(e)}`] }),
    );
  };
  const text = (s: string) => new Blob([s], { type: 'text/plain' });
  /** The picture as the Export dialog makes it, with its saved choices. */
  const picture = () => tabSvg(clip, exportStyle, clip.name);
  /** The Standard view's Save as formats, labelled for each mock. */
  const saveItems = (prefix: string): MenuItem[] => [
    { label: `${prefix}PNG…`, onSelect: () => save(SAVE_KINDS.png, () => svgToPng(picture())) },
    { label: `${prefix}SVG…`, onSelect: () => save(SAVE_KINDS.svg, () => new Blob([picture()], { type: 'image/svg+xml' })) },
    { label: `${prefix}ASCII tab…`, onSelect: () => save(SAVE_KINDS.ascii, () => text(writeAscii(clip))) },
    { label: `${prefix}alphaTex…`, onSelect: () => save(SAVE_KINDS.alphatex, () => text(writeAlphaTex(clip))) },
  ];
  const menuItems = (over: View): MenuEntry[] => {
    if (over === 'ascii') return [{ label: 'Save as text file…', onSelect: () => save(SAVE_KINDS.ascii, () => text(writeAscii(clip))) }];
    // The text as typed, comments and all.
    if (over === 'alphatex') return [{ label: 'Save as alphaTex file…', onSelect: () => save(SAVE_KINDS.alphatex, () => text(alphaTexText)) }];
    const bars: MenuEntry[] = [
      // The bar under a right-click already has the cursor: the press put it there.
      { label: 'Insert bar before', onSelect: () => addBar('before') },
      { label: 'Insert bar after', onSelect: () => addBar('after') },
      DIVIDER,
    ];
    if (mock === 'b') return [...bars, { label: 'Save as', items: saveItems('') }];
    if (mock === 'c') return [...bars, { heading: 'Save as' }, ...saveItems('')];
    return [...bars, ...saveItems('Save as ')];
  };

  const name = clip.name.trim() || 'Untitled clip';
  const empty = isEmpty(clip);
  // Bars that don't add up, and tuplets missing notes, said in a line under the tab (never a tint on it).
  const unevenLine = [unevenMessage(clip), brokenTupletMessage(clip)].filter(Boolean).join(' ');

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
          {example && <button type="button" className="btn btn-primary" onClick={leaveExample}>Back to my clip</button>}
          <button type="button" className="btn btn-secondary" onClick={() => setChoosingExample(true)}>Examples…</button>
          <button type="button" className="btn btn-secondary" onClick={() => setImporting(true)}>Import…</button>
          <button type="button" className="btn btn-secondary" onClick={() => setExporting(true)}>Export options</button>
        </div>
      </header>

      <HoverTips>
        {/* Lit only while the cursor is in the tab: off it, nothing is under the cursor. */}
        <TabPalette
          // Lit for the cursor's notes; while a word over the tab is picked, only that word's tool (Jeremy, 2026-10-27).
          isOn={id => (pickedTool ? id === pickedTool : lit && isOn(clip, cursor, id, columnOnly))} kinds={noteKinds(clip, lit ? cursor : null)}
          onTool={onTool} onBend={quarters => commit(setBend(clip, target, quarters))}
          onTuplet={n => commit(setTuplet(clip, target, n))} disabled={view !== 'tab'} />
      </HoverTips>

      <section className="card tab-card" aria-label="Clip">
        {/* Over the clip: the copy button at the top left, the view switch at the top right (Jeremy, 2026-10-27; the switch had been in the header). */}
        <div className="tab-card-bar">
          {copyButton}
          <div className="seg" role="group" aria-label="View">
            {VIEWS.map(v => (
              <button key={v.id} type="button" className="seg-opt" aria-pressed={view === v.id} onClick={() => chooseView(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div ref={widthRef} className="relative min-w-0">
          {/* Under the editor, so the playhead's band tints the paper, not the numbers. */}
          {view === 'tab' && showPlayback && clipWidth > 0 && <Playhead clip={clip} width={clipWidth} playback={playback} mark={markAt} />}
          {view === 'tab'
            ? clipWidth > 0 && (
              <div
                // A textbox, so screen readers pass the keys through to it as they do to a text field.
                ref={editorRef} className="tab-editor export-trigger" tabIndex={0} role="textbox" aria-multiline="true"
                aria-label="Tab editor: type frets, arrows move, Shift+arrows select; Shift+F10 to insert a bar"
                onKeyDown={onKeyDown} onFocus={() => setEditing(true)} onBlur={onEditorBlur}
                // Right-click, a long press or Shift+F10: insert a bar before or after.
                {...menuTrigger.props((el, x, y) => setMenu({ ...menuSpot(el, x, y), view: 'tab' }))}
              >
                {/* A bar's warning explains itself on hover. */}
                <HoverTips>
                  <TabClip
                    clip={clip} width={clipWidth} title={`${name}, drawn as tab`} onPick={onPick} onPickRun={onPickRun}
                    onMiss={() => { setSelection(null); setPlayMark(null); setPicked(null); (document.activeElement as HTMLElement | null)?.blur(); }} onPickText={onPickText}
                    onPickColumn={showPlayback ? pickColumn : pickColumnOnly}
                    highlight={{ cursor: editing && !picked ? cursor : null, range: selection ? selectedRange(selection) : null, columnOnly }}
                    picked={editing ? picked : null}
                    errors={barErrors(clip)}
                  />
                </HoverTips>
              </div>
            )
            : view === 'alphatex'
              ? (
                <HoverTips>
                  <div {...menuTrigger.props((el, x, y) => setMenu({ ...menuSpot(el, x, y), view: 'alphatex' }))}>
                    <AlphaTexEditor clip={clip} text={alphaTexText} onText={text => setDraft({ text, clip })} onClip={applyAlphaTex} />
                  </div>
                </HoverTips>
              )
              : (
                <pre
                  className="tab-ascii" data-testid="tab-ascii"
                  {...menuTrigger.props((el, x, y) => setMenu({ ...menuSpot(el, x, y), view: 'ascii' }))}
                >
                  {shownText}
                </pre>
              )}
          {/* Over the editor, so a press on a loop end drags it rather than placing the cursor. */}
          {view === 'tab' && showPlayback && clipWidth > 0 && <LoopHandles clip={clip} width={clipWidth} playback={playback} />}
          {view === 'tab' && editing && picked && clipWidth > 0 && (
            <WordTools
              clip={clip} width={clipWidth} hit={picked}
              onEdit={() => editPicked(picked)} onDelete={() => deletePicked(picked)}
            />
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
        {/* Playback belongs to the drawn tab: the text views show neither its toggle nor its controls (Jeremy, 2026-10-27). */}
        {view === 'tab' && (
        <HoverTips>
          <PlaybackFooter
            clip={clip} playback={playback} from={playFrom} selection={selectedColumns}
            shown={showPlayback} onShow={showPlaybackControls}
            sound={playbackSettings.sound} onSound={sound => setPlaybackSettings(s => ({ ...s, sound }))}
            volume={playbackSettings.volume} onVolume={volume => setPlaybackSettings(s => ({ ...s, volume }))}
          />
        </HoverTips>
        )}
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
      {menu && (
        <ShapeMenu
          x={menu.x} y={menu.y} label={{ tab: 'Tab', ascii: 'ASCII tab', alphatex: 'alphaTex' }[menu.view]}
          onClose={refocus => {
            if (refocus && menu.view === 'tab') editorRef.current?.focus();
            setMenu(null);
          }}
          items={menuItems(menu.view)}
        />
      )}
      <TabExportDialog
        clip={clip} open={exporting} style={exportStyle} onStyle={setExportStyle}
        onClose={() => setExporting(false)}
      />
    </div>
  );
}

/** What a word's field starts with: what is there now. */
function wordNow(clip: Clip, { kind, bar, column }: { kind: WordKind; bar: number; column: number }): string {
  const b = clip.bars[bar];
  if (kind === 'chord') return b?.columns[column]?.chord ?? '';
  if (kind === 'text') return b?.columns[column]?.text ?? '';
  if (kind === 'section') return b?.section?.text ?? '';
  if (kind === 'capo') return clip.capo ? String(clip.capo) : '';
  return tempoText(b?.tempo);
}

/** Where a word's field goes over the drawing: above the spot the word is drawn, kept inside the tab's width. */
function wordSpot(clip: Clip, width: number, { kind, bar, column }: { kind: WordKind; bar: number; column: number }): { x: number; y: number } {
  const layout = layoutClip(clip, width);
  const { rows } = layout;
  // The capo's field fits its caption and a small number box; the others are 180px wide (`.tab-word`).
  const FIELD_WIDTH = kind === 'capo' ? 150 : 180;
  // A tempo's field has two boxes, bpm and a label.
  const FIELD_HEIGHT = kind === 'tempo' ? 120 : 64;
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (!placed) continue;
    const row = { chord: rows.chords, text: rows.text, section: rows.section, tempo: rows.tempo, capo: rows.capo }[kind];
    const y = s * rows.height + (row ?? rows.staffTop - 20) - FIELD_HEIGHT;
    // The capo is written at the start of the first line, over the time signature.
    const x = kind === 'chord' || kind === 'text' ? (placed.columns[column]?.x ?? placed.x0) : kind === 'capo' ? 0 : placed.x0 + FIELD_WIDTH / 2;
    return { x: Math.min(width - FIELD_WIDTH / 2, Math.max(FIELD_WIDTH / 2, x)), y: Math.max(0, y) };
  }
  return { x: FIELD_WIDTH / 2, y: 0 };
}

/** Edit and Delete for a picked word, to its right (Jeremy, 2026-10-27), or its left at the tab's right edge. */
function WordTools({ clip, width, hit, onEdit, onDelete }: {
  clip: Clip;
  width: number;
  hit: WordHit;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const box = textBox(layoutClip(clip, width), hit, clip.capo ?? null);
  if (!box) return null;
  const TOOLS_WIDTH = 58;
  const GAP = 4;
  const right = box.x + box.width + GAP;
  const left = right + TOOLS_WIDTH <= width ? right : box.x - GAP - TOOLS_WIDTH;
  // The buttons keep the focus on the tab, so the word stays picked and its keys still work.
  const keep = (e: React.MouseEvent) => e.preventDefault();
  return (
    <span className="tab-word-tools" style={{ left, top: box.y + box.height / 2 - 13 }} data-testid="word-tools">
      <button type="button" className="tab-word-tool" aria-label="Edit" data-tip="Edit (Enter)" onMouseDown={keep} onClick={onEdit}>
        <PencilIcon />
      </button>
      <button type="button" className="tab-word-tool" aria-label="Delete" data-tip="Delete" onMouseDown={keep} onClick={onDelete}>
        <TrashIcon />
      </button>
    </span>
  );
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

/**
 * The files Import's Open file… offers, and a drop takes: text, and alphaTex's own extensions
 * (our download is `.alphatex.txt`; alphaTab's tools write `.atex` and `.alphatex`).
 */
const TAB_FILE_TYPES = '.txt,.atex,.alphatex,.tex,text/plain';
const isTabFile = (f: File) => f.type.startsWith('text/') || /\.(txt|atex|alphatex|tex)$/i.test(f.name);

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
