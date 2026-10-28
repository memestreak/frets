'use client';

import {
  type FocusEvent, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState,
} from 'react';
import { HoverTips } from '@/components/HoverTips';
import { CheckIcon, CopyIcon, PencilIcon, SaveIcon, TrashIcon } from '@/components/icons';
import { Modal } from '@/features/practice/quiz/Modal';
import { ShapeMenu } from '@/components/chords/export/ShapeMenu';
import { copySvgAsPng, svgToPng } from '@/components/chords/export/exportImage';
import { SAVE_KINDS, saveFile, type SaveKind } from './saveFile';
import { menuSpot, useMenuTrigger } from '@/components/chords/export/useMenuTrigger';
import { usePersist } from '@/hooks/usePersist';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { loadJson, saveJson } from '@/lib/storage';
import { writeAscii } from './ascii';
import { barErrors, brokenTupletMessage, emptyClip, isRest, isStandardTuning, unevenMessage, MAX_CAPO, type Clip } from './clip';
import {
  clipReducer, initClipState, STORAGE_KEY,
} from './clipState';
import {
  clampCursor, clearNote, columnAt, columnCount, copyText, deleteColumns, indexOf, insertBar, insertColumn,
  fillBar, isEmpty, makeRest, removeMark, MAX_FRET, setBarKey, moveColumn, noteAt, pasteAt, placeOf, readTempo, removeEmptyBar, runAround, selectedRange, setBarTime, setCapo, setChordName,
  setBeatText, setBend, setEnding, setFret, setOttava, setTuplet, setSection, setTempo, tempoText, START, stepDuration, type Cursor, type Selection,
} from './editing';
import { layoutClip, parseParts, PARTS, PARTS_KEY, RUN_MARKS, textBox, type Parts, type RunMark, type StaffHit, type TextHit, type WordHit } from './layout';
import { openStrings } from './notation';
import { moveToString, pitchAtStep, stepPitch, stringAtPitch, toggleStaffNote } from './staffEntry';
import { markBox, markTool, type MarkHit } from './marks';
import { BarKeyPanel } from './BarKeyPanel';
import { BarTimePanel } from './BarTimePanel';
import { WordField, type FieldKind } from './WordField';
import { TabClip } from './TabClip';
import { TabPalette } from './TabPalette';
import { TabExportDialog } from './TabExportDialog';
import { parseTabExportStyle, TAB_EXPORT_KEY, tabSvg } from './exportTab';
import { writeAlphaTex } from './alphatex';
import { AlphaTexEditor } from './AlphaTexEditor';
import { readTab } from './readTab';
import { applyCyclingKey, applyTool, applyTupletKey, isOn, noteKinds, toolForKey, WORD_TOOL, WORD_TOOLS, type ToolId } from './tools';
import { exampleById, TAB_EXAMPLES, type TabExample } from './examples';
import { loadSamples, SAMPLE_PREFIX } from './samples';
import { ClipTitle, UNTITLED } from './ClipTitle';
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
  { id: 'tab', label: 'Notation' }, { id: 'ascii', label: 'ASCII Tab' }, { id: 'alphatex', label: 'AlphaTex' },
];

/** How long after one digit a second one joins it into a two-digit fret. */
const SECOND_DIGIT_MS = 1000;
/** How far above and below the drawn clip a press still moves the cursor or the playback line, in px: about the card's margin. */
const COLUMN_REACH = 16;

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
  // The example or sample shown in place of the clip (only its id is needed here).
  const example = state.example;
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
  /** In the Notation view: the staff, the tab or both (Jeremy, 2026-10-27). */
  const [parts, setParts] = useState<Parts>(() => parseParts(loadJson(PARTS_KEY)));
  usePersist(PARTS_KEY, parts);
  /**
   * The staff's own cursor (issue #136): the sounding pitch on the cursor's column that Enter adds or
   * takes away. Set by a press on the staff, which hands the keys to it; a press on the tab sets it to
   * null and hands them back. With the staff alone it is always there.
   */
  const [staffPitch, setStaffPitch] = useState<number | null>(null);
  const staffKeys = parts !== 'tab' && staffPitch !== null;
  const [barMenu, setBarMenu] = useState<{ x: number; y: number } | null>(null);
  /** The Standard view's save button's list of formats, open under it (its right edge at x). */
  const [saveMenu, setSaveMenu] = useState<{ x: number; y: number } | null>(null);
  /**
   * When a press outside last closed the list. A press on the save button while the list is open closes
   * it that way, before the button hears of it, and the click that follows must not open it again.
   */
  const saveMenuPressedAway = useRef(0);
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
  const [word, setWord] = useState<{ kind: FieldKind; bar: number; column: number } | null>(null);
  /**
   * The chord name, text, section, tempo or capo picked by a press, outlined with Edit and Delete beside
   * it; or a technique mark (issue #128), outlined with Delete beside it.
   */
  const [picked, setPicked] = useState<WordHit | MarkHit | null>(null);
  /** Whether the palette shows the cursor's notes: only while the tab has the keys and no word is picked. */
  const lit = editing && !picked;
  /** The palette tool that sets the picked word or mark, lit while it is picked. */
  const pickedTool = !editing || !picked ? null : picked.kind === 'mark' ? markTool(clip, picked) : picked.kind === 'ending' ? 'ending' : WORD_TOOL[picked.kind];
  /** The bar whose time signature panel is open. */
  const [timeBar, setTimeBar] = useState<number | null>(null);
  /** Where a press opened the time or key signature panel; null when the palette did. */
  const [panelAt, setPanelAt] = useState<{ x: number; y: number } | null>(null);
  /** The bar whose key signature panel is open. */
  const [keyBar, setKeyBar] = useState<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  /** The digit just typed, so a second one soon after on the same spot makes a two-digit fret. */
  const lastDigit = useRef<{ spot: string; digit: number; at: number } | null>(null);
  // An undo can take away the columns the cursor or the selection were on.
  const cursor = clampCursor(clip, cursorAsSet);
  /** What the Bend, Vibrato and Tuplet buttons show: the cursor's notes, or only the picked mark's own kind. */
  const cursorKinds = noteKinds(clip, lit || pickedTool ? cursor : null);
  const paletteKinds = lit ? cursorKinds : {
    bend: pickedTool === 'bend' || pickedTool === 'preBend' ? cursorKinds.bend : null,
    // A vibrato is over the whole column: wide if any of its notes' is.
    vibrato: pickedTool !== 'vibrato' ? null
      : columnAt(clip, cursor)?.notes.some(n => n?.vibrato === 'wide') ? 'wide' as const : 'slight' as const,
    tuplet: pickedTool === 'tuplet' ? cursorKinds.tuplet : null,
    ottava: pickedTool === 'ottava' ? cursorKinds.ottava : null,
  };
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
  const playback = usePlayback(clip, playbackSettings.sound, playbackSettings.volume, {
    loopPause: playbackSettings.loopPause ? playbackSettings.loopPauseSeconds : 0,
    transpose: playbackSettings.transpose,
    // With "Stop leaves the cursor where it stopped" (Jeremy, 2026-10-27), the playback line goes
    // where the playhead was, so the next Play goes on from there; else everything stays as before Play.
    onStopAt: column => {
      if (playbackSettings.stopAtPlayhead) setPlayMark({ index: column, clip, cursor: cursorAsSet, selection: selectionAsSet });
    },
  });
  /** A note just entered: it sounds, alone, with "Hear notes as you enter them" on and the controls showing. */
  const hearNote = (at: { bar: number; column: number; string: number }) => {
    if (playbackSettings.hearNotes && showPlayback) playback.hear(at.bar, at.column, at.string);
  };
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
  /** The AlphaTex view's ×: the text and the clip emptied, one undo step (Jeremy, 2026-10-27). */
  const clearAlphaTex = () => {
    const empty = emptyClip();
    dispatch({ type: 'replace', clip: empty });
    setDraft({ text: '', clip: empty });
  };
  const showPlaybackControls = (shown: boolean) => {
    if (!shown) playback.stop();
    setPlaybackSettings(s => ({ ...s, shown }));
  };
  const selectedColumns = selection ? selectedRange(selection) : null;
  const markAt = playMark && playMark.clip === clip && playMark.cursor === cursorAsSet && playMark.selection === selectionAsSet
    ? playMark.index : null;
  // Else Play starts at the selection, else the cursor; with no cursor on the tab, from the beginning.
  // A line past the clip's end plays its last column.
  const playFrom = markAt !== null ? Math.min(markAt, count - 1) : (selectedColumns ? selectedColumns[0] : editing ? indexOf(clip, cursor.bar, cursor.column) : 0);
  /**
   * A press above or below the staff: the playback line goes there (while playing, playback jumps
   * there), and any selection goes. With Shift, the columns from the line (else the selection's
   * anchor, else the cursor) to there are selected, with no string picked (Jeremy, 2026-10-27).
   */
  const pickColumn = (gap: number, extend: boolean) => {
    if (extend) {
      // From the line, the columns between it and the gap pressed (Jeremy, 2026-10-28: one column, not two);
      // from a selection or the cursor, that column to the gap.
      if (markAt !== null) {
        if (gap !== markAt) setSelection(gap > markAt ? { anchor: markAt, focus: gap - 1 } : { anchor: markAt - 1, focus: gap });
        return;
      }
      const anchor = selection?.anchor ?? (editing && columnAt(clip, cursor) ? indexOf(clip, cursor.bar, cursor.column) : null);
      if (anchor !== null) {
        setSelection({ anchor, focus: gap > anchor ? gap - 1 : gap });
        return;
      }
    }
    const index = Math.min(gap, count);
    // Moving the playhead lets the selection go, while playing too (Jeremy, 2026-10-27); loop points stay.
    setSelection(null);
    if (playback.seek(index)) return;
    setPlayMark({ index, clip, cursor: cursorAsSet, selection: null });
  };
  /**
   * Off the tab (no string picked), the arrow keys work on the playback line, the footer shown or
   * not (Jeremy, 2026-10-27): ← → move it a column, Shift+← → select from it (or grow the selection
   * made so), and Esc drops both. On the tab, in a field or a dialog, the keys do what they did.
   */
  const onLineKey = useEffectEvent((e: KeyboardEvent) => {
    if (view !== 'tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as Element | null;
    if (target?.closest?.('input, select, textarea, dialog, [role="menu"], [role="slider"], .tab-editor')) return;
    if (e.key === 'Escape') {
      if (markAt === null && !selection) return;
      // A selection goes first, leaving the line after its last column (Jeremy, 2026-10-28); then the line goes.
      if (selection) {
        setSelection(null);
        setPlayMark({ index: selectedRange(selection)[1] + 1, clip, cursor: cursorAsSet, selection: null });
      } else setPlayMark(null);
      e.preventDefault();
      return;
    }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const within = (i: number) => Math.min(count, Math.max(0, i));
    if (e.shiftKey && markAt !== null && !selection) {
      // The first step from the line takes the one column beside it.
      const one = step > 0 ? markAt : markAt - 1;
      if (one >= 0 && one < count) setSelection({ anchor: one, focus: one });
      e.preventDefault();
      return;
    }
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

  const openWord = (kind: FieldKind, at: Cursor = cursor) => {
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
    else if (id === 'barTime') { setPanelAt(null); setTimeBar(cursor.bar); }
    else if (id === 'barKey') { setPanelAt(null); setKeyBar(cursor.bar); }
    else if (id === 'insertBar') addBar('after');
    else if (id === 'insertBarBefore') addBar('before');
    // A dead note goes on one string; with none picked there is nothing to mark.
    else if (!(columnOnly && id === 'dead')) {
      commitKeepingMark(applyTool(clip, target, id));
    }
  };

  /** A palette change; a picked mark changed by it (vibrato to wide, a bend's amount) stays picked while it is there. */
  const commitKeepingMark = (next: Clip) => {
    commit(next);
    if (picked?.kind === 'mark' && markTool(next, picked)) setPicked(picked);
  };

  const closeTimeBar = useCallback((byKey: boolean) => {
    setTimeBar(null);
    if (byKey) editorRef.current?.focus();
  }, []);
  const closeKeyBar = useCallback((byKey: boolean) => {
    setKeyBar(null);
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
    // An ending of 0, or none, takes the bracket away.
    if (w.kind === 'ending') commit(setEnding(clip, w.bar, Number(value) || null));
    if (w.kind === 'capo') commit(setCapo(clip, value === '' || Number(value) === 0 ? null : Math.min(MAX_CAPO, Number(value))));
  };

  /** Where a word over the tab belongs: its column, or its bar's first. */
  const wordPlace = (hit: TextHit): Cursor => ({ ...cursor, ...('index' in hit ? placeOf(clip, hit.index) : { bar: hit.bar, column: 0 }) });

  /**
   * A press on a drawn chord name, text, section, tempo or capo picks it, with the cursor on its column or
   * bar: outlined, with Edit and Delete to its right, and Enter or Delete do the same (Jeremy, 2026-10-27;
   * a press had opened its field at once). One on a time signature opens its bar's panel.
   */
  const onPickText = (hit: TextHit, press: { x: number; y: number }) => {
    const at = wordPlace(hit);
    commit(clip, at, null);
    // A time or key signature opens its bar's panel, just under the press (Jeremy, 2026-10-27).
    if (hit.kind === 'time' || hit.kind === 'key') {
      setPanelAt({ x: press.x - PANEL_LEAD, y: press.y + PANEL_DROP });
      (hit.kind === 'time' ? setTimeBar : setKeyBar)(hit.bar);
      return;
    }
    setPicked(hit);
    editorRef.current?.focus();
  };

  /**
   * A press on a technique mark picks it (Jeremy, 2026-10-27, issue #128): outlined, with Delete beside
   * it, its palette tool lit, and the cursor on its note; a mark over the whole column puts the cursor
   * on the column with no string, and a tuplet's number selects its group. A join (hammer-on, slide,
   * tie) belongs to the note it arrives at.
   */
  const onPickMark = (hit: MarkHit) => {
    const { bar, column } = placeOf(clip, hit.index);
    const at = { bar, column, string: hit.string ?? cursor.string };
    lastDigit.current = null;
    const left = editing && bar !== cursor.bar ? fillBar(clip, cursor.bar) : clip;
    commit(left, at, hit.to !== undefined && hit.to !== hit.index ? { anchor: hit.index, focus: hit.to } : null);
    setColumnOnly(hit.string === null);
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
  /**
   * Takes a picked word or mark away. Nothing is left selected and no cursor shows (Jeremy, 2026-10-27):
   * the tab lets the keys go, as after a press on blank space.
   */
  const deletePicked = (hit: WordHit | MarkHit) => {
    if (hit.kind === 'mark') commit(removeMark(clip, hit), cursor, null);
    else {
      const at = wordPlace(hit);
      if (hit.kind === 'chord') commit(setChordName(clip, at, ''), at, null);
      if (hit.kind === 'text') commit(setBeatText(clip, at, ''), at, null);
      if (hit.kind === 'section') commit(setSection(clip, at.bar, ''), at, null);
      if (hit.kind === 'tempo') commit(setTempo(clip, at.bar, null), at, null);
      if (hit.kind === 'capo') commit(setCapo(clip, null), at, null);
      if (hit.kind === 'ending') commit(setEnding(clip, at.bar, null), at, null);
    }
    setColumnOnly(false);
    // After the clip above is drawn: the blur fills the cursor's bar, and must start from the clip without the mark.
    window.setTimeout(() => editorRef.current?.blur(), 0);
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
    // A picked mark: Delete takes it away (the note stays), Esc lets it go; any other key lets it go and does what it does.
    if (picked?.kind === 'mark') {
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        deletePicked(picked);
        return;
      }
      setPicked(null);
      if (key === 'Escape') {
        e.preventDefault();
        return;
      }
    }
    // A picked word: Delete takes it away, Enter edits it, Esc lets it go; any other key lets it go and does what it does.
    if (picked && picked.kind !== 'mark') {
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
    if (staffKeys && onStaffKey(e)) {
      handled();
      return;
    }
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
      hearNote(cursor);
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
      // A selection goes first, leaving the cursor on its last column (Jeremy, 2026-10-28).
      if (selection) {
        const end = placeOf(clip, selectedRange(selection)[1]);
        commit(clip, { ...cursor, bar: end.bar, column: end.column }, null);
        setPlayMark(null);
        return;
      }
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
    setStaffPitch(null);
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

  /** The cursor on the column at a pitch: its string boxed when a note there has it, else the column alone. */
  const toPitch = (next: Clip, at: Cursor, pitch: number, nextSelection: Selection | null = null) => {
    const string = stringAtPitch(next, at, pitch);
    commit(next, { ...at, string: string ?? at.string }, nextSelection);
    setColumnOnly(string === null);
    setStaffPitch(pitch);
  };

  /** The focus coming to the clip; with the staff alone, its cursor is the only one, so it shows at once. */
  const onEditorFocus = () => {
    setEditing(true);
    if (parts !== 'staff' || staffPitch !== null) return;
    const note = noteAt(clip, cursor);
    setStaffPitch(note && note.fret !== null ? openStrings(clip.tuning)[cursor.string] + (clip.capo ?? 0) + note.fret : pitchAtStep(clip, cursor.bar, 4));
  };

  /** A press on the staff: the staff cursor there, on the head pressed or the line or space. */
  const onPickStaff = (hit: StaffHit, extend: boolean) => {
    lastDigit.current = null;
    const at = { bar: hit.bar, column: hit.column, string: hit.string ?? cursor.string };
    const note = hit.string === null ? null : noteAt(clip, at);
    const pitch = note && note.fret !== null ? openStrings(clip.tuning)[hit.string!] + (clip.capo ?? 0) + note.fret : pitchAtStep(clip, hit.bar, hit.step);
    if (extend && clip.bars[hit.bar].columns.length > 0 && columnAt(clip, cursor)) {
      const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
      toPitch(clip, at, pitch, { anchor, focus: indexOf(clip, hit.bar, hit.column) });
      return;
    }
    const left = editing && hit.bar !== cursor.bar ? fillBar(clip, cursor.bar) : clip;
    toPitch(left, at, pitch);
  };

  /**
   * The keys the staff cursor takes (issue #136): ↑ ↓ a line or space in the key, # and b a semitone,
   * Enter adds or takes away the note at its pitch, Alt+↑ ↓ move that note to another string. True
   * when the key was one of them.
   */
  const onStaffKey = (e: ReactKeyboardEvent<HTMLDivElement>): boolean => {
    const pitch = staffPitch!;
    const { key } = e;
    if ((key === 'ArrowUp' || key === 'ArrowDown') && !e.shiftKey) {
      if (e.altKey) {
        const moved = moveToString(clip, cursor, pitch, key === 'ArrowUp' ? -1 : 1);
        toPitch(moved.clip, cursor, pitch, selection);
      } else {
        toPitch(clip, cursor, stepPitch(clip, cursor.bar, pitch, key === 'ArrowUp' ? 1 : -1), selection);
      }
      return true;
    }
    if ((key === '#' || key === 'b') && !e.altKey) {
      toPitch(clip, cursor, pitch + (key === '#' ? 1 : -1), selection);
      return true;
    }
    if (key === 'Enter' && !e.altKey && !e.shiftKey) {
      const edit = toggleStaffNote(clip, cursor, pitch);
      toPitch(edit.clip, cursor, pitch, selection);
      if (edit.string !== null) hearNote({ ...cursor, string: edit.string });
      if (edit.problem) setNotice({ tone: 'error', lines: [edit.problem] });
      return true;
    }
    return false;
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
    // A sample is fetched afresh, so one dropped into the folder a moment ago opens.
    const chosen = id.startsWith(SAMPLE_PREFIX) ? (await loadSamples()).find(s => s.id === id) : exampleById(id);
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
      const line = await copySvgAsPng(tabSvg(clip, exportStyle, clip.name, parts));
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
  const asText = (text: string) => new Blob([text], { type: 'text/plain' });
  /** The picture as the Export dialog makes it, with its saved choices. */
  const picture = () => tabSvg(clip, exportStyle, clip.name, parts);
  const saveFormats = [
    { label: 'PNG image…', onSelect: () => save(SAVE_KINDS.png, () => svgToPng(picture())) },
    { label: 'SVG image…', onSelect: () => save(SAVE_KINDS.svg, () => new Blob([picture()], { type: 'image/svg+xml' })) },
    { label: 'ASCII tab…', onSelect: () => save(SAVE_KINDS.ascii, () => asText(writeAscii(clip))) },
    { label: 'alphaTex…', onSelect: () => save(SAVE_KINDS.alphatex, () => asText(writeAlphaTex(clip))) },
  ];
  /**
   * The save button at the clip's top right (Jeremy, 2026-10-27): in Standard it lists the
   * formats; the ASCII Tab view saves its text, and the AlphaTex view its text as typed.
   */
  const saveLabel = { tab: 'Save as…', ascii: 'Save as text file', alphatex: 'Save as alphaTex file' }[view];
  const saveButton = (
    <button
      type="button" className="btn btn-secondary btn-icon" aria-label={saveLabel} title={saveLabel}
      aria-haspopup={view === 'tab' ? 'menu' : undefined} aria-expanded={view === 'tab' ? saveMenu !== null : undefined}
      // Pressed, it leaves the focus (and the cursor) on the tab.
      onMouseDown={e => e.preventDefault()}
      onClick={e => {
        if (view === 'ascii') return save(SAVE_KINDS.ascii, () => asText(writeAscii(clip)));
        if (view === 'alphatex') return save(SAVE_KINDS.alphatex, () => asText(alphaTexText));
        const r = e.currentTarget.getBoundingClientRect();
        if (Date.now() - saveMenuPressedAway.current < 500) return;
        setSaveMenu({ x: r.right, y: r.bottom + 4 });
      }}
    >
      <SaveIcon />
    </button>
  );

  const name = clip.name.trim() || UNTITLED;
  /** A new title: one undo step, as any edit. */
  const rename = (next: string) => dispatch({ type: 'replace', clip: { ...clip, name: next } });
  const empty = isEmpty(clip);
  // Bars that don't add up, and tuplets missing notes, said in a line under the tab (never a tint on it).
  const unevenLine = [unevenMessage(clip), brokenTupletMessage(clip)].filter(Boolean).join(' ');

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="grid gap-1">
          <ClipTitle name={clip.name} onRename={rename} />
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
          isOn={id => (pickedTool ? id === pickedTool : lit && isOn(clip, cursor, id, columnOnly))} kinds={paletteKinds}
          onTool={onTool} onBend={quarters => commitKeepingMark(setBend(clip, target, quarters))}
          onTuplet={n => commitKeepingMark(setTuplet(clip, target, n))}
          onOttava={o => commitKeepingMark(setOttava(clip, target, o))} disabled={view !== 'tab'} />
      </HoverTips>

      <section className="card tab-card" aria-label="Clip">
        {/* Over the clip: Staff | Tab | Both at the top left (Notation only); the view switch, then copy and save, at the top right (Jeremy, 2026-10-27). */}
        <div className="tab-card-bar">
          {view === 'tab' && (
            <div className="seg tab-parts" role="group" aria-label="Show">
              {PARTS.map(p => (
                <button key={p} type="button" className="seg-opt" aria-pressed={parts === p} onClick={() => setParts(p)}>
                  {{ staff: 'Staff', tab: 'Tab', both: 'Both' }[p]}
                </button>
              ))}
            </div>
          )}
          <div className="tab-card-end">
            <div className="seg" role="group" aria-label="View">
              {VIEWS.map(v => (
                <button key={v.id} type="button" className="seg-opt" aria-pressed={view === v.id} onClick={() => chooseView(v.id)}>
                  {v.label}
                </button>
              ))}
            </div>
            {copyButton}
            {saveButton}
          </div>
        </div>
        <div ref={widthRef} className="relative min-w-0">
          {/* Under the editor, so the playhead's band tints the paper, not the numbers. */}
          {view === 'tab' && clipWidth > 0 && <Playhead clip={clip} width={clipWidth} parts={parts} playback={playback} mark={markAt} markOnly={!showPlayback} />}
          {view === 'tab'
            ? clipWidth > 0 && (
              <div
                // A textbox, so screen readers pass the keys through to it as they do to a text field.
                ref={editorRef} className="tab-editor export-trigger" tabIndex={0} role="textbox" aria-multiline="true"
                aria-label="Tab editor: type frets, arrows move, Shift+arrows select; on the staff, Enter adds or removes a note; Shift+F10 to insert a bar"
                onKeyDown={onKeyDown} onFocus={onEditorFocus} onBlur={onEditorBlur}
                // Right-click, a long press or Shift+F10: insert a bar before or after.
                {...menuTrigger.props((el, x, y) => setBarMenu(menuSpot(el, x, y)))}
              >
                {/* A bar's warning explains itself on hover. */}
                <HoverTips>
                  <TabClip
                    clip={clip} width={clipWidth} parts={parts} title={`${name}, drawn as ${parts === 'staff' ? 'a staff' : 'tab'}`}
                    onPick={onPick} onPickRun={onPickRun} onPickStaff={onPickStaff}
                    onMiss={() => { setSelection(null); setPlayMark(null); setPicked(null); (document.activeElement as HTMLElement | null)?.blur(); }} onPickText={onPickText} onPickMark={onPickMark}
                    onPickColumn={pickColumn} columnReach={COLUMN_REACH}
                    highlight={{
                      cursor: editing && !picked ? cursor : null, range: selection ? selectedRange(selection) : null, columnOnly,
                      staffPitch: staffKeys ? staffPitch : null,
                    }}
                    picked={editing ? picked : null}
                    errors={barErrors(clip)}
                  />
                </HoverTips>
              </div>
            )
            : view === 'alphatex'
              ? (
                <HoverTips>
                  <AlphaTexEditor clip={clip} text={alphaTexText} onText={text => setDraft({ text, clip })} onClip={applyAlphaTex} onClear={clearAlphaTex} />
                </HoverTips>
              )
              : <pre className="tab-ascii" data-testid="tab-ascii">{shownText}</pre>}
          {/* Over the editor, so a press on a loop end drags it rather than placing the cursor. */}
          {view === 'tab' && showPlayback && clipWidth > 0 && <LoopHandles clip={clip} width={clipWidth} parts={parts} playback={playback} />}
          {view === 'tab' && editing && picked && clipWidth > 0 && (
            <WordTools
              clip={clip} width={clipWidth} parts={parts} hit={picked}
              onEdit={picked.kind === 'mark' ? null : () => editPicked(picked)}
              onDelete={() => deletePicked(picked)}
            />
          )}
          {view === 'tab' && word && clipWidth > 0 && (
            <WordField
              key={`${word.kind}-${word.bar}-${word.column}`} kind={word.kind} {...wordSpot(clip, clipWidth, parts, word)}
              initial={wordNow(clip, word)} onDone={finishWord}
            />
          )}
          {view === 'tab' && keyBar !== null && keyBar < clip.bars.length && clipWidth > 0 && (
            <BarKeyPanel
              clip={clip} bar={keyBar} {...(panelAt ?? barTimeSpot(clip, clipWidth, parts, keyBar))}
              onChange={key => commit(setBarKey(clip, keyBar, key))} onClose={closeKeyBar}
            />
          )}
          {view === 'tab' && timeBar !== null && timeBar < clip.bars.length && clipWidth > 0 && (
            <BarTimePanel
              clip={clip} bar={timeBar} {...(panelAt ?? barTimeSpot(clip, clipWidth, parts, timeBar))}
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
            hearNotes={playbackSettings.hearNotes} onHearNotes={hearNotes => setPlaybackSettings(s => ({ ...s, hearNotes }))}
            transpose={playbackSettings.transpose} onTranspose={transpose => setPlaybackSettings(s => ({ ...s, transpose }))}
            options={playbackSettings} onOptions={options => setPlaybackSettings(s => ({ ...s, ...options }))}
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
      {barMenu && (
        <ShapeMenu
          x={barMenu.x} y={barMenu.y} label="Tab"
          onClose={refocus => {
            if (refocus) editorRef.current?.focus();
            setBarMenu(null);
          }}
          items={[
            // The bar under a right-click already has the cursor: the press put it there.
            { label: 'Insert bar before', onSelect: () => addBar('before') },
            { label: 'Insert bar after', onSelect: () => addBar('after') },
          ]}
        />
      )}
      {saveMenu && (
        <ShapeMenu
          x={saveMenu.x} y={saveMenu.y} align="end" label="Save as"
          onClose={refocus => {
            if (!refocus) saveMenuPressedAway.current = Date.now();
            setSaveMenu(null);
          }}
          items={saveFormats}
        />
      )}
      <TabExportDialog
        clip={clip} parts={parts} open={exporting} style={exportStyle} onStyle={setExportStyle}
        onClose={() => setExporting(false)}
      />
    </div>
  );
}

/** What a word's field starts with: what is there now. */
function wordNow(clip: Clip, { kind, bar, column }: { kind: FieldKind; bar: number; column: number }): string {
  const b = clip.bars[bar];
  if (kind === 'ending') return b?.ending ? String(b.ending) : '';
  if (kind === 'chord') return b?.columns[column]?.chord ?? '';
  if (kind === 'text') return b?.columns[column]?.text ?? '';
  if (kind === 'section') return b?.section?.text ?? '';
  if (kind === 'capo') return clip.capo ? String(clip.capo) : '';
  return tempoText(b?.tempo);
}

/** Where a word's field goes over the drawing: above the spot the word is drawn, kept inside the tab's width. */
function wordSpot(clip: Clip, width: number, parts: Parts, { kind, bar, column }: { kind: FieldKind; bar: number; column: number }): { x: number; y: number } {
  const layout = layoutClip(clip, width, parts);
  const { rows } = layout;
  // The capo's field fits its caption and a small number box; the others are 180px wide (`.tab-word`).
  const FIELD_WIDTH = kind === 'capo' || kind === 'ending' ? 150 : 180;
  // A tempo's field has two boxes, bpm and a label.
  const FIELD_HEIGHT = kind === 'tempo' ? 120 : 64;
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (!placed) continue;
    const row = { chord: rows.chords, text: rows.text, section: rows.section, tempo: rows.tempo, capo: rows.capo, ending: rows.endings }[kind];
    const y = s * rows.height + (row ?? rows.staffTop - 20) - FIELD_HEIGHT;
    // The capo is written at the start of the first line, over the time signature.
    const x = kind === 'chord' || kind === 'text' ? (placed.columns[column]?.x ?? placed.x0) : kind === 'capo' ? 0 : placed.x0 + FIELD_WIDTH / 2;
    return { x: Math.min(width - FIELD_WIDTH / 2, Math.max(FIELD_WIDTH / 2, x)), y: Math.max(0, y) };
  }
  return { x: FIELD_WIDTH / 2, y: 0 };
}

/**
 * Edit and Delete for a picked word, to its right (Jeremy, 2026-10-27), or its left at the tab's right
 * edge; Delete alone for a picked mark, whose palette tool does the editing.
 */
function WordTools({ clip, width, parts, hit, onEdit, onDelete }: {
  clip: Clip;
  width: number;
  parts: Parts;
  hit: WordHit | MarkHit;
  onEdit: (() => void) | null;
  onDelete: () => void;
}) {
  const layout = layoutClip(clip, width, parts);
  const box = hit.kind === 'mark' ? markBox(layout, hit) : textBox(layout, hit, clip.capo ?? null);
  if (!box) return null;
  const TOOLS_WIDTH = onEdit ? 58 : 30;
  const GAP = 4;
  const right = box.x + box.width + GAP;
  const left = right + TOOLS_WIDTH <= width ? right : box.x - GAP - TOOLS_WIDTH;
  // The buttons keep the focus on the tab, so the word stays picked and its keys still work.
  const keep = (e: React.MouseEvent) => e.preventDefault();
  return (
    <span className="tab-word-tools" style={{ left, top: box.y + box.height / 2 - 13 }} data-testid="word-tools">
      {onEdit && (
        <button type="button" className="tab-word-tool" aria-label="Edit" data-tip="Edit (Enter)" onMouseDown={keep} onClick={onEdit}>
          <PencilIcon />
        </button>
      )}
      <button type="button" className="tab-word-tool" aria-label="Delete" data-tip="Delete" onMouseDown={keep} onClick={onDelete}>
        <TrashIcon />
      </button>
    </span>
  );
}

/** How far left of a press its signature panel starts, and how far under it. */
const PANEL_LEAD = 16;
const PANEL_DROP = 14;

/**
 * Where a bar's time or key signature panel goes when the palette opens it: from the bar's start,
 * under the staff its signatures are drawn on (the notation staff when it is shown). The panel keeps
 * itself inside the tab's width.
 */
function barTimeSpot(clip: Clip, width: number, parts: Parts, bar: number): { x: number; y: number } {
  const layout = layoutClip(clip, width, parts);
  const bottom = layout.rows.score ? layout.rows.score.bottom : layout.rows.staffBottom;
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (placed) return { x: placed.x0, y: s * layout.rows.height + bottom + 12 };
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

function ExampleList({ examples, current, onOpen }: { examples: TabExample[]; current: string | null; onOpen: (id: string) => void }) {
  return (
    <ul className="tab-examples m-0 p-0">
      {examples.map(e => (
        <li key={e.id}>
          <button type="button" className="tab-example" aria-current={e.id === current || undefined} onClick={() => onOpen(e.id)}>
            <span className="tab-example-title">{e.title}</span>
            <span className="tab-example-shows">{e.shows}</span>
          </button>
        </li>
      ))}
    </ul>
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
  // The samples in the folder now, read each time the dialog opens.
  const [samples, setSamples] = useState<TabExample[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void loadSamples().then(found => { if (live) setSamples(found); });
    return () => { live = false; };
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Examples" className="tab-examples-dialog">
      <div className="settings-dialog-body grid gap-3">
        <p className="m-0 text-(--ink-muted)">Each shows what Frets draws. Edit one freely: it is never saved, and your own clip waits.</p>
        {/* The files dropped into src/features/tab/samples/, for trying things out: first, as they change most. */}
        {samples.length > 0 && (
          <>
            <h3 className="tab-examples-heading m-0">Samples</h3>
            <ExampleList examples={samples} current={current} onOpen={onOpen} />
            <h3 className="tab-examples-heading m-0">Examples</h3>
          </>
        )}
        <ExampleList examples={TAB_EXAMPLES} current={current} onOpen={onOpen} />
      </div>
    </Modal>
  );
}
