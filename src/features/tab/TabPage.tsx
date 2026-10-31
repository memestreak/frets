'use client';

import { type CSSProperties, type FocusEvent, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { ShapeMenu } from '@/components/chords/export/ShapeMenu';
import { menuSpot, useMenuTrigger } from '@/components/chords/export/useMenuTrigger';
import { usePreferenceSaveProblem } from '@/hooks/usePersist';
import { GearIcon } from '@/components/icons';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useGeneralGroup } from '@/components/settings/general';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { writeAscii } from './ascii';
import { barErrors, brokenTupletMessage, emptyClip, partOf, trackName, withPart, unevenMessage, MAX_CAPO, UNTITLED, type Clip, type Duration, type Part } from './clip';
import { clipAction, type ClipAction, type PartAction } from './clipState';
import { useArrangements } from './useArrangements';
import { ArrangementsDialog } from './ArrangementsDialog';
import { clampCursor, columnAt, columnCount, copyText, indexOf, insertBar, insertPaste, fillBar, isEmpty, noteAt, pasteOver, placeOf, runAround, selectedRange, setFret, START, type Cursor, type Selection } from './editing';
import { setBarKey, setBarTime, setCapo, setChordName, setBeatText, setEnding, setSection, setTempo } from './barEdits';
import { makeRest, removeMark, setBend, setOttava, setTuplet, setWhammy } from './noteEdits';
import { WHAMMY_SHAPES } from './whammy';
import { editorKeyDown, lineKeyDown, type LastDigit } from './editorKeys';
import { layoutClip, PARTS, type Parts } from './layout';
import type { Lines } from './jumps';
import { type StaffDrag, type StaffHit } from './hitTest';
import { type TextHit, type WordHit } from './layoutText';
import { RUN_MARKS, type RunMark } from './runs';
import { writtenStrings } from './notation';
import type { Notice } from './notice';
import { movedPitch, moveNotes, notesToMove, pitchAtStep, pitchOf, stringAtPitch, toggleStaffNote } from './staffEntry';
import { markTool, type MarkHit } from './marks';
import { BarKeyPanel } from './BarKeyPanel';
import { CreditsPanel, type HeadField } from './CreditsPanel';
import { BarTimePanel } from './BarTimePanel';
import { useClipActions } from './ClipActions';
import { WordField, type FieldKind } from './WordField';
import { barTempoSpot, barTimeSpot, PANEL_DROP, PANEL_LEAD, wordNow, wordSpot, WordTools } from './WordTools';
import { TabClip } from './TabClip';
import { ImportDialog } from './TabDialogs';
import { TabPalette } from './TabPalette';
import { TabExportDialog } from './TabExportDialog';
import { writeAlphaTex } from './alphatex';
import { DEFAULT_FX } from './effects';
import { instrumentTag, soundFor, substituteNote } from './instrument';
import { AlphaTexEditor } from './AlphaTexEditor';
import { readTab } from './readTab';
import { applyTool, isOn, noteKinds, toolValue, WORD_TOOL, WORD_TOOLS, type ToolId } from './tools';
import { cycleLengthDots, lengthIsOn, lengthOf, startLength } from './inputLength';
import { elementsOf, stepElement } from './elements';
import { pitchAt } from './normalMode';
import { ScoreHead } from './ScoreHead';
import { TempoPanel } from './TempoPanel';
import { TuningPanel } from './TuningPanel';
import { laidOut, paletteOf, sectionsOf, shownColours, viewOf, type ColourPair, type TabView } from './viewOptions';
import { TAB_SETTINGS_START, tabSettingsGroup, useTabPrefs } from './tabSettings';
import { VIEWS, type View } from './views';
import { PinnedPlayback } from './PinnedPlayback';
import { LoopHandles, PlaybackFooter, Playhead, usePlayback, type PlaybackSettings } from './PlaybackFooter';
import { clearExampleHash, useClipImport } from './useClipImport';
import { useWidth } from './useWidth';
import { TAB_SHORTCUTS } from './shortcuts';
import { showShortcuts, useShortcuts } from '@/components/shortcuts/useShortcuts';

const TEXT_FIELDS = 'input, select, textarea, dialog';


/** How far above and below the drawn clip a press still moves the cursor or the playback line, in px: about the card's margin. */
const COLUMN_REACH = 16;

/**
 * The Tab page: one clip, the open one of My arrangements (Arrangements…), saved as it is edited;
 * Import, a drop or a `#tab=` link open as a new one, a paste goes in at the cursor. One of the
 * examples may be shown in its place (Arrangements… or a `#example=` link; never saved, Back to
 * my clip brings the clip back, Keep a copy makes it an arrangement), edited
 * on the tab with the keys and the symbol palette, and shown drawn, as
 * alphaTex or as ASCII. See `docs/specs/2026-10-24-tab-editor-design.md` and
 * `docs/specs/2026-10-25-tab-editing-design.md`; the formats are
 * `public/tab-alphatex.txt` and `public/tab-ascii.txt`.
 */
export default function TabPage() {
  // The open arrangement, saved as it is edited, and the others kept (My arrangements).
  const arrangements = useArrangements();
  const { state, dispatch: dispatchClip } = arrangements;
  // The whole clip, every track: saved, linked, written as alphaTex and edited in the AlphaTex view.
  const whole = state.clip;
  // The example or sample shown in place of the clip (only its id is needed here); its edits are never saved.
  const example = state.example;
  /**
   * The track the page shows, edits and plays (issue #243), picked from the list over the clip: the
   * viewer's, not saved, and back to the first when another arrangement or example opens. An edit in
   * the AlphaTex view that takes tracks away leaves the last one shown. Its FX are the ones playback goes through.
   */
  const opened = example ? `example:${example.id}` : state.id;
  const [trackPick, setTrackPick] = useState({ opened, track: 0 });
  const track = trackPick.opened === opened ? Math.min(trackPick.track, whole.tracks.length - 1) : 0;
  // Its edits go back into the whole clip through `dispatch`.
  const clip = useMemo(() => partOf(whole, track), [whole, track]);
  const dispatch = (action: ClipAction | PartAction) => dispatchClip(clipAction(whole, action, track));
  /** The whole clip with an edit of the shown track in it; the same clip for no edit. */
  const wholeWith = (part: Part): Clip => (part === clip ? whole : withPart(whole, part, track));
  const [choosing, setChoosing] = useState(false);
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
  const leaveBar = (from: Part, bar: number) => (fillBars ? fillBar(from, bar) : from);
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
  /**
   * The staff's own cursor (issue #136): the sounding pitch on the cursor's column that Enter adds or
   * takes away. Set by a press on the staff, which hands the keys to it; a press on the tab sets it to
   * null and hands them back. With the staff alone it is always there.
   */
  const [staffPitch, setStaffPitch] = useState<number | null>(null);
  /**
   * Note input (issue #238, as MuseScore's): N or the palette's pencil goes in and out, Esc out. In it the
   * cursor types and a press enters a note; out of it, in normal mode, a press selects what it is on.
   */
  const [inputMode, setInputMode] = useState(false);
  /**
   * Note input's length (`inputLength.ts`): the next note entered on a rest takes it, as MuseScore's
   * does. Set on the way in from the notes there, then by the length keys and the Duration buttons.
   */
  const [inputLength, setInputLength] = useState<Duration>({ value: 4, dots: 0 });
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
  // The clip as drawn: its own line breaks only when the view keeps them; edits still go to `clip`.
  const drawn = laidOut(clip, shown);
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
  /**
   * The score head's open panel and where it was pressed, in viewport pixels; the title and credits'
   * and the tempo's hold the clip as it opened, the undo step their changes become (the credits' also
   * the field the press focuses). A tempo panel opened from the tab (the Tempo tool, a picked tempo's
   * Edit) gives the keys back to the tab when it closes.
   */
  const [headPanel, setHeadPanel] = useState<
    | { kind: 'credits'; x: number; y: number; from: Part; field: HeadField }
    | { kind: 'tuning'; x: number; y: number }
    | { kind: 'tempo'; x: number; y: number; from: Part; bar: number; fromTab: boolean }
    | null
  >(null);
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
  const selection = selectionAsSet && Math.max(selectionAsSet.anchor, selectionAsSet.focus) < count ? selectionAsSet : null;
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
    setWord(null);
    setHeadPanel(null);
    setTimeBar(null);
    setKeyBar(null);
    setBarMenu(null);
    setStaffPitch(null);
    setCursor(c => ({ ...c, column: 0 }));
  };
  /** A clip read from the AlphaTex view's text: one undo step, and the text stays as typed. */
  const applyAlphaTex = (next: Clip, text: string) => {
    dispatchClip({ type: 'replace', clip: next });
    setDraft(d => (d && d.text === text ? { text, clip: next } : d));
  };
  /** The AlphaTex view's ×: the text and the clip emptied, one undo step (Jeremy, 2026-10-27). */
  const clearAlphaTex = () => {
    const empty = emptyClip();
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

  /** Records an edit as one undo step and moves the cursor; a change that changed nothing is not a step. */
  const commit = (next: Part, nextCursor: Cursor = cursor, nextSelection: Selection | null = selection) => {
    if (next !== clip) dispatch({ type: 'replacePart', part: next });
    setCursor(nextCursor);
    setSelection(nextSelection);
    setPicked(null);
    setNotice(null);
  };

  const openWord = (kind: FieldKind | 'tempo', at: Cursor = cursor) => {
    if (kind === 'tempo') {
      openTempo(at.bar);
      return;
    }
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

  /**
   * A palette button or panel choice. Off the tab (after Esc or a press elsewhere) nothing is under the
   * cursor, so the palette acts on nothing, as it lights nothing (Jeremy, 2026-10-30).
   */
  const onTool = (id: ToolId) => {
    if (!editing) return;
    if (id in WORD_TOOLS) openWord(WORD_TOOLS[id as keyof typeof WORD_TOOLS]);
    // The cursor bar's time signature panel, as a press on its drawn numbers opens (the clip's own in the first bar).
    else if (id === 'barTime') { setPanelAt(null); setTimeBar(cursor.bar); }
    else if (id === 'barKey') { setPanelAt(null); setKeyBar(cursor.bar); }
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
   * Right-click, a long press or Shift+F10 on the tab: the bar menu, alone. A long press has already
   * picked what it landed on, so a signature's panel or a word's outline it opened goes (Jeremy, 2026-10-29).
   */
  const openBarMenu = (el: HTMLElement, x: number, y: number) => {
    setTimeBar(null);
    setKeyBar(null);
    setPicked(null);
    setBarMenu(menuSpot(el, x, y));
  };

  const closeTimeBar = useCallback((byKey: boolean) => {
    setTimeBar(null);
    if (byKey) editorRef.current?.focus();
  }, []);
  const closeKeyBar = useCallback((byKey: boolean) => {
    setKeyBar(null);
    if (byKey) editorRef.current?.focus();
  }, []);

  /** A typed chord name, text, section or capo set (an empty one clears it); null leaves it as it was. */
  const finishWord = (value: string | null, byKey: boolean) => {
    const w = word;
    setWord(null);
    // After Enter or Esc the keys go back to the tab; leaving the field leaves the focus where it went.
    if (byKey) editorRef.current?.focus();
    if (!w || value === null) return;
    if (w.kind === 'chord') commit(setChordName(clip, { bar: w.bar, column: w.column, string: cursor.string }, value));
    if (w.kind === 'text') commit(setBeatText(clip, { bar: w.bar, column: w.column, string: cursor.string }, value));
    if (w.kind === 'section') commit(setSection(clip, w.bar, value));
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
    const left = editing && bar !== cursor.bar ? leaveBar(clip, cursor.bar) : clip;
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

  /** Each drawn line of tab's first and last column, as laid out now, for Shift+Home / End. */
  const drawnLines = (): Lines => layoutClip(drawn, clipWidth, parts).systems.flatMap(system => {
    const places = system.bars.flatMap(bar => bar.columns.map(column => column.index));
    return places.length ? [[Math.min(...places), Math.max(...places)] as [number, number]] : [];
  });

  /** A Shift+drag's rectangle (issue #238): the columns it took in are selected, as Shift+arrows select them. */
  const onPickRect = (from: number, to: number) => {
    lastDigit.current = null;
    setPicked(null);
    setPlayMark(null);
    commit(clip, { ...cursor, ...placeOf(clip, to) }, { anchor: from, focus: to });
    startRegion();
    editorRef.current?.focus();
  };

  /** Alt+← → (issue #238): the next or last thing a press can pick, picked as a press would. */
  const stepToElement = (step: 1 | -1) => {
    const list = elementsOf(drawn, layoutClip(drawn, clipWidth, parts));
    const index = indexOf(clip, cursor.bar, cursor.column);
    const note = !columnOnly && noteAt(clip, cursor);
    const current = picked ? picked
      : note ? { kind: 'note' as const, index, string: cursor.string } : { kind: 'column' as const, index };
    const next = stepElement(list, current, step);
    if (!next) return;
    if (next.kind === 'mark') return onPickMark(next);
    const at = { ...cursor, ...('index' in next ? placeOf(clip, next.index) : { bar: next.bar, column: 0 }) };
    lastDigit.current = null;
    if (next.kind === 'note') {
      const string = next.string;
      // On the staff, its cursor goes to the note's pitch (a dead note has none, so the tab takes it).
      const pitch = staffPitch !== null ? pitchAt(clip, { ...at, string }) : null;
      setPicked(null);
      if (pitch !== null) toPitch(clip, { ...at, string }, pitch, null);
      else {
        setStaffPitch(null);
        commit(clip, { ...at, string }, null);
        setColumnOnly(false);
      }
    } else if (next.kind === 'rest') {
      setPicked(null);
      setStaffPitch(null);
      commit(clip, at, null);
      setColumnOnly(true);
    } else {
      setStaffPitch(null);
      commit(clip, at, null);
      setPicked(next);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => editorKeyDown(e, {
    clip, cursor, selection, target, columnOnly, picked, staffPitch: staffCursor, staffShown: parts !== 'tab', lastDigit, fillBars, lines: drawnLines, inputMode, setInputMode: enterInput, inputLength, setInputLength, stepElement: stepToElement,
    commit, toPitch, setColumnOnly, startRegion, setPicked, deletePicked, editPicked, addBar, onTool, hearNote, onNotice: setNotice,
    dropLine: () => setPlayMark(null), leave: () => editorRef.current?.blur(),
  });

  /**
   * Starting a run of selected columns lets go of the note the cursor was on (Jeremy, 2026-10-28): no
   * string is picked and the staff's cursor goes, so nothing stays lit when the run does.
   */

  const startRegion = () => {
    setColumnOnly(true);
    setStaffPitch(null);
  };

  /** Every column of a bar, selected. */
  const barSelection = (of: Part, bar: number): Selection => ({ anchor: indexOf(of, bar, 0), focus: indexOf(of, bar, of.bars[bar].columns.length - 1) });

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
      // A press in another bar leaves the cursor's bar, which fills up when Settings says to; the rests go after its last
      // column, so the bar pressed keeps its columns.
      const left = editing && hit.bar !== cursor.bar ? leaveBar(clip, cursor.bar) : clip;
      const there = hasColumn && noteAt(left, hit);
      if (inputMode && hasColumn && !there) {
        // In note input a press on a string enters an open string there, as MuseScore's does; digits then change it.
        commit(setFret(left, hit, 0, inputLength), hit, null);
        hearNote(hit);
      } else if (!inputMode && !there && hasColumn) {
        // In normal mode a press beside the notes selects the bar, as MuseScore's does (Jeremy, 2026-10-31, issue #238).
        commit(left, hit, barSelection(left, hit.bar));
        startRegion();
      } else {
        commit(left, hit, null);
        if (!inputMode && !there) setColumnOnly(true);
      }
    }
  };

  /** The cursor on the column at a pitch: its string boxed when a note there has it, else the column alone. */
  const toPitch = (next: Part, at: Cursor, pitch: number, nextSelection: Selection | null = null) => {
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
    const left = editing && hit.bar !== cursor.bar ? leaveBar(clip, cursor.bar) : clip;
    if (note) {
      toPitch(left, at, pitch);
    } else if (inputMode && clip.bars[hit.bar].columns.length > 0) {
      // In note input a press on a line or space enters the shadow note's pitch there (issue #238).
      const edit = stringAtPitch(left, at, pitch) === null ? toggleStaffNote(left, at, pitch, inputLength) : { clip: left, string: null };
      toPitch(edit.clip, at, pitch);
      if (edit.string !== null) hearNote({ ...at, string: edit.string });
      if ('problem' in edit && edit.problem) setNotice({ tone: 'error', lines: [edit.problem] });
    } else if (inputMode) {
      toPitch(left, at, pitch);
    } else {
      // In normal mode a press beside the heads selects the bar, as on the tab.
      commit(left, at, left.bars[hit.bar].columns.length > 0 ? barSelection(left, hit.bar) : null);
      startRegion();
    }
  };

  /**
   * A drag of a note head on the staff (issue #174): the clip it started from, the selection it carries
   * (when the head pressed is in one), and the last move that worked, shown while the drag goes on.
   */
  const dragFrom = useRef<{ clip: Part; selection: Selection | null; good: { clip: Part; pitch: number } | null } | null>(null);

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
      if (shown.clip !== from.clip) dispatch({ type: 'replacePart', part: shown.clip, from: from.clip });
      else dispatch({ type: 'previewPart', part: from.clip });
    } else dispatch({ type: 'previewPart', part: shown.clip });
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
   * The tab losing the focus leaves the cursor's bar, which fills up when Settings says to (Jeremy, 2026-10-27): a press
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
    const filled = leaveBar(clip, cursor.bar);
    if (filled !== clip) dispatch({ type: 'replacePart', part: filled });
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

  /**
   * Puts pasted tab over the time from the cursor, or from the selection's start (issue #238: bars stay
   * full, as MuseScore pastes); `insert` puts it in before the cursor's column instead, as Insert paste
   * does. Says why it can't when the text isn't tab.
   */
  const pasteTab = async (text: string, insert = false) => {
    const result = await readTab(text);
    if (!result.ok) {
      setNotice({ tone: 'error', lines: result.errors });
      return;
    }
    const at = selection ? { ...cursor, ...placeOf(clip, selectedRange(selection)[0]) } : cursor;
    const pasted = (insert ? insertPaste : pasteOver)(clip, at, partOf(result.clip));
    commit(pasted.clip, pasted.cursor, null);
    if (result.warnings.length > 0) setNotice({ tone: 'info', lines: result.warnings });
    setView('tab');
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
    commit(makeRest(clip, { cursor, selection: { anchor: range[0], focus: range[1] } }), cursor, null);
  });

  const { importText, showExample, leaveExample } = useClipImport({
    dispatch: dispatchClip, openNew: arrangements.openNew, onNotice: setNotice, showTab: () => setView('tab'),
    toStart: () => { setCursor(START); setSelection(null); },
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
  }, [dispatchClip]);

  const actions = useClipActions({
    clip: whole, track, view, parts, shown, onShown: setShown, exportStyle, alphaTexText, shownText, onNotice: setNotice,
  });

  const name = clip.name.trim() || UNTITLED;
  /**
   * The tempo panel from the tab: the first bar's under the head's tempo, as a press on it opens it;
   * a later bar's just under where its tempo is drawn.
   */
  const openTempo = (bar: number) => {
    const head = bar === 0 ? document.querySelector('.score-tempo-button') : null;
    const editor = editorRef.current;
    let at = { x: 0, y: 0 };
    if (head) {
      const box = head.getBoundingClientRect();
      at = { x: box.left, y: box.bottom + 4 };
    } else if (editor) {
      // The drawing's units are zoomed by the View options' Size.
      const box = editor.getBoundingClientRect();
      const spot = barTempoSpot(drawn, clipWidth, parts, bar);
      at = { x: box.left + spot.x * zoom, y: box.top + spot.y * zoom };
    }
    setHeadPanel({ kind: 'tempo', ...at, from: clip, bar, fromTab: true });
  };
  /** The tempo as set: shown at once, kept as one undo step when the panel closes, or put back. */
  const finishTempo = (from: Part, kept: Part | null, fromTab: boolean) => {
    setHeadPanel(null);
    if (kept && kept !== from) dispatch({ type: 'replacePart', part: kept, from });
    else dispatch({ type: 'previewPart', part: from });
    if (fromTab) editorRef.current?.focus();
  };
  /** The title and credits as typed: shown at once, kept as one undo step when the panel closes, or put back. */
  const finishCredits = (from: Part, kept: Part | null) => {
    setHeadPanel(null);
    if (kept && kept !== from) dispatch({ type: 'replacePart', part: kept, from });
    else dispatch({ type: 'previewPart', part: from });
  };
  /** Deletes from the Arrangements dialog, which stays open; when `ids` hold the open one, another is shown. */
  const removing = (ids: string[], remove: () => void) => {
    if (!ids.includes(state.id)) {
      remove();
      return;
    }
    replaceShown(() => { remove(); clearExampleHash(); });
    setChoosing(true);
  };
  /** What is shown in place of the open arrangement, from the Arrangements dialog. */
  const replaceShown = (open: () => void) => {
    open();
    setCursor(START);
    setSelection(null);
    setNotice(null);
    setView('tab');
    setChoosing(false);
  };
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
          {/* An example kept as one of My arrangements, with the edits made to it. */}
          {example && (
            <button type="button" className="btn btn-secondary" onClick={() => replaceShown(() => { arrangements.openNew(whole); clearExampleHash(); })}>
              Keep a copy
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => { arrangements.forgetDeleted(); setChoosing(true); }}>Arrangements…</button>
          <button type="button" className="btn btn-secondary" onClick={() => setImporting(true)}>Import…</button>
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
              ⚠{'\uFE0E'}
            </span>
          )}
          {/* Right of the settings (Jeremy, 2026-10-31): the keyboard shortcuts, as the ? key shows them. */}
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Shortcuts" title="Shortcuts (?)" onClick={showShortcuts}>
            <span aria-hidden="true" className="shortcuts-button-mark">?</span>
          </button>
        </div>
      </header>

      <HoverTips>
        {/* Lit only while the cursor is in the tab: off it, nothing is under the cursor. */}
        <TabPalette
          // Lit for the cursor's notes; while a word over the tab is picked, only that word's tool (Jeremy, 2026-10-27).
          isOn={id => (pickedTool ? id === pickedTool : lit && (inputMode && (toolValue(id) || id === 'dot') ? lengthIsOn(inputLength, id) : isOn(clip, cursor, id, columnOnly)))} kinds={paletteKinds}
          onTool={onTool} onBend={quarters => onPanelChoice(() => setBend(clip, target, quarters))}
          onTuplet={n => onPanelChoice(() => setTuplet(clip, target, n))}
          onOttava={o => onPanelChoice(() => setOttava(clip, target, o))}
          onWhammy={shape => onPanelChoice(() => setWhammy(clip, target, shape ? WHAMMY_SHAPES[shape] : null))} disabled={view !== 'tab'}
          inputMode={inputMode} onInputMode={() => enterInput(!inputMode)} />
      </HoverTips>

      <section className="card tab-card" aria-label="Clip">
        {/* Over the clip: Staff | Tab | Both at the top left (Notation only); the view switch, then copy and save, at the top right (Jeremy, 2026-10-27). */}
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
          {/* The View options' Size zooms the drawing, its head and everything over it: presses, fields and panels alike. */}
          <div style={view === 'tab' && zoom !== 1 ? { zoom } : undefined}>
          {/* The head belongs to the drawing; the text views carry the same in their text (Jeremy, 2026-10-28). */}
          {view === 'tab'
            ? <ScoreHead
                clip={clip} note={example && exampleNote}
                onEditCredits={(x, y, field) => setHeadPanel({ kind: 'credits', x, y, from: clip, field })}
                onEditTuning={(x, y) => setHeadPanel({ kind: 'tuning', x, y })}
                onEditTempo={(x, y) => setHeadPanel({ kind: 'tempo', x, y, from: clip, bar: 0, fromTab: false })}
              />
            : <>
              {/* The page keeps its heading for screen readers. */}
              <h1 className="sr-only">{name}</h1>
              {example && exampleNote}
            </>}
          <div className="relative">
            {/* Under the editor: the loop bracket. */}
            {view === 'tab' && clipWidth > 0 && <Playhead clip={drawn} width={clipWidth} parts={parts} playback={playback} mark={markAt} markOnly={!showPlayback} layer="under" />}
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
                  {...menuTrigger.props(openBarMenu)}
                >
                  {/* A bar's warning explains itself on hover. */}
                  <HoverTips>
                    <TabClip
                      clip={drawn} width={clipWidth} parts={parts} barNumbers={shown.barNumbers} title={`${name}, drawn as ${parts === 'staff' ? 'a staff' : 'tab'}`}
                      onPick={onPick} onPickRun={onPickRun} onPickStaff={onPickStaff} onDragStaff={onDragStaff} onPickRect={onPickRect}
                      onMiss={() => { setSelection(null); setPlayMark(null); setPicked(null); (document.activeElement as HTMLElement | null)?.blur(); }} onPickText={onPickText} onPickMark={onPickMark}
                      onPickColumn={pickColumn} columnReach={COLUMN_REACH}
                      highlight={{
                        cursor: editing && !picked ? cursor : null, range: selection ? selectedRange(selection) : null, columnOnly,
                        staffPitch: staffCursor, input: inputMode,
                      }}
                      shadow={inputMode ? inputLength.value : null}
                      picked={editing ? picked : null}
                      errors={barErrors(clip)}
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
            {view === 'tab' && clipWidth > 0 && <Playhead clip={drawn} width={clipWidth} parts={parts} playback={playback} mark={markAt} markOnly={!showPlayback} layer="over" />}
            {view === 'tab' && showPlayback && clipWidth > 0 && <LoopHandles clip={drawn} width={clipWidth} parts={parts} playback={playback} />}
            {view === 'tab' && editing && picked && clipWidth > 0 && (
              <WordTools
                clip={drawn} width={clipWidth} parts={parts} hit={picked}
                onEdit={picked.kind === 'mark' ? null : () => editPicked(picked)}
                onDelete={() => deletePicked(picked)}
              />
            )}
            {view === 'tab' && word && clipWidth > 0 && (
              <WordField
                key={`${word.kind}-${word.bar}-${word.column}`} kind={word.kind} {...wordSpot(drawn, clipWidth, parts, word)}
                initial={wordNow(clip, word)} onDone={finishWord}
              />
            )}
            {view === 'tab' && keyBar !== null && keyBar < clip.bars.length && clipWidth > 0 && (
              <BarKeyPanel
                clip={clip} bar={keyBar} {...(panelAt ?? barTimeSpot(drawn, clipWidth, parts, keyBar))}
                onChange={key => commit(setBarKey(clip, keyBar, key))} onClose={closeKeyBar}
              />
            )}
            {view === 'tab' && headPanel?.kind === 'credits' && (
              <CreditsPanel
                clip={headPanel.from} x={headPanel.x} y={headPanel.y} field={headPanel.field}
                onChange={next => dispatch({ type: 'previewPart', part: next })} onDone={kept => finishCredits(headPanel.from, kept)}
              />
            )}
            {view === 'tab' && headPanel?.kind === 'tempo' && (
              <TempoPanel
                clip={headPanel.from} bar={headPanel.bar} x={headPanel.x} y={headPanel.y}
                onChange={next => dispatch({ type: 'previewPart', part: next })} onDone={kept => finishTempo(headPanel.from, kept, headPanel.fromTab)}
              />
            )}
            {view === 'tab' && headPanel?.kind === 'tuning' && (
              <TuningPanel clip={clip} x={headPanel.x} y={headPanel.y} onChange={commit} onClose={() => setHeadPanel(null)} />
            )}
            {view === 'tab' && timeBar !== null && timeBar < clip.bars.length && clipWidth > 0 && (
              <BarTimePanel
                clip={clip} bar={timeBar} {...(panelAt ?? barTimeSpot(drawn, clipWidth, parts, timeBar))}
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

      <p
        className={`m-0 min-h-[1.5em] ${notice?.tone === 'error' ? 'text-(--danger)' : 'text-(--ink-muted)'}`}
        role="status" data-testid="tab-notice"
      >
        {notice ? notice.lines.join(' ') : empty ? 'Click the tab and type frets, or import or paste alphaTex or ASCII tab.' : unevenLine}
      </p>

      <ImportDialog open={importing} onClose={() => setImporting(false)} onImport={importText} />
      <ArrangementsDialog
        open={choosing} library={arrangements.library} openId={state.id} exampleId={example?.id ?? null}
        deleted={arrangements.deleted} onClose={() => setChoosing(false)}
        onOpen={id => replaceShown(() => {
          if (!arrangements.open(id)) setNotice({ tone: 'error', lines: ['That arrangement could not be read.'] });
          clearExampleHash();
        })}
        onNew={() => replaceShown(() => { arrangements.openNew(); clearExampleHash(); })}
        onDuplicate={() => replaceShown(() => arrangements.openNew(whole))}
        onRename={arrangements.rename}
        onMove={arrangements.move}
        // Deleting the open arrangement opens another, or a new clip.
        onDelete={ids => removing(ids, () => arrangements.remove(ids))}
        onCreateFolder={arrangements.createFolder}
        onRenameFolder={arrangements.renameFolder}
        onDeleteFolder={id => removing(
          arrangements.library.items.filter(i => i.folder === id).map(i => i.id), () => arrangements.removeFolder(id),
        )}
        onUndoDelete={arrangements.undoDelete}
        onOpenExample={async builtin => {
          setChoosing(false);
          const error = await showExample(builtin);
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
            // Paste writes over what is there; this puts the clipboard's tab in before the cursor instead (issue #238).
            { label: 'Insert paste', onSelect: () => void navigator.clipboard?.readText().then(text => { if (text) void pasteTab(text, true); }, () => {}) },
          ]}
        />
      )}
      {actions.popups}
      <SettingsDialog groups={settingsGroups} open={settingsOpen} at={TAB_SETTINGS_START} onClose={() => setSettingsOpen(false)} />
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
