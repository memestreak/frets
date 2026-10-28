'use client';

import { type CSSProperties, type FocusEvent, useCallback, useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { ShapeMenu } from '@/components/chords/export/ShapeMenu';
import { menuSpot, useMenuTrigger } from '@/components/chords/export/useMenuTrigger';
import { usePersist } from '@/hooks/usePersist';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { loadJson, saveJson } from '@/lib/storage';
import { writeAscii } from './ascii';
import { barErrors, brokenTupletMessage, emptyClip, unevenMessage, MAX_CAPO, type Clip } from './clip';
import { clipReducer, initClipState, STORAGE_KEY } from './clipState';
import { clampCursor, columnAt, columnCount, copyText, deleteColumns, indexOf, insertBar, fillBar, isEmpty, noteAt, pasteAt, placeOf, runAround, selectedRange, START, type Cursor, type Selection } from './editing';
import { setBarKey, readTempo, setBarTime, setCapo, setChordName, setBeatText, setEnding, setSection, setTempo } from './barEdits';
import { removeMark, setBend, setOttava, setTuplet } from './noteEdits';
import { editorKeyDown, lineKeyDown, type LastDigit } from './editorKeys';
import { parseParts, PARTS, PARTS_KEY, type Parts } from './layout';
import { type StaffDrag, type StaffHit } from './hitTest';
import { type TextHit, type WordHit } from './layoutText';
import { RUN_MARKS, type RunMark } from './runs';
import { writtenStrings } from './notation';
import type { Notice } from './notice';
import { movedPitch, moveNotes, notesToMove, pitchAtStep, pitchOf, stringAtPitch } from './staffEntry';
import { markTool, type MarkHit } from './marks';
import { BarKeyPanel } from './BarKeyPanel';
import { BarTimePanel } from './BarTimePanel';
import { useClipActions } from './ClipActions';
import { WordField, type FieldKind } from './WordField';
import { barTimeSpot, PANEL_DROP, PANEL_LEAD, wordNow, wordSpot, WordTools } from './WordTools';
import { TabClip } from './TabClip';
import { ExamplesDialog, ImportDialog } from './TabDialogs';
import { TabPalette } from './TabPalette';
import { TabExportDialog } from './TabExportDialog';
import { parseTabExportStyle, TAB_EXPORT_KEY } from './exportTab';
import { writeAlphaTex } from './alphatex';
import { AlphaTexEditor } from './AlphaTexEditor';
import { readTab } from './readTab';
import { applyTool, isOn, noteKinds, WORD_TOOL, WORD_TOOLS, type ToolId } from './tools';
import { ScoreHead } from './ScoreHead';
import { paletteOf, parseView, shownColours, VIEW_KEY, type ColourPair, type TabView } from './viewOptions';
import { UNTITLED } from './ClipTitle';
import { VIEWS, type View } from './views';
import { PinnedPlayback } from './PinnedPlayback';
import { LoopHandles, PLAYBACK_KEY, PlaybackFooter, Playhead, parsePlaybackSettings, usePlayback } from './PlaybackFooter';
import { useClipImport } from './useClipImport';
import { useWidth } from './useWidth';

const TEXT_FIELDS = 'input, select, textarea, dialog';


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
  // The View options: what the drawn clip shows that is the reader's choice (bar numbers), saved per viewer.
  const [shown, setShown] = useState<TabView>(() => parseView(loadJson(VIEW_KEY)));
  usePersist(VIEW_KEY, shown);
  /**
   * The staff's own cursor (issue #136): the sounding pitch on the cursor's column that Enter adds or
   * takes away. Set by a press on the staff, which hands the keys to it; a press on the tab sets it to
   * null and hands them back. With the staff alone it is always there.
   */
  const [staffPitch, setStaffPitch] = useState<number | null>(null);
  const [barMenu, setBarMenu] = useState<{ x: number; y: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const menuTrigger = useMenuTrigger();
  const [importing, setImporting] = useState(false);
  const [widthRef, boxWidth] = useWidth();
  // The view switch and the copy button sit in a strip above it, so the tab takes the card's whole width.
  // At a View options size the drawing (and all over it) is zoomed, so it is laid out that much narrower or wider.
  const zoom = shown.size / 100;
  const clipWidth = boxWidth / zoom;
  // The View options' colours (Jeremy, 2026-10-28): the clip sits on a sheet of its background, and the
  // tokens the drawing and the text views use are set to its colours there. The theme's own need none.
  const colours = shownColours(shown);
  const paperStyle = colours ? paperVars(colours) : undefined;
  /**
   * The AlphaTex view's text as typed, and the clip it was typed against: kept, across changes of
   * view, until an edit elsewhere (on the Standard view, an undo, an import) changes the clip; then the
   * clip is written out again in Frets' own layout, without comments (Jeremy, 2026-10-27).
   */
  const [draft, setDraft] = useState<{ text: string; clip: Clip } | null>(null);
  const alphaTexText = draft && draft.clip === clip ? draft.text : writeAlphaTex(clip);
  // What the text views show and copy.
  const shownText = view === 'ascii' ? writeAscii(clip, { rhythm: shown.asciiRhythm }) : alphaTexText;

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
  /** Set while placing the playback line takes the keys from the tab, so the blur doesn't fill the bar again. */
  const quietBlur = useRef(false);
  /** The digit just typed, so a second one soon after on the same spot makes a two-digit fret. */
  const lastDigit = useRef<LastDigit>(null);
  // An undo can take away the columns the cursor or the selection were on.
  const cursor = clampCursor(clip, cursorAsSet);
  /**
   * The staff cursor's pitch while it has the keys: never with the tab alone. With the staff alone it is
   * always there but in a selection; after one, on the middle line until a key or press moves it.
   */
  const staffCursor = parts === 'tab' ? null : staffPitch ?? (parts === 'staff' && editing && !selectionAsSet ? pitchAtStep(clip, cursor.bar, 4) : null);
  /** What the Bend, Vibrato and Tuplet buttons show: the cursor's notes, or only the picked mark's own kind. */
  const cursorKinds = noteKinds(clip, lit || pickedTool ? cursor : null);
  const paletteKinds = lit ? cursorKinds : {
    bend: pickedTool === 'bend' || pickedTool === 'preBend' ? cursorKinds.bend : null,
    // A vibrato is over the whole column: wide if any of its notes' is.
    vibrato: pickedTool !== 'vibrato' ? null
      : columnAt(clip, cursor)?.notes.some(n => n?.vibrato === 'wide') ? 'wide' as const : 'slight' as const,
    tuplet: pickedTool === 'tuplet' ? cursorKinds.tuplet : null,
    ottava: pickedTool === 'ottava' ? cursorKinds.ottava : null,
    wah: pickedTool === 'wah' ? cursorKinds.wah : null,
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
    // The line moving lets any selection go, as every other move of it does (Jeremy, 2026-10-28).
    onStopAt: column => {
      if (!playbackSettings.stopAtPlayhead) return;
      setSelection(null);
      setPlayMark({ index: column, clip, cursor: cursorAsSet, selection: null });
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
  // "Stop playback at region end" (Jeremy, 2026-10-28): with a region selected, Play stops after its
  // last column, unless it starts past it. A loop still goes round instead.
  const playUntil = playbackSettings.stopAtRegionEnd && selectedColumns && playFrom <= selectedColumns[1] ? selectedColumns[1] : null;
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
        startRegion();
        return;
      }
    }
    let index = Math.min(gap, count);
    // Moving the playhead lets the selection go, while playing too (Jeremy, 2026-10-27); loop points stay.
    setSelection(null);
    // ...and the tab's cursor: the tab lets the keys go, as after a press beside the bars (Jeremy, 2026-10-28).
    let left = clip;
    if (editing) {
      // Leaving fills the cursor's bar (as `onEditorBlur` would), but not while playing, as an edit stops playback;
      // a line past that bar moves on by the rests added.
      const playing = playback.view.state === 'playing';
      left = playing ? clip : fillBar(clip, cursor.bar);
      const barEnd = clip.bars.slice(0, cursor.bar + 1).reduce((n, b) => n + b.columns.length, 0);
      if (gap >= barEnd) index += columnCount(left) - count;
      if (left !== clip) dispatch({ type: 'replace', clip: left });
      quietBlur.current = true;
      editorRef.current?.blur();
      quietBlur.current = false;
    }
    if (playback.seek(index)) return;
    setPlayMark({ index, clip: left, cursor: cursorAsSet, selection: null });
  };
  /** Puts the playback line at a gap, or takes it away; it holds until the clip, the cursor or the selection changes. */
  const placeLine = (index: number | null) => setPlayMark(index === null ? null : { index, clip, cursor: cursorAsSet, selection: null });
  // Off the tab, in the Notation view, the arrow keys and Esc work on the playback line (`lineKeyDown`).
  const onLineKey = useEffectEvent((e: KeyboardEvent) => {
    if (view === 'tab') lineKeyDown(e, { count, line: markAt, selection, select: setSelection, placeLine });
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onLineKey(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // While the footer shows, Space anywhere on the page plays and stops (Jeremy, 2026-10-26), but not
  // in a field or a dialog; the tab keeps the focus, so its cursor stays.
  useSpaceKey(() => playback.toggle(playFrom, playUntil), { enabled: showPlayback, keepFocusOn: '.tab-editor' });

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => editorKeyDown(e, {
    clip, cursor, selection, target, columnOnly, picked, staffPitch: staffCursor, staffShown: parts !== 'tab', lastDigit,
    commit, toPitch, setColumnOnly, startRegion, setPicked, deletePicked, editPicked, addBar, onTool, hearNote, onNotice: setNotice,
    dropLine: () => setPlayMark(null), leave: () => editorRef.current?.blur(),
  });

  /**
   * Starting a run of selected columns lets go of the note the cursor was on (Jeremy, 2026-10-28): no
   * string is picked and the staff's cursor goes, as after Esc, so nothing stays lit when the run does.
   */
  const startRegion = () => {
    setColumnOnly(true);
    setStaffPitch(null);
  };

  const onPick = (hit: Cursor, extend: boolean) => {
    lastDigit.current = null;
    setStaffPitch(null);
    setColumnOnly(false);
    const hasColumn = clip.bars[hit.bar].columns.length > 0;
    if (extend && hasColumn && columnAt(clip, cursor)) {
      const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
      commit(clip, hit, { anchor, focus: indexOf(clip, hit.bar, hit.column) });
      startRegion();
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
    setStaffPitch(note && note.fret !== null ? writtenStrings(clip.tuning)[cursor.string] + (clip.capo ?? 0) + note.fret : pitchAtStep(clip, cursor.bar, 4));
  };

  /** A press on the staff: the staff cursor there, on the head pressed or the line or space. */
  const onPickStaff = (hit: StaffHit, extend: boolean) => {
    lastDigit.current = null;
    const at = { bar: hit.bar, column: hit.column, string: hit.string ?? cursor.string };
    const note = hit.string === null ? null : noteAt(clip, at);
    const pitch = note && note.fret !== null ? writtenStrings(clip.tuning)[hit.string!] + (clip.capo ?? 0) + note.fret : pitchAtStep(clip, hit.bar, hit.step);
    if (extend && clip.bars[hit.bar].columns.length > 0 && columnAt(clip, cursor)) {
      const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
      commit(clip, at, { anchor, focus: indexOf(clip, hit.bar, hit.column) });
      startRegion();
      return;
    }
    const left = editing && hit.bar !== cursor.bar ? fillBar(clip, cursor.bar) : clip;
    toPitch(left, at, pitch);
  };

  /**
   * A drag of a note head on the staff (issue #174): the clip it started from, the selection it carries
   * (when the head pressed is in one), and the last move that worked, shown while the drag goes on.
   */
  const dragFrom = useRef<{ clip: Clip; selection: Selection | null; good: { clip: Clip; pitch: number } | null } | null>(null);

  /**
   * A note head dragged up or down: the note moves with the pointer (with ⌘ or Ctrl its whole chord,
   * in a selection every selected note), a line or space in the key at a time, with Shift a semitone.
   * Each new pitch sounds (with Hear notes on); letting go makes it one undo step, and the staff cursor
   * stays on the note, or the selection stays selected.
   */
  const onDragStaff = (drag: StaffDrag) => {
    const { hit } = drag;
    const at = { bar: hit.bar, column: hit.column, string: hit.string };
    if (!dragFrom.current) {
      const index = indexOf(clip, hit.bar, hit.column);
      const range = selection ? selectedRange(selection) : null;
      const carried = range && index >= range[0] && index <= range[1] ? selection : null;
      dragFrom.current = { clip, selection: carried, good: null };
      lastDigit.current = null;
    }
    const from = dragFrom.current;
    const note = noteAt(from.clip, at);
    if (!note || note.fret === null) return;
    const pitch = pitchOf(from.clip, hit.string, note.fret);
    const move = { steps: drag.steps, semitones: drag.semitones };
    const edit = moveNotes(from.clip, notesToMove(from.clip, at, pitch, from.selection, drag.chord), move);
    const heardBefore = from.good?.pitch ?? pitch;
    if (!edit.problem) from.good = { clip: edit.clip, pitch: movedPitch(from.clip, hit.bar, pitch, move) };
    const shown = from.good ?? { clip: from.clip, pitch };
    const string = stringAtPitch(shown.clip, at, shown.pitch) ?? hit.string;
    if (drag.done) {
      dragFrom.current = null;
      if (shown.clip !== from.clip) dispatch({ type: 'replace', clip: shown.clip, from: from.clip });
      else dispatch({ type: 'preview', clip: from.clip });
    } else dispatch({ type: 'preview', clip: shown.clip });
    setPicked(null);
    setNotice(null);
    if (from.selection) {
      setSelection(from.selection);
    } else {
      setCursor({ ...at, string });
      setSelection(null);
      setColumnOnly(false);
      setStaffPitch(shown.pitch);
    }
    if (!drag.done && shown.pitch !== heardBefore) hearNote({ ...at, string });
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
    // Placing the playback line has filled the bar already, or left it alone while playing.
    if (quietBlur.current) return;
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

  const { importText, openExample, leaveExample } = useClipImport({
    dispatch, onNotice: setNotice, showTab: () => setView('tab'),
    toStart: () => { setCursor(START); setSelection(null); },
  });

  // Paste anywhere on the page; copy and cut in the editor; undo and redo.
  useEffect(() => {
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
    document.addEventListener('paste', onPaste);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const actions = useClipActions({
    clip, view, parts, shown, onShown: setShown, exportStyle, alphaTexText, shownText, onNotice: setNotice,
  });

  const name = clip.name.trim() || UNTITLED;
  /** A new title: one undo step, as any edit. */
  const rename = (next: string) => dispatch({ type: 'replace', clip: { ...clip, name: next } });
  const empty = isEmpty(clip);
  const exampleNote = <p className="m-0 mb-3 text-(--ink-muted)" data-testid="example-note">Example: edits aren&apos;t saved</p>;
  // Bars that don't add up, and tuplets missing notes, said in a line under the tab (never a tint on it).
  const unevenLine = [unevenMessage(clip), brokenTupletMessage(clip)].filter(Boolean).join(' ');

  return (
    <div className="grid gap-4">
      {/* The title, credits and tuning are drawn as the score's head, over the drawing (ScoreHead). */}
      <header className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3">
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
            {actions.buttons}
          </div>
        </div>
        <div className={colours ? 'tab-paper' : undefined} style={paperStyle} data-testid="tab-paper">
        <div ref={widthRef} className="min-w-0">
          {/* The View options' Size zooms the drawing, its head and everything over it: presses, fields and panels alike. */}
          <div style={view === 'tab' && zoom !== 1 ? { zoom } : undefined}>
          {/* The head belongs to the drawing; the text views carry the same in their text (Jeremy, 2026-10-28). */}
          {view === 'tab'
            ? <ScoreHead clip={clip} onRename={rename} note={example && exampleNote} />
            : <>
              {/* The page keeps its heading for screen readers. */}
              <h1 className="sr-only">{name}</h1>
              {example && exampleNote}
            </>}
          <div className="relative">
            {/* Under the editor: the loop bracket. */}
            {view === 'tab' && clipWidth > 0 && <Playhead clip={clip} width={clipWidth} parts={parts} playback={playback} mark={markAt} markOnly={!showPlayback} layer="under" />}
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
                      clip={clip} width={clipWidth} parts={parts} barNumbers={shown.barNumbers} title={`${name}, drawn as ${parts === 'staff' ? 'a staff' : 'tab'}`}
                      onPick={onPick} onPickRun={onPickRun} onPickStaff={onPickStaff} onDragStaff={onDragStaff}
                      onMiss={() => { setSelection(null); setPlayMark(null); setPicked(null); (document.activeElement as HTMLElement | null)?.blur(); }} onPickText={onPickText} onPickMark={onPickMark}
                      onPickColumn={pickColumn} columnReach={COLUMN_REACH}
                      highlight={{
                        cursor: editing && !picked ? cursor : null, range: selection ? selectedRange(selection) : null, columnOnly,
                        staffPitch: staffCursor,
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
                    <AlphaTexEditor clip={clip} text={alphaTexText} onText={text => setDraft({ text, clip })} onClip={applyAlphaTex} onClear={clearAlphaTex} lineNumbers={shown.lineNumbers} />
                  </HoverTips>
                )
                : <pre className="tab-ascii" data-testid="tab-ascii">{shownText}</pre>}
            {/* Over the editor, so a press on a loop end drags it rather than placing the cursor. */}
            {/* The playhead's and the playback line's lines, over the selection's band. */}
            {view === 'tab' && clipWidth > 0 && <Playhead clip={clip} width={clipWidth} parts={parts} playback={playback} mark={markAt} markOnly={!showPlayback} layer="over" />}
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
          </div>
        </div>
        </div>
        {/* Playback belongs to the drawn tab: the text views show neither its toggle nor its controls (Jeremy, 2026-10-27). */}
        {view === 'tab' && (
        <PinnedPlayback shown={showPlayback}>
        <HoverTips>
          <PlaybackFooter
            clip={clip} playback={playback} from={playFrom} until={playUntil} selection={selectedColumns}
            shown={showPlayback} onShow={showPlaybackControls}
            sound={playbackSettings.sound} onSound={sound => setPlaybackSettings(s => ({ ...s, sound }))}
            volume={playbackSettings.volume} onVolume={volume => setPlaybackSettings(s => ({ ...s, volume }))}
            hearNotes={playbackSettings.hearNotes} onHearNotes={hearNotes => setPlaybackSettings(s => ({ ...s, hearNotes }))}
            transpose={playbackSettings.transpose} onTranspose={transpose => setPlaybackSettings(s => ({ ...s, transpose }))}
            options={playbackSettings} onOptions={options => setPlaybackSettings(s => ({ ...s, ...options }))}
          />
        </HoverTips>
        </PinnedPlayback>
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
      {actions.popups}
      <TabExportDialog
        clip={clip} parts={parts} view={shown} open={exporting} style={exportStyle} onStyle={setExportStyle}
        onClose={() => setExporting(false)}
      />
    </div>
  );
}

/** The tokens the clip is drawn and written in, set to two colours (see `paletteOf`). */
function paperVars(colours: ColourPair): CSSProperties {
  const p = paletteOf(colours);
  return {
    '--ink': p.ink, '--ink-muted': p.inkMuted, '--line-strong': p.lineStrong, '--line': p.line, '--surface-raised': p.paper,
    background: p.paper, color: p.ink,
  } as CSSProperties;
}
