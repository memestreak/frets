'use client';

import { type CSSProperties, type FocusEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { ShapeMenu } from '@/components/chords/export/ShapeMenu';
import { menuSpot, useMenuTrigger } from '@/components/chords/export/useMenuTrigger';
import { usePreferenceSaveProblem } from '@/hooks/usePersist';
import { GearIcon } from '@/components/icons';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useGeneralGroup } from '@/components/settings/general';
import { KEEPS_SELECTION, useDeselect } from '@/hooks/useDeselect';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { writeAscii } from './ascii';
import { barErrors, brokenTupletMessage, emptyClip, partOf, titled, trackName, withPart, unevenMessage, UNTITLED, type Clip, type Part } from './clip';
import { clipAction, type ClipAction, type PartAction } from './clipState';
import { useArrangements } from './useArrangements';
import { clampCursor, columnAt, columnCount, copyText, indexOf, insertBar, insertPaste, isEmpty, noteAt, pasteOver, placeOf, selectedRange, START, type Cursor, type Selection } from './editing';
import { isBarLine, type BarLineHit } from './barLines';
import { clearToRests, setBend, setOttava, setTuplet, setWhammy } from './noteEdits';
import { WHAMMY_SHAPES } from './whammy';
import { editorKeyDown, lineKeyDown } from './editorKeys';
import { layoutClip, PARTS, type Parts } from './layout';
import type { Lines } from './jumps';
import { textBox, type TextHit, type WordHit } from './layoutText';
import { writtenStrings } from './notation';
import type { Notice } from './notice';
import { pitchAtStep } from './staffEntry';
import { markBox, markTool } from './marks';
import { useClipActions } from './ClipActions';
import { SizeField } from './ViewOptions';
import { TabClip } from './TabClip';
import { ImportDialog } from './TabDialogs';
import { TabPalette } from './TabPalette';
import { TabRail } from './TabRail';
import { TabExportDialog } from './TabExportDialog';
import { writeAlphaTex } from './alphatex';
import { DEFAULT_FX } from './effects';
import { instrumentTag, soundFor, substituteNote } from './instrument';
import { AlphaTexEditor } from './AlphaTexEditor';
import { readTab } from './readTab';
import { applyTool, isOn, noteKinds, toolValue, WORD_TOOL, WORD_TOOLS, type ToolId } from './tools';
import { cycleLengthDots, lengthIsOn, lengthOf, startLength } from './inputLength';
import { FoldedTitle, ScoreHead } from './ScoreHead';
import { laidOut, paletteOf, sectionsOf, shownColours, viewOf, type ColourPair, type TabView } from './viewOptions';
import { TAB_SETTINGS_START, tabSettingsGroup, useTabPrefs } from './tabSettings';
import { VIEWS, type View } from './views';
import { PinnedPlayback } from './PinnedPlayback';
import { LoopHandles, PlaybackFooter, Playhead, usePlayback, type PlaybackSettings } from './PlaybackFooter';
import { useArrangementFile } from './useArrangementFile';
import { useEditorState, type Picked } from './useEditorState';
import { useHeadPanels } from './useHeadPanels';
import { useStableHandlers } from './useStableHandlers';
import { useTabPicking } from './useTabPicking';
import { useWidth } from './useWidth';
import { TAB_SHORTCUTS } from './shortcuts';
import { showShortcuts, useShortcuts } from '@/components/shortcuts/useShortcuts';
import { isMac } from '@/lib/shortcuts';

const TEXT_FIELDS = 'input, select, textarea, dialog';
/** What a press may land on and keep the selection and the playback line: controls, the drawing and the palette. */
const TAB_KEEPS = `${KEEPS_SELECTION}, .tab-editor svg, .tab-palette, .tab-rail, .tab-rail-panel`;
/** The modifier the file shortcuts take, as the tips name it: ⌘ on a Mac, Ctrl elsewhere. */
const MOD = isMac() ? '⌘' : 'Ctrl+';


/** How far above and below the drawn clip a press still moves the cursor or the playback line, in px: about the card's margin. */
const COLUMN_REACH = 16;

/**
 * Whether a picked thing has an Edit (in its menu, and on a double-click, issue #289): a word, the capo, an
 * ending, or a repeat's end or count. Marks, a repeat's start and a double bar have only Delete; a time or
 * key signature opens its panel on a press.
 */
function hasEdit(hit: { kind: string }): hit is WordHit {
  return !['mark', 'repeatStart', 'doubleBar', 'time', 'key'].includes(hit.kind);
}
/** The palette tool that sets each picked-able bar line, lit while it is picked. */
const BAR_LINE_TOOL: Record<BarLineHit['kind'], ToolId> = { repeatStart: 'repeatStart', repeatEnd: 'repeatEnd', repeatCount: 'repeatEnd', doubleBar: 'doubleBar' };

/**
 * The Tab page: one clip, an arrangement saved with Save or Save As… into My arrangements and opened
 * from Arrangements… (issue #259); New, a built-in arrangement, Import, a drop or a `#tab=` link open
 * as a new one, not saved until Save, and a paste or Insert goes in at the cursor. Edited
 * on the tab with the keys and the symbol palette, and shown drawn, as
 * alphaTex or as ASCII. See `docs/specs/2026-10-24-tab-editor-design.md` and
 * `docs/specs/2026-10-25-tab-editing-design.md`; the formats are
 * `public/tab-alphatex.txt` and `public/tab-ascii.txt`.
 *
 * The page wires its parts together: the editor's state (`useEditorState`), presses and drags on the
 * tab (`useTabPicking`), the fields and panels over it (`useHeadPanels`) and the file actions
 * (`useArrangementFile`).
 */
export default function TabPage() {
  // The open arrangement, saved on Save, and the others saved (My arrangements).
  const arrangements = useArrangements();
  const { state, dispatch: dispatchClip } = arrangements;
  // The whole clip, every track: saved, linked, written as alphaTex and edited in the AlphaTex view.
  const whole = state.clip;
  /**
   * The track the page shows, edits and plays (issue #243), picked from the list over the clip: the
   * viewer's, not saved, and back to the first when another arrangement opens. An edit in
   * the AlphaTex view that takes tracks away leaves the last one shown. Its FX are the ones playback goes through.
   */
  const opened = state.id;
  const [trackPick, setTrackPick] = useState({ opened, track: 0 });
  const track = trackPick.opened === opened ? Math.min(trackPick.track, whole.tracks.length - 1) : 0;
  // Its edits go back into the whole clip through `dispatch`.
  const clip = useMemo(() => partOf(whole, track), [whole, track]);
  const dispatch = (action: ClipAction | PartAction) => dispatchClip(clipAction(whole, action, track));
  /** The whole clip with an edit of the shown track in it; the same clip for no edit. */
  const wholeWith = (part: Part): Clip => (part === clip ? whole : withPart(whole, part, track));
  const [view, setView] = useState<View>('tab');
  const [notice, setNotice] = useState<Notice | null>(null);
  // The viewer's preferences, a Settings section each (issue #195); the page's controls and Settings change the same ones.
  const prefs = useTabPrefs();
  const { exportStyle, setExportStyle, notation, setNotation } = prefs;
  /** In the Notation view: the staff, the tab or both (Jeremy, 2026-10-27). */
  const parts = notation.show;
  const setParts = (show: Parts) => setNotation(n => ({ ...n, show }));
  // Settings' "Fill short bars with rests" (off by default): the cursor leaving a short bar completes it.
  const fillBars = prefs.editing.fillBars;
  // The View options: what the drawn clip shows that is the reader's choice (bar numbers), from four sections.
  const shown: TabView = viewOf(notation, prefs.colours, prefs.ascii, prefs.alphatex);
  const setShown = (next: TabView) => {
    const sections = sectionsOf(next, parts);
    setNotation(sections.notation);
    prefs.setColours(sections.colours);
    prefs.setAscii(sections.ascii);
    prefs.setAlphaTex(sections.alphatex);
  };
  // Settings, from the gear: open or shut, and the ⚠ after the gear while preferences can't be saved.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const saveProblem = usePreferenceSaveProblem();
  /** The menu a right-click, a long press or Shift+F10 opens: the picked word's or mark's, or with nothing picked the bar's. */
  const [menu, setMenu] = useState<{ x: number; y: number; hit: Picked | null } | null>(null);
  const [exporting, setExporting] = useState(false);
  const menuTrigger = useMenuTrigger();
  const [importing, setImporting] = useState(false);
  const [widthRef, boxWidth] = useWidth();
  // The view switch and the copy button sit in a strip above it, so the tab takes the card's whole width.
  // At a Size other than 100% the drawing (and all over it) is zoomed, so it is laid out that much narrower or wider.
  const zoom = shown.size / 100;
  const clipWidth = boxWidth / zoom;
  // The View options' colours (Jeremy, 2026-10-28): the clip sits on a sheet of its background, and the
  // tokens the drawing and the text views use are set to its colours there. The theme's own need none.
  const colours = shownColours(shown);
  // The clip as drawn: its own line breaks only when the view keeps them; edits still go to `clip`.
  const lineBreaks = notation.lineBreaks;
  const drawn = useMemo(() => laidOut(clip, { lineBreaks }), [clip, lineBreaks]);
  /**
   * The drawn clip laid out, once for everything that needs it: the drawing, the playhead, the loop
   * handles, the fields and panels over it and the keys (issue #302). Playback steps and edits that
   * leave the clip as it was don't lay it out again.
   */
  const layout = useMemo(() => layoutClip(drawn, clipWidth, parts), [drawn, clipWidth, parts]);
  const paperStyle = colours ? paperVars(colours) : undefined;
  /**
   * The AlphaTex view's text as typed, and the clip it was typed against: kept, across changes of
   * view, until an edit elsewhere (on the Standard view, an undo, an import) changes the clip; then the
   * clip is written out again in Frets' own layout, without comments (Jeremy, 2026-10-27).
   */
  const [draft, setDraft] = useState<{ text: string; clip: Clip } | null>(null);
  const alphaTexText = draft && draft.clip === whole ? draft.text : writeAlphaTex(whole);
  // What the text views show and copy.
  const shownText = view === 'ascii' ? writeAscii(clip, { rhythm: shown.asciiRhythm }) : alphaTexText;

  /* — the editor: a cursor on a column and string, and a run of selected columns — */
  const editor = useEditorState({ clip, dispatch, setNotice, fillBars });
  const {
    cursor, cursorAsSet, setCursor, selection, selectionAsSet, setSelection, editing, setEditing, columnOnly, setColumnOnly,
    staffPitch, setStaffPitch, picked, setPicked, inputMode, setInputMode, inputLength, setInputLength,
    editorRef, lastDigitRef, commit, leaveBar, startRegion, toPitch,
  } = editor;
  /** Whether the palette shows the cursor's notes: only while the tab has the keys and no word is picked. */
  const lit = editing && !picked;
  /** The palette tool that sets the picked word or mark, lit while it is picked. */
  const pickedTool = !editing || !picked ? null : picked.kind === 'mark' ? markTool(clip, picked) : isBarLine(picked) ? BAR_LINE_TOOL[picked.kind] : picked.kind === 'ending' ? 'ending' : WORD_TOOL[picked.kind];
  /** Set while placing the playback line takes the keys from the tab, so the blur doesn't fill the bar again. */
  const quietBlur = useRef(false);
  /**
   * The staff cursor's pitch while it has the keys: never with the tab alone. With the staff alone it is
   * always there but in a selection; after one, on the middle line until a key or press moves it.
   */
  const staffCursor = parts === 'tab' ? null : staffPitch ?? (parts === 'staff' && editing && inputMode && !selectionAsSet ? pitchAtStep(clip, cursor.bar, 4) : null);
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
    whammy: pickedTool === 'whammy' ? cursorKinds.whammy : null,
  };
  const count = columnCount(clip);
  // With no string picked, the tools work on the cursor's whole column, as on a one-column selection.
  const cursorIndex = indexOf(clip, cursor.bar, cursor.column);
  const target = {
    cursor,
    selection: selection ?? (columnOnly && columnAt(clip, cursor) ? { anchor: cursorIndex, focus: cursorIndex } : null),
  };
  // The controls show only when chosen (the small button under the tab); hidden, Space doesn't play.
  const { playback: playbackSettings, setPlayback: setPlaybackSettings, metronome, setMetronome } = prefs;
  const showPlayback = playbackSettings.shown;
  // The playback line: put on a column by a press above or below the staff (Jeremy,
  // 2026-10-26); it holds until the clip, the cursor or the selection changes. Play starts there,
  // else at the selection's first column, else the cursor's, else the first; Loop takes the selection.
  const [playMark, setPlayMark] = useState<{ index: number; clip: Clip; cursor: Cursor; selection: Selection | null } | null>(null);
  // The clip's own instrument, or the nearest of Frets' sounds to it (`instrument.ts`).
  const sound = soundFor(clip.instrument?.program);
  const playback = usePlayback(clip, sound, playbackSettings.volume, {
    loopPause: playbackSettings.loopPause ? playbackSettings.loopPauseSeconds : 0,
    transpose: playbackSettings.transpose,
    metronome: metronome.on,
    countIn: metronome.countIn,
    countInBars: metronome.countInBars,
    clickVolume: metronome.clickVolume,
    effects: clip.fx ?? DEFAULT_FX,
    // With "Stop leaves the cursor where it stopped" (Jeremy, 2026-10-27), the playback line goes
    // where the playhead was, so the next Play goes on from there; else everything stays as before Play.
    // The line moving lets any selection go, as every other move of it does (Jeremy, 2026-10-28).
    onStopAt: column => {
      if (!playbackSettings.stopAtPlayhead) return;
      setSelection(null);
      setPlayMark({ index: column, clip: whole, cursor: cursorAsSet, selection: null });
    },
  });
  /** A note just entered: it sounds, alone, with "Hear notes as you enter them" on and the controls showing. */
  const hearNote = (at: { bar: number; column: number; string: number }) => {
    if (playbackSettings.hearNotes && showPlayback) playback.hear(at.bar, at.column, at.string);
  };

  // The fields and panels over the tab and from the score's head.
  const head = useHeadPanels(editor, { layout, width: clipWidth, zoom, shown: { tab: view === 'tab', drawn: clipWidth > 0 } });
  // Presses and drags on the drawn tab.
  const picking = useTabPicking(editor, {
    drawn, layout, hearNote, setNotice, openWord: head.openWord,
    openSignature: head.openSignature, dropLine: () => setPlayMark(null),
  });
  const { editPicked, deletePicked } = picking;

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
  /**
   * Another track from the list over the clip: playback stops, the selection, the playback line and
   * anything picked or open go, and the cursor moves to the same bar of the new track.
   */
  const chooseTrack = (next: number) => {
    playback.stop();
    setTrackPick({ opened, track: next });
    setSelection(null);
    setPlayMark(null);
    setPicked(null);
    head.closeAll();
    setMenu(null);
    setStaffPitch(null);
    setCursor(c => ({ ...c, column: 0 }));
  };
  /** A clip read from the AlphaTex view's text: one undo step, and the text stays as typed. */
  const applyAlphaTex = (typed: Clip, text: string) => {
    // A text with no \title keeps the title the clip has: it is never blank (issue #281).
    const next = typed.name.trim() ? typed : { ...typed, name: whole.name };
    dispatchClip({ type: 'replace', clip: next });
    setDraft(d => (d && d.text === text ? { text, clip: next } : d));
  };
  /** The AlphaTex view's ×: the text and the clip emptied, one undo step (Jeremy, 2026-10-27). */
  const clearAlphaTex = () => {
    // Untitled, as a new arrangement: the title is never blank (issue #281).
    const empty = titled(emptyClip());
    dispatchClip({ type: 'replace', clip: empty });
    setDraft({ text: '', clip: empty });
  };
  const showPlaybackControls = (shown: boolean) => {
    if (!shown) playback.stop();
    setPlaybackSettings(s => ({ ...s, shown }));
  };
  /** Playback saved from Settings: hiding the controls stops playback, as their own button does. */
  const savePlayback = (next: PlaybackSettings) => {
    if (!next.shown) playback.stop();
    setPlaybackSettings(next);
  };
  const settingsGroups = [useGeneralGroup(), tabSettingsGroup(prefs, savePlayback)];
  const selectedColumns = selection ? selectedRange(selection) : null;
  const markAt = playMark && playMark.clip === whole && playMark.cursor === cursorAsSet && playMark.selection === selectionAsSet
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
    let left = whole;
    if (editing) {
      // Leaving fills the cursor's bar when Settings says to (as `onEditorBlur` would), but not while playing, as an edit stops playback;
      // a line past that bar moves on by the rests added.
      const playing = playback.view.state === 'playing';
      const leftPart = playing ? clip : leaveBar(clip, cursor.bar);
      const barEnd = clip.bars.slice(0, cursor.bar + 1).reduce((n, b) => n + b.columns.length, 0);
      if (gap >= barEnd) index += columnCount(leftPart) - count;
      left = wholeWith(leftPart);
      if (left !== whole) dispatchClip({ type: 'replace', clip: left });
      quietBlur.current = true;
      editorRef.current?.blur();
      quietBlur.current = false;
    }
    if (playback.seek(index)) return;
    setPlayMark({ index, clip: left, cursor: cursorAsSet, selection: null });
  };
  /** Puts the playback line at a gap, or takes it away; it holds until the clip, the cursor or the selection changes. */
  const placeLine = (index: number | null) => setPlayMark(index === null ? null : { index, clip: whole, cursor: cursorAsSet, selection: null });
  /** An edit made off the tab, from the playback line: one undo step, the line held at a gap of the new clip. */
  const editAtLine = (next: Part, index: number) => {
    const edited = wholeWith(next);
    if (edited !== whole) dispatchClip({ type: 'replace', clip: edited });
    setSelection(null);
    setNotice(null);
    setPlayMark({ index, clip: edited, cursor: cursorAsSet, selection: null });
  };
  /** Note input on or off; going in, the keys come to the tab. */
  const enterInput = (on: boolean) => {
    setInputMode(on);
    if (on) {
      setInputLength(startLength(clip, cursor));
      // No string is picked for you, even on a note (Jeremy, 2026-10-30, 2026-10-31): the cursor takes its
      // column alone until ↑ ↓ or a press picks one, and digits wait for it. Nor is a staff line or space.
      setColumnOnly(true);
      setStaffPitch(null);
      editorRef.current?.focus();
    }
  };

  // Off the tab, in the Notation view, the arrow keys, Delete and Esc work on the playback line (`lineKeyDown`).
  const onLineKey = useEffectEvent((e: KeyboardEvent) => {
    if (view !== 'tab') return;
    // N anywhere on the page goes into note input and back out, as on the tab (Jeremy, 2026-10-30: shortcuts are page-wide).
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    if (e.key === 'n' && plain && !(e.target as Element | null)?.closest?.(`${TEXT_FIELDS}, [role="dialog"], [role="menu"], .tab-editor`)) {
      e.preventDefault();
      enterInput(!inputMode);
      return;
    }
    lineKeyDown(e, { clip, count, line: markAt, selection, select: setSelection, placeLine, editAtLine });
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onLineKey(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // While the footer shows, Space anywhere on the page plays and stops (Jeremy, 2026-10-26), but not
  // in a field or a dialog; the tab keeps the focus, so its cursor stays.
  useSpaceKey(() => playback.toggle(playFrom, playUntil), { enabled: showPlayback, keepFocusOn: '.tab-editor' });
  useShortcuts(TAB_SHORTCUTS);

  /** A bar of rests before or after the cursor's bar (Ctrl+Shift+Enter or Ctrl+Enter, the Bars group, the menu), with the cursor in it. */
  const addBar = (where: 'before' | 'after') => {
    const next = insertBar(clip, cursor, where);
    commit(next.clip, next.cursor, null);
  };

  /**
   * A palette button or panel choice. Off the tab (after Esc or a press elsewhere) nothing is under the
   * cursor, so the palette acts on nothing, as it lights nothing (Jeremy, 2026-10-30).
   */
  const onTool = (id: ToolId) => {
    if (!editing) return;
    if (id in WORD_TOOLS) head.openWord(WORD_TOOLS[id as keyof typeof WORD_TOOLS]);
    // The cursor bar's time signature panel, as a press on its drawn numbers opens (the clip's own in the first bar).
    else if (id === 'barTime') head.openSignature('time', cursor.bar, null);
    else if (id === 'barKey') head.openSignature('key', cursor.bar, null);
    else if (id === 'insertBar') addBar('after');
    else if (id === 'insertBarBefore') addBar('before');
    // In note input the Duration buttons set the next note's length, as the length keys do.
    else if (inputMode && toolValue(id)) setInputLength(lengthOf(toolValue(id)!));
    else if (inputMode && id === 'dot') setInputLength(cycleLengthDots(inputLength));
    // A dead note goes on one string; with none picked there is nothing to mark.
    else if (!(columnOnly && id === 'dead')) {
      commitKeepingMark(applyTool(clip, target, id));
    }
  };

  /** A palette change; a picked mark changed by it (vibrato to wide, a bend's amount) stays picked while it is there. */
  const commitKeepingMark = (next: Part) => {
    commit(next);
    if (picked?.kind === 'mark' && markTool(next, picked)) setPicked(picked);
  };

  /** A choice in the Bend, Tuplet, Octave line or Whammy bar panel: like a palette button, nothing off the tab. */
  const onPanelChoice = (apply: () => Part) => {
    if (editing) commitKeepingMark(apply());
  };

  /**
   * Right-click, a long press or Shift+F10 on the tab. The press has already picked what it landed on: on
   * a word, bar line or mark, its menu (Jeremy, 2026-11-01, issue #276), at the pointer, or from the keys
   * under it; elsewhere the bar menu, alone, so a signature's panel the press opened goes (Jeremy, 2026-10-29).
   */
  const openMenu = (el: HTMLElement, x: number, y: number) => {
    head.closeSignatures();
    if (picked) {
      setMenu({ ...pickedMenuSpot(el, x, y, picked), hit: picked });
      return;
    }
    setMenu({ ...menuSpot(el, x, y), hit: null });
  };

  /** Where a picked thing's menu opens: at the pointer, or with no pointer over the tab, under the thing. */
  const pickedMenuSpot = (el: HTMLElement, x: number, y: number, hit: Picked): { x: number; y: number } => {
    const svg = el.querySelector('svg');
    const r = el.getBoundingClientRect();
    if ((x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) || !svg) return menuSpot(el, x, y);
    const box = hit.kind === 'mark' ? markBox(layout, hit) : textBox(layout, hit, drawn.capo ?? null);
    if (!box) return menuSpot(el, x, y);
    const at = svg.getBoundingClientRect();
    const scale = clipWidth > 0 ? at.width / clipWidth : 1;
    return { x: at.left + box.x * scale, y: at.top + (box.y + box.height) * scale + 4 };
  };

  /** The selected columns, or the cursor's column when nothing is selected; null in an empty bar. */
  const copiedRange = (): [number, number] | null => {
    if (selection) return selectedRange(selection);
    if (!columnAt(clip, cursor)) return null;
    const i = indexOf(clip, cursor.bar, cursor.column);
    return [i, i];
  };

  /** Each drawn line of tab's first and last column, as laid out now, for Shift+Home / End. */
  const drawnLines = (): Lines => layout.systems.flatMap(system => {
    const places = system.bars.flatMap(bar => bar.columns.map(column => column.index));
    return places.length ? [[Math.min(...places), Math.max(...places)] as [number, number]] : [];
  });

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => editorKeyDown(e, {
    clip, cursor, selection, target, columnOnly, picked, staffPitch: staffCursor, staffShown: parts !== 'tab', lastDigit: lastDigitRef, fillBars, lines: drawnLines, inputMode, setInputMode: enterInput, inputLength, setInputLength, stepElement: picking.stepToElement,
    commit, toPitch, setColumnOnly, startRegion, setPicked, deletePicked, editPicked, addBar, onTool, hearNote, onNotice: setNotice,
    dropLine: () => setPlayMark(null), leave: () => editorRef.current?.blur(),
  });

  /**
   * The focus coming to the clip; with the staff alone, its cursor is the only one, so it shows at once. Not
   * after a press that selected a bar or column, which shows as a box (issue #317).
   */
  const onEditorFocus = () => {
    setEditing(true);
    if (parts !== 'staff' || staffPitch !== null || columnOnly) return;
    const note = noteAt(clip, cursor);
    setStaffPitch(note && note.fret !== null ? writtenStrings(clip.tuning)[cursor.string] + (clip.capo ?? 0) + note.fret : pitchAtStep(clip, cursor.bar, 4));
  };

  /**
   * A press anywhere off the drawn bars (the score's head, under the tab, the page around it) lets the
   * selection and the playback line go, as MuseScore's does (Jeremy, 2026-11-01, issue #276; any selection,
   * 2026-11-01). Controls, the palette, menus and dialogs keep them, so their tools still work on them. Told
   * by what is pressed, not by where focus goes, as Safari doesn't focus a pressed button. Esc is the
   * editor's own, a step at a time (`editorKeys.ts`).
   */
  useDeselect(selection !== null || markAt !== null, () => {
    setSelection(null);
    setPlayMark(null);
  }, { keep: TAB_KEEPS, escape: false });

  /**
   * The tab losing the focus leaves the cursor's bar, which fills up when Settings says to (Jeremy, 2026-10-27): a press
   * off the tab, Esc. Not while the focus stays on the clip's own parts (a chord name's field, the
   * time signature panel) or goes to the palette, nor when the whole window loses it.
   */
  const onEditorBlur = (e: FocusEvent<HTMLDivElement>) => {
    // Its right-click menu takes the focus for a moment and gives it back: what is picked stays picked, and lit.
    if (e.relatedTarget instanceof Element && e.relatedTarget.closest('.shape-menu')) return;
    setEditing(false);
    setPicked(null);
    setColumnOnly(false);
    // Placing the playback line has filled the bar already, or left it alone while playing.
    if (quietBlur.current) return;
    const to = e.relatedTarget;
    if (to instanceof Element && to.closest('.tab-card, .tab-palette, .tab-rail, .tab-rail-panel')) return;
    if (!document.hasFocus()) return;
    const filled = leaveBar(clip, cursor.bar);
    if (filled !== clip) dispatch({ type: 'replacePart', part: filled });
  };

  /**
   * Puts a clip in at the cursor, or at the selection's start: over the time there, as MuseScore pastes
   * (issue #238: bars stay full), or with `insert` in before it, as Insert paste and Arrangements…'s Insert do.
   */
  const putAtCursor = (put: Clip, insert: boolean) => {
    const at = selection ? { ...cursor, ...placeOf(clip, selectedRange(selection)[0]) } : cursor;
    const pasted = (insert ? insertPaste : pasteOver)(clip, at, partOf(put));
    if (inputMode) commit(pasted.clip, pasted.cursor, null);
    else {
      // In normal mode what was put in is selected, as MuseScore leaves a paste (Jeremy, 2026-10-31).
      const start = isEmpty(clip) ? 0 : indexOf(clip, at.bar, clip.bars[at.bar].columns.length === 0 ? 0 : at.column);
      commit(pasted.clip, pasted.cursor, { anchor: start, focus: indexOf(pasted.clip, pasted.cursor.bar, pasted.cursor.column) });
      startRegion();
    }
    setView('tab');
  };

  /** Puts pasted tab over the time from the cursor (or in before it, `insert`), or says why it can't. */
  const pasteTab = async (text: string, insert = false) => {
    const result = await readTab(text);
    if (!result.ok) {
      setNotice({ tone: 'error', lines: result.errors });
      return;
    }
    putAtCursor(result.clip, insert);
    if (result.warnings.length > 0) setNotice({ tone: 'info', lines: result.warnings });
  };
  const pasteText = useEffectEvent((text: string, insert: boolean) => pasteTab(text, insert));

  /** Writes the selected columns (or the cursor's) to the clipboard as alphaTex; a cut also makes them rests. */
  const copyOrCut = useEffectEvent((e: ClipboardEvent, cut: boolean) => {
    const range = copiedRange();
    if (!range || !e.clipboardData) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', copyText(clip, range));
    if (!cut) return;
    // Bars stay full (issue #238): a cut leaves rests, as MuseScore's does; Ctrl/⌘+Delete takes the time away.
    // The rests stay selected, so nothing else is left lit (Jeremy, 2026-10-31).
    const cleared = clearToRests(clip, { anchor: range[0], focus: range[1] });
    commit(cleared.clip, clampCursor(cleared.clip, cursor), cleared.selection);
    startRegion();
  });

  // New, Arrangements…, Save, Save as…, and what opens from outside My arrangements.
  const file = useArrangementFile(arrangements, {
    parts, onNotice: setNotice,
    onShown: () => {
      setCursor(START);
      setSelection(null);
      setNotice(null);
      setView('tab');
    },
    showTab: () => setView('tab'),
    toStart: () => { setCursor(START); setSelection(null); },
    // Insert in Arrangements…: the clip goes in before the cursor.
    onInsert: inserted => putAtCursor(inserted, true),
  });

  /** Whether the next paste is Insert paste, from Ctrl/⌘+Shift+V. */
  const insertNext = useRef(false);

  // Paste anywhere on the page; copy and cut in the editor; undo and redo.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as Element | null)?.closest?.(TEXT_FIELDS)) return;
      const text = e.clipboardData?.getData('text/plain');
      const insert = insertNext.current;
      insertNext.current = false;
      if (!text) return;
      e.preventDefault();
      void pasteText(text, insert);
    };
    // Copy and cut belong to the editor only; elsewhere they copy the page's own selected text.
    const inEditor = (e: Event) => editorRef.current !== null && editorRef.current.contains(e.target as Node);
    const onCopy = (e: ClipboardEvent) => { if (inEditor(e)) copyOrCut(e, false); };
    const onCut = (e: ClipboardEvent) => { if (inEditor(e)) copyOrCut(e, true); };
    const onKey = (e: KeyboardEvent) => {
      // Ctrl/⌘+Shift+V is Insert paste: the paste it makes goes in before the cursor (issue #238).
      insertNext.current = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v';
      // Ctrl+Y redoes too, as in MuseScore and Windows (issue #238); ⌘+Y is left to the browser.
      const redoY = e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'y';
      if (!redoY && (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z')) return;
      if ((e.target as Element | null)?.closest?.(TEXT_FIELDS)) return;
      e.preventDefault();
      dispatchClip({ type: redoY || e.shiftKey ? 'redo' : 'undo' });
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
  }, [dispatchClip, editorRef]);

  const actions = useClipActions({
    clip: whole, track, view, parts, shown, onShown: setShown, exportStyle, alphaTexText, shownText, onNotice: setNotice,
  });

  const name = clip.name.trim() || UNTITLED;
  const empty = isEmpty(clip);
  // Bars that don't add up, and tuplets missing notes, said in a line under the tab (never a tint on it).
  const unevenLine = [unevenMessage(clip), brokenTupletMessage(clip)].filter(Boolean).join(' ');

  // In normal mode a column with no note picked is lit as a selection is, never boxed: arrowing onto a rest,
  // as MuseScore does, lights the rest (Jeremy, 2026-10-31: the box came back after Delete and the arrows).
  const columnLit = editing && !picked && !inputMode && columnOnly && staffCursor == null && columnAt(clip, cursor) !== null;
  const litStart = selection ? selectedRange(selection)[0] : columnLit ? cursorIndex : null;
  const litEnd = selection ? selectedRange(selection)[1] : columnLit ? cursorIndex : null;

  /*
   * What the drawing is handed, the same from one render to the next while it shows the same thing, so
   * a playback step or a change elsewhere on the page doesn't draw it again (`TabClip` is a `memo`).
   */
  const showsCursor = editing && !picked;
  const { bar: cursorBar, column: cursorColumn, string: cursorString } = cursor;
  const boxed = selection !== null;
  const highlight = useMemo(() => ({
    cursor: showsCursor ? { bar: cursorBar, column: cursorColumn, string: cursorString } : null,
    range: litStart === null || litEnd === null ? null : [litStart, litEnd] as [number, number],
    boxed, columnOnly, staffPitch: staffCursor, input: inputMode,
  }), [showsCursor, cursorBar, cursorColumn, cursorString, litStart, litEnd, boxed, columnOnly, staffCursor, inputMode]);
  const errors = useMemo(() => barErrors(clip), [clip]);
  const clipHandlers = useStableHandlers({
    onPick: picking.onPick, onPickRun: picking.onPickRun, onPickStaff: picking.onPickStaff, onDragStaff: picking.onDragStaff,
    onDragFret: inputMode ? undefined : picking.onDragFret, onPickRect: picking.onPickRect,
    onMiss: () => { setSelection(null); setPlayMark(null); setPicked(null); (document.activeElement as HTMLElement | null)?.blur(); },
    onPickText: picking.onPickText, onPickMark: picking.onPickMark, onPickColumn: pickColumn,
    onPickRhythm: inputMode ? undefined : picking.onPickRhythm,
    // A double-click on a word or a repeat's count opens its field, as the menu's Edit does (issue #289);
    // one on a mark or a bar line with no Edit leaves it picked. Out of note input, one anywhere else
    // on the staff or the tab goes into it (Jeremy, 2026-10-31), picking nothing, as N does.
    onDoubleClick: (word: TextHit | null, onMark: boolean) => {
      if (word && hasEdit(word)) return editPicked(word);
      if (word || onMark || inputMode) return;
      setSelection(null);
      enterInput(true);
    },
  });

  /** The symbol palette, with only `groups` (all when left out); the pencil first when `input`. */
  const drawPalette = (groups?: readonly string[], className?: string, input = false) => (
    <TabPalette
      // Lit for the cursor's notes; while a word over the tab is picked, only that word's tool (Jeremy, 2026-10-27).
      isOn={id => (pickedTool ? id === pickedTool : lit && (inputMode && (toolValue(id) || id === 'dot') ? lengthIsOn(inputLength, id) : isOn(clip, cursor, id, columnOnly)))} kinds={paletteKinds}
      onTool={onTool} onBend={quarters => onPanelChoice(() => setBend(clip, target, quarters))}
      onTuplet={n => onPanelChoice(() => setTuplet(clip, target, n))}
      onOttava={o => onPanelChoice(() => setOttava(clip, target, o))}
      onWhammy={shape => onPanelChoice(() => setWhammy(clip, target, shape ? WHAMMY_SHAPES[shape] : null))} disabled={view !== 'tab'}
      inputMode={inputMode} groups={groups} className={className} onInputMode={input ? () => enterInput(!inputMode) : undefined} />
  );

  return (
    <div className="tab-page flex flex-col gap-4">
      {/* The title, credits and tuning are drawn as the score's head, over the drawing (ScoreHead). */}
      <header className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* The file buttons (issue #259); a dot on Save while there are unsaved changes. */}
          <button type="button" className="btn btn-secondary" onClick={file.openNew}>New</button>
          <button type="button" className="btn btn-secondary" title={`Arrangements… (${MOD}O)`} onClick={file.openChooser}>Arrangements…</button>
          <button
            type="button" className="btn btn-secondary tab-save" title={`Save (${MOD}S)`}
            aria-label={arrangements.unsaved ? 'Save, unsaved changes' : 'Save'} onClick={file.save}
          >
            Save
            {arrangements.unsaved && <span className="tab-unsaved-dot" data-testid="unsaved" aria-hidden="true" />}
          </button>
          <button type="button" className="btn btn-secondary" title={`Save as (${MOD}⇧S)`} onClick={file.saveAs}>Save as…</button>
          <button type="button" className="btn btn-secondary" onClick={() => file.confirmLeave(() => setImporting(true))}>Import…</button>
          <button type="button" className="btn btn-secondary" onClick={() => setExporting(true)}>Export</button>
          {/* The last of the page's actions (Jeremy, 2026-10-29); the ⚠ after it while settings can't be saved (G5). */}
          <button
            type="button" className="btn btn-secondary btn-icon" aria-label="Settings" title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <GearIcon />
          </button>
          {saveProblem && (
            <span
              className="settings-save-problem" role="img" aria-label={`Settings couldn't be saved: ${saveProblem}`}
              title={`Settings couldn't be saved: ${saveProblem}`}
            >
              {/* As text, not the coloured emoji. */}
              ⚠{'︎'}
            </span>
          )}
          {/* Right of the settings (Jeremy, 2026-10-31): the keyboard shortcuts, as the ? key shows them. */}
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Shortcuts" title="Shortcuts (?)" onClick={showShortcuts}>
            <span aria-hidden="true" className="shortcuts-button-mark">?</span>
          </button>
        </div>
      </header>

      {/* The tools, in panels on a rail to the clip's left (issue #301). */}
      <TabRail palette={drawPalette}>
      <section className="card tab-card" aria-label="Clip">
        {/* Over the clip: Staff | Tab | Both and Size at the top left (Notation only, issue #277); the view switch, then copy and save, at the top right (Jeremy, 2026-10-27). */}
        <div className="tab-card-bar">
          <div className="tab-card-start">
            {view === 'tab' && (
              <div className="seg tab-parts" role="group" aria-label="Show">
                {PARTS.map(p => (
                  <button key={p} type="button" className="seg-opt" aria-pressed={parts === p} onClick={() => setParts(p)}>
                    {{ staff: 'Staff', tab: 'Tab', both: 'Both' }[p]}
                  </button>
                ))}
              </div>
            )}
            {view === 'tab' && <SizeField size={shown.size} onChange={size => setShown({ ...shown, size })} />}
            {/* The arrangement header folded (issue #281): its title, small, after Size; picked, it expands or edits. */}
            {view === 'tab' && !shown.header && (
              <HoverTips>
                <FoldedTitle clip={clip} onExpand={() => setShown({ ...shown, header: true })} onEditCredits={head.openCredits} />
              </HoverTips>
            )}
            {/* With several tracks, the one shown (issue #243); the AlphaTex view has them all. */}
            {whole.tracks.length > 1 && view !== 'alphatex' && (
              <select className="input tab-track-pick" aria-label="Track" value={track} onChange={e => chooseTrack(Number(e.target.value))}>
                {whole.tracks.map((_, i) => <option key={i} value={i}>{trackName(whole, i)}</option>)}
              </select>
            )}
          </div>
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
          {/* Size zooms the drawing, its head and everything over it: presses, fields and panels alike. */}
          <div style={view === 'tab' && zoom !== 1 ? { zoom } : undefined}>
          {/* The head belongs to the drawing; the text views carry the same in their text (Jeremy, 2026-10-28). */}
          {view === 'tab'
            ? <>
              {!shown.header && <h1 className="sr-only">{name}</h1>}
              <HoverTips>
              <ScoreHead
                clip={clip} folded={!shown.header} tuningFolded={!shown.tuningDetails}
                onCollapse={() => setShown({ ...shown, header: false })}
                onFoldTuning={fold => setShown({ ...shown, tuningDetails: !fold })}
                onEditCredits={head.openCredits} onEditTuning={head.openTuning} onEditTempo={head.openHeadTempo}
              />
              </HoverTips>
            </>
            : <>
              {/* The page keeps its heading for screen readers. */}
              <h1 className="sr-only">{name}</h1>
            </>}
          <div className="relative">
            {/* Under the editor: the loop bracket. */}
            {view === 'tab' && clipWidth > 0 && <Playhead clip={drawn} layout={layout} width={clipWidth} playback={playback} mark={markAt} markOnly={!showPlayback} layer="under" />}
            {view === 'tab'
              ? clipWidth > 0 && (
                <div
                  // A textbox, so screen readers pass the keys through to it as they do to a text field.
                  ref={editorRef} className="tab-editor export-trigger" tabIndex={0} role="textbox" aria-multiline="true"
                  aria-label={inputMode
                    ? 'Tab editor, note input: ↑ ↓ pick a string and digits type frets, Shift+digits or on the staff digits set the next note’s length, arrows move, Shift+arrows select; on the staff, Enter adds or removes a note; Esc or N for normal mode; Shift+F10 to insert a bar'
                    : 'Tab editor: a press selects, arrows change the selected note, Shift+arrows select; N for note input; Shift+F10 to insert a bar'}
                  onKeyDown={onKeyDown} onFocus={onEditorFocus} onBlur={onEditorBlur}
                  // Right-click, a long press or Shift+F10: insert a bar before or after.
                  {...menuTrigger.props(openMenu)}
                >
                  {/* A bar's warning explains itself on hover. */}
                  <HoverTips>
                    <TabClip
                      clip={drawn} layout={layout} width={clipWidth} parts={parts} barNumbers={shown.barNumbers} title={`${name}, drawn as ${parts === 'staff' ? 'a staff' : 'tab'}`}
                      {...clipHandlers} columnReach={COLUMN_REACH}
                      highlight={highlight}
                      shadow={inputMode ? inputLength.value : null}
                      picked={editing ? picked : null}
                      errors={errors}
                    />
                  </HoverTips>
                </div>
              )
              : view === 'alphatex'
                ? (
                  <HoverTips>
                    <AlphaTexEditor clip={whole} text={alphaTexText} onText={text => setDraft({ text, clip: whole })} onClip={applyAlphaTex} onClear={clearAlphaTex} lineNumbers={shown.lineNumbers} />
                  </HoverTips>
                )
                : <pre className="tab-ascii" data-testid="tab-ascii">{shownText}</pre>}
            {/* Over the editor, so a press on a loop end drags it rather than placing the cursor. */}
            {/* The playhead's and the playback line's lines, over the selection's band. */}
            {view === 'tab' && clipWidth > 0 && <Playhead clip={drawn} layout={layout} width={clipWidth} playback={playback} mark={markAt} markOnly={!showPlayback} layer="over" />}
            {view === 'tab' && showPlayback && clipWidth > 0 && <LoopHandles layout={layout} width={clipWidth} playback={playback} />}
            {head.panels}
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
            track={{ name: whole.tracks[track].name, index: track }}
            sound={sound} soundNote={substituteNote(clip.instrument?.program)}
            onSound={next => commit({ ...clip, instrument: { program: next, tag: instrumentTag(next) } })}
            volume={playbackSettings.volume} onVolume={volume => setPlaybackSettings(s => ({ ...s, volume }))}
            hearNotes={playbackSettings.hearNotes} onHearNotes={hearNotes => setPlaybackSettings(s => ({ ...s, hearNotes }))}
            transpose={playbackSettings.transpose} onTranspose={transpose => setPlaybackSettings(s => ({ ...s, transpose }))}
            effects={clip.fx ?? DEFAULT_FX} onEffects={fx => dispatch({ type: 'fx', track, fx })}
            options={playbackSettings} onOptions={options => setPlaybackSettings(s => ({ ...s, ...options }))}
            metronome={metronome.on} onMetronome={on => setMetronome(m => ({ ...m, on }))}
            countIn={metronome.countIn} onCountIn={countIn => setMetronome(m => ({ ...m, countIn }))}
            countInBars={metronome.countInBars} onCountInBars={countInBars => setMetronome(m => ({ ...m, countInBars }))}
            clickVolume={metronome.clickVolume} onClickVolume={clickVolume => setMetronome(m => ({ ...m, clickVolume }))}
          />
        </HoverTips>
        </PinnedPlayback>
        )}
      </section>
      </TabRail>

      <p
        className={`m-0 min-h-[1.5em] ${notice?.tone === 'error' ? 'text-(--danger)' : 'text-(--ink-muted)'}`}
        role="status" data-testid="tab-notice"
      >
        {notice ? notice.lines.join(' ') : empty ? 'Click the tab and type frets, or import or paste alphaTex or ASCII tab.' : unevenLine}
      </p>

      <ImportDialog open={importing} onClose={() => setImporting(false)} onImport={file.importText} />
      {file.dialogs}
      {menu && (
        <ShapeMenu
          x={menu.x} y={menu.y} label={menu.hit ? 'Selected' : 'Tab'}
          onClose={refocus => {
            if (refocus) editorRef.current?.focus();
            else {
              // A press away from the menu: the tab lets the keys go, as its blur would have when the menu opened.
              setEditing(false);
              setPicked(null);
              setColumnOnly(false);
            }
            setMenu(null);
          }}
          items={menu.hit ? [
            // A picked word or repeat's count: Edit, then Delete; a mark, a repeat's start or a double bar: Delete.
            ...(hasEdit(menu.hit) ? [{ label: 'Edit', onSelect: () => editPicked(menu.hit as WordHit) }] : []),
            { label: 'Delete', onSelect: () => deletePicked(menu.hit!) },
          ] : [
            // The bar under a right-click already has the cursor: the press put it there.
            { label: 'Insert bar before', onSelect: () => addBar('before') },
            { label: 'Insert bar after', onSelect: () => addBar('after') },
            // Paste writes over what is there; this puts the clipboard's tab in before the cursor instead (issue #238).
            { label: 'Insert paste', onSelect: () => void navigator.clipboard?.readText().then(text => { if (text) void pasteTab(text, true); }, () => {}) },
          ]}
        />
      )}
      {actions.popups}
      <SettingsDialog settingsGroups={settingsGroups} open={settingsOpen} at={TAB_SETTINGS_START} onClose={() => setSettingsOpen(false)} />
      <TabExportDialog
        clip={whole} track={track} parts={parts} view={shown} open={exporting} style={exportStyle} onStyle={setExportStyle}
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
