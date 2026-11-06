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
import { barErrors, brokenTupletMessage, emptyClip, partOf, stringClashes, titled, trackName, withPart, unevenMessage, UNTITLED, ticks, type Clip, type Part } from './clip';
import { cursorInVoice, moveToVoice, pastesVoices, pasteVoices, perVoice, selectionInVoice, sliceVoices, spansVoices, stepAcrossVoices, voiceRange, voiceSelections } from './voices';
import type { Hit } from './hitTest';
import { clipAction, type ClipAction, type PartAction } from './clipState';
import { useArrangements } from './useArrangements';
import { clampCursor, columnAt, columnCount, growSelection, indexOf, sliceClip, insertBar, insertPaste, isEmpty, noteAt, pasteOver, placeOf, selectedRange, START, type Cursor, type Selection } from './editing';
import { isBarLine, type BarLineHit } from './barLines';
import { beamLit, canBeamTarget, clearToRests, setBend, setOttava, setWhammy } from './noteEdits';
import { applyTuplet, isProblem } from './tuplets';
import { TupletPanel } from './TupletPanel';
import { cursorSpot } from './fieldSpots';
import { WHAMMY_SHAPES } from './whammy';
import { editorKeyDown, graceKey, popupTakesEscape, lineKeyDown, restKey, writeAtInput, type EditorKeys } from './editorKeys';
import { layoutClip, PARTS, type Parts } from './layout';
import type { Lines } from './jumps';
import { gridTicks, stepGrid, type GridValue } from './grid';
import { textBox, type TextHit } from './layoutText';
import { writtenStrings } from './notation';
import { dropShowParam, readShowParam } from './shareLink';
import type { Notice } from './notice';
import { pitchAtStep } from './staffEntry';
import { markBox, markTool } from './marks';
import { litTiedNotes, tieOnInput } from './ties';
import { useClipActions } from './ClipActions';
import { SizeField } from './ViewOptions';
import { TabClip } from './TabClip';
import { ImportDialog } from './TabDialogs';
import { TabPalette } from './TabPalette';
import { TabRail, useOpenPanel } from './TabRail';
import { ChordPanel, HearChordsToggle } from './ChordPanel';
import { TabExportDialog } from './TabExportDialog';
import { writeAlphaTex, writePart } from './alphatex';
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
import { LoopHandles, PlaybackFooter, Playhead, rollsOf, usePlayback, type PlaybackSettings } from './PlaybackFooter';
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
/** The reader's warning of two Voices on one string (`stringClashes`): a paste that has one is refused with its own line (step 9, Q10). */
const CLASH_WARNING = /has two voices on string \d+\.$/;

/**
 * Whether a picked thing has an Edit (in its menu, and on a double-click, issue #289): a word, the capo, an
 * ending, a repeat's end or count, a time or key signature (its panel, step 8), or a tuplet's number (the
 * Tuplet panel). Other marks, a repeat's start and a double bar have only Delete.
 */
function hasEdit(hit: Picked): boolean {
  if (hit.kind === 'mark') return hit.mark === 'tuplet';
  return !['repeatStart', 'doubleBar'].includes(hit.kind);
}
/** Whether a picked thing's menu has Delete: not bar 1's signatures, which a clip always has. */
function hasDelete(hit: Picked): boolean {
  return !((hit.kind === 'time' || hit.kind === 'key') && hit.bar === 0);
}
/** The tools that act on the Active voice alone, not every Voice of a selection (step 9, Q19): ties, tuplets, grace notes, Beam overrides. */
const ACTIVE_VOICE_ONLY: ReadonlySet<ToolId> = new Set<ToolId>(['tie', 'tuplet', 'grace', 'beamBreak', 'beamJoin']);
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
  /**
   * The Active voice (step 9, `GLOSSARY.md`), from 0: the Voice the cursor types into, picked by Alt+1–4, the
   * Rail's Voice row or a press on its notes; back to Voice 1 when the cursor leaves the tab, or another
   * track or arrangement opens.
   */
  const [voicePick, setVoicePick] = useState({ opened, track: 0, voice: 0 });
  const voice = voicePick.opened === opened && voicePick.track === track ? voicePick.voice : 0;
  // Its edits go back into the whole clip through `dispatch`.
  const clip = useMemo(() => partOf(whole, track, voice), [whole, track, voice]);
  const dispatch = (action: ClipAction | PartAction) => dispatchClip(clipAction(whole, action, track));
  /** The whole clip with an edit of the shown track in it; the same clip for no edit. */
  const wholeWith = (part: Part): Clip => (part === clip ? whole : withPart(whole, part, track));
  const [view, setView] = useState<View>('tab');
  const [notice, setNotice] = useState<Notice | null>(null);
  // The viewer's preferences, a Settings section each (issue #195); the page's controls and Settings change the same ones.
  const prefs = useTabPrefs();
  const { exportStyle, setExportStyle, notation, setNotation } = prefs;
  /**
   * A link's `?show=` (`docs/specs/2026-11-06-tab-show-link-design.md`): the parts for this visit
   * only, never saved. It holds while the saved choice is the one it was opened over; pressing the
   * switch, or Settings saving another Show, ends it.
   */
  const [linkShow, setLinkShow] = useState(() => {
    const show = readShowParam(window.location.search);
    return show && { show, over: notation.show };
  });
  useEffect(dropShowParam, []);
  /** In the Notation view: the staff, the tab or both (Jeremy, 2026-10-27). */
  const parts = linkShow && linkShow.over === notation.show ? linkShow.show : notation.show;
  const setParts = (show: Parts) => {
    setLinkShow(null);
    setNotation(n => ({ ...n, show }));
  };
  // Settings' "Fill short bars with rests" (off by default): the cursor leaving a short bar completes it.
  // The View options: what the drawn clip shows that is the reader's choice (bar numbers), from four sections.
  const shown: TabView = viewOf(notation, prefs.colours, prefs.ascii, prefs.alphatex);
  const setShown = (next: TabView) => {
    // The saved Show, not a link's: View options never save what a link asked for.
    const sections = sectionsOf(next, notation.show);
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
  const editor = useEditorState({ clip, dispatch, replace: next => dispatchClip({ type: 'replace', clip: next }), setNotice });
  const {
    cursor, cursorAsSet, setCursor, selection, selectionAsSet, setSelection, editing, setEditing, columnOnly, setColumnOnly,
    staffPitch, setStaffPitch, picked, setPicked, inputMode, setInputMode, inputLength, setInputLength,
    editorRef, lastDigitRef, commit, startRegion, toPitch, cursorAt, setCursorAt,
    tupletEntry, setTupletEntry, graceEntry, setGraceEntry, tupletFrom, setTupletFrom,
  } = editor;
  /** The selection Select only voice made, which holds one Voice's notes alone while it stays as it was (Q21). */
  const [onlyVoice, setOnlyVoice] = useState<Selection | null>(null);
  const voiceOnly = selection !== null && onlyVoice === editor.selectionAsSet;
  /**
   * Another Voice made active (step 9, Q5, Q8): the cursor moves to the same time in it, and a selection to
   * that Voice's notes at its time, unless `at` says where they go (a press on its note, a move into it).
   */
  const chooseVoice = (next: number, at?: { cursor: Cursor; selection: Selection | null }) => {
    if (next === voice && !at) return;
    const to = partOf(whole, track, next);
    setVoicePick({ opened, track, voice: next });
    setCursor(at ? at.cursor : cursorInVoice(clip, to, cursor));
    setSelection(at ? at.selection : selection ? selectionInVoice(clip, selection, next) : null);
    setPicked(null);
    setCursorAt(cursor, 0);
  };
  /** A press on another Voice's note or rest (Q5): it is picked, and its Voice made active. */
  const pickVoice = (next: number, hit: Hit) => {
    chooseVoice(next, { cursor: { bar: hit.bar, column: hit.column, string: hit.string }, selection: null });
    setColumnOnly(false);
    setStaffPitch(null);
    editorRef.current?.focus();
  };
  /**
   * Alt+1–4 (Q8) or the menu's Move to voice: the picked or selected notes go into Voice `to` (Q11), stay
   * picked or selected there, and it becomes active. False when there is nothing to move.
   */
  const moveToVoiceKey = (to: number): boolean => {
    const moved = moveToVoice(whole, track, clip, { cursor, selection, columnOnly }, to);
    if (!moved) return false;
    const done = editor.commitVoices(moved.clip, moved.part, moved.cursor, selection ? moved.selection : null);
    if (!done) return true;
    setVoicePick({ opened, track, voice: to });
    if (!selection) setColumnOnly(columnOnly);
    return true;
  };
  /** Alt+1–4: with notes picked or selected in normal mode, they move into that Voice; else it becomes active. */
  const voiceKey = (to: number) => {
    const picksNotes = !inputMode && (selection !== null || (!columnOnly && noteAt(clip, cursor) !== null));
    if (picksNotes && moveToVoiceKey(to)) return;
    chooseVoice(to);
  };
  /** Select only voice ›: the selection keeps Voice `only`'s notes, and it becomes active (Q21). */
  const selectOnlyVoice = (only: number) => {
    if (!selection) return;
    const kept = selectionInVoice(clip, selection, only);
    if (!kept) return;
    chooseVoice(only, { cursor: { ...cursor, ...placeOf(partOf(whole, track, only), Math.max(kept.anchor, kept.focus)) }, selection: kept });
    setOnlyVoice(kept);
  };
  /**
   * An edit of a selection run on every Voice it covers, as one undo step (Q19): Delete, cut, the Marks, the
   * length keys. False when the selection holds the Active voice's notes alone, which the edit itself takes.
   */
  const everyVoice = (edit: (part: Part, selection: Selection) => Part): boolean => {
    if (!selection || voiceOnly || !spansVoices(clip, selection)) return false;
    const next = perVoice(whole, track, clip, selection, edit);
    editor.commitVoices(next, partOf(next, track, voice), cursor, selection, true);
    return true;
  };
  /** Alt+← →: the next note or rest by time in whichever Voice comes first (Q13), else the Active voice's next element. */
  const stepElement = (step: 1 | -1) => {
    const across = picked ? null : stepAcrossVoices(clip, cursor, step);
    if (!across) return picking.stepToElement(step);
    const to = partOf(whole, track, across.voice);
    const column = to.bars[across.bar].columns[across.column];
    const string = column.notes.findIndex(Boolean);
    chooseVoice(across.voice, { cursor: { bar: across.bar, column: across.column, string: string >= 0 ? string : cursor.string }, selection: null });
    setColumnOnly(string < 0);
    setStaffPitch(null);
  };
  /** Where the Tuplet panel `;` opened is, in the tab's units; null while it is shut (step 6, Q16). */
  const [tupletPanel, setTupletPanel] = useState<{ x: number; y: number } | null>(null);
  /** Note input's grid (`grid.ts`, issue #293), a Settings › Tab › Editing preference the palette's Grid button and Alt+[ ] change too. */
  const { fixedGrid, grid, gridLook } = prefs.editing;
  /** The grid's step in ticks: the fixed grid's, else note input's length (MuseScore's way, the default). */
  const gridStep = fixedGrid ? gridTicks(grid) : ticks(inputLength);
  /** The Grid panel's pick: a fixed grid, or null for Note length. */
  const pickGrid = (next: GridValue | null) => prefs.setEditing(e => (next === null ? { ...e, fixedGrid: false } : { ...e, fixedGrid: true, grid: next }));
  /** Whether the palette shows the cursor's notes: only while the tab has the keys and no word is picked. */
  const lit = editing && !picked;
  /** The palette tool that sets the picked word or mark, lit while it is picked. */
  const pickedTool = !editing || !picked ? null : picked.kind === 'mark' ? markTool(clip, picked) : isBarLine(picked) ? BAR_LINE_TOOL[picked.kind] : picked.kind === 'ending' ? 'ending' : picked.kind === 'time' ? 'barTime' : picked.kind === 'key' ? 'barKey' : WORD_TOOL[picked.kind];
  /** Set while placing the playback line takes the keys from the tab, so the blur doesn't fill the bar again. */
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
    alone: editor.alone,
  };
  /** What the beam tools act on: the cursor's note or the selection (`setBeam`). */
  const beamTarget = { cursor, selection: target.selection };
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
    rolls: rollsOf(playbackSettings),
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
  const { deletePicked } = picking;
  // The rail's open panel; a chord name's Edit (and so its double-click) opens Chords at that chord (issue #251).
  const [railPanel, setRailPanel] = useOpenPanel();
  const [chordsAt, setChordsAt] = useState<{ name: string | null } | null>(null);
  const openChordsAt = (index: number) => {
    const place = placeOf(clip, index);
    setCursor(c => ({ ...c, ...place }));
    setPicked(null);
    setChordsAt({ name: columnAt(clip, { ...cursor, ...place })?.chord ?? null });
    setRailPanel('chords');
    editorRef.current?.focus();
  };
  /** A picked thing's Edit: a chord name's Chords panel, a word's field, a signature's panel, or for a tuplet's number the Tuplet panel at its notes (step 8). */
  const editPicked = (hit: Picked) => {
    if (hit.kind === 'mark') return openTuplets();
    if (hit.kind === 'chord') return openChordsAt(hit.index);
    return picking.editPicked(hit);
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
      chooseVoice(0);
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
  // Else Play starts at the selection, else the loop points' start (Loop lets the selection go once it
  // takes it), else the cursor; with no cursor on the tab, from the beginning. A line past the clip's
  // end plays its last column.
  const loopStart = Array.isArray(playback.loop) ? playback.loop[0] : null;
  const playFrom = markAt !== null ? Math.min(markAt, count - 1)
    : selectedColumns ? selectedColumns[0]
    : loopStart !== null ? loopStart
    : editing ? indexOf(clip, cursor.bar, cursor.column) : 0;
  // "Stop playback at region end" (Jeremy, 2026-10-28): with a region selected, Play stops after its
  // last column, unless it starts past it. A loop still goes round instead.
  const playUntil = playbackSettings.stopAtRegionEnd && selectedColumns && playFrom <= selectedColumns[1] ? selectedColumns[1] : null;
  /**
   * Loop, the button or L: the loop points go round the selection, which then goes (Jeremy, 2026-11-05),
   * else round the whole clip; or they go. The tab lets the keys go too, as when the playhead moves, so
   * nothing stays lit; Space then plays from the loop's start.
   */
  const toggleLoop = () => {
    const next = playback.toggleLoop(selectedColumns);
    if (!Array.isArray(next)) return;
    setSelection(null);
    if (editing) editorRef.current?.blur();
  };
  /**
   * A press above or below the staff: the playback line goes there (while playing, playback jumps
   * there), and any selection goes. With Shift, the columns from the line (else the selection's
   * anchor, else the cursor) to there are selected, with no string picked (Jeremy, 2026-10-27).
   */
  const pickColumn = (gap: number, extend: boolean) => {
    if (extend) {
      // From the line, the columns between it and the gap pressed (Jeremy, 2026-10-28: one column, not two);
      // from a selection or the cursor, grown to the column beside the gap (issue #366): the one before it when the gap is after.
      if (markAt !== null) {
        if (gap !== markAt) setSelection(gap > markAt ? { anchor: markAt, focus: gap - 1 } : { anchor: markAt - 1, focus: gap });
        return;
      }
      const from = selection ?? (editing && columnAt(clip, cursor) ? { anchor: indexOf(clip, cursor.bar, cursor.column), focus: indexOf(clip, cursor.bar, cursor.column) } : null);
      if (from !== null) {
        const end = selectedRange(from)[1];
        setSelection(growSelection(from, from.anchor, gap > end ? gap - 1 : gap));
        startRegion();
        return;
      }
    }
    const index = Math.min(gap, count);
    // Moving the playhead lets the selection go, while playing too (Jeremy, 2026-10-27); loop points stay.
    setSelection(null);
    // ...and the tab's cursor: the tab lets the keys go, as after a press beside the bars (Jeremy, 2026-10-28).
    if (editing) editorRef.current?.blur();
    if (playback.seek(index)) return;
    setPlayMark({ index, clip: whole, cursor: cursorAsSet, selection: null });
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
    // Going in lets any selection or pick go, the cursor at the selection's start, as Dorico's caret and
    // MuseScore's note input begin there (Jeremy, 2026-11-06).
    const at = on && selection ? { ...cursor, ...placeOf(clip, selectedRange(selection)[0]) } : cursor;
    setInputMode(on);
    setCursorAt(at, 0);
    if (on) {
      if (selection) {
        setCursor(at);
        setSelection(null);
      }
      setPicked(null);
      setInputLength(startLength(clip, at));
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
    // Alt+[ and Alt+] make note input's grid finer and coarser, as Dorico's do (issue #293), turning the fixed grid on
    // at what it was first; Alt+G switches between the fixed grid and note input's length. On the tab or off it.
    const gridKey = e.code === 'BracketLeft' ? -1 : e.code === 'BracketRight' ? 1 : e.code === 'KeyG' ? 'toggle' : 0;
    if (gridKey && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !(e.target as Element | null)?.closest?.(`${TEXT_FIELDS}, [role="dialog"], [role="menu"]`)) {
      e.preventDefault();
      if (gridKey === 'toggle') prefs.setEditing(p => ({ ...p, fixedGrid: !p.fixedGrid }));
      else prefs.setEditing(p => ({ ...p, fixedGrid: true, grid: p.fixedGrid ? stepGrid(p.grid, gridKey) : p.grid }));
      return;
    }
    // Esc anywhere on the page leaves note input (Jeremy, 2026-11-03): after a press off the tab, on the rail or a
    // control too. An open panel, menu or dialog takes it first, as in Dorico and MuseScore; the next Esc leaves.
    if (e.key === 'Escape' && inputMode && !(e.target as Element | null)?.closest?.('.tab-editor') && !popupTakesEscape(e)) {
      e.preventDefault();
      enterInput(false);
      return;
    }
    // L anywhere on the page does what the Loop button does, while the footer shows (Jeremy, 2026-11-04), as
    // the Space key plays; Let ring, which had L, is on I, Guitar Pro 8's key for it.
    if (e.key === 'l' && plain && showPlayback && !(e.target as Element | null)?.closest?.(`${TEXT_FIELDS}, [role="dialog"], [role="menu"]`)) {
      e.preventDefault();
      if (!e.repeat) toggleLoop();
      return;
    }
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
    // `,` and the Rest tool: a Gap of the Input length in note input, Delete in normal mode (step 6, Q12–Q13).
    else if (id === 'rest') restKey(editorKeys());
    // `/` and the Grace tool: Grace entry on and off in note input, else a grace note before the picked note (Q8, Q11).
    else if (id === 'grace' && inputMode) setGraceEntry(!graceEntry);
    else if (id === 'grace') graceKey(editorKeys());
    // A picked tie arc: the Tie tool takes it away, as Delete does (step 5).
    else if (id === 'tie' && picked?.kind === 'mark' && picked.mark === 'tie') deletePicked(picked);
    // In note input `=` adds a tied note of the input length after the note at the cursor (step 5).
    else if (inputMode && id === 'tie') {
      const tied = tieOnInput(clip, cursor, inputLength);
      if (tied) commit(tied, cursor);
    }
    // A dead note goes on one string; with none picked there is nothing to mark.
    else if (!(columnOnly && id === 'dead')) {
      // On a selection, a Mark goes on every Voice's notes in its time (Q19).
      if (!picked && !ACTIVE_VOICE_ONLY.has(id) && everyVoice((part, run) => applyTool(part, { ...target, selection: run }, id))) return;
      commitKeepingMark(applyTool(clip, target, id));
    }
  };

  /** A palette change; a picked mark changed by it (vibrato to wide, a bend's amount) stays picked while it is there. */
  const commitKeepingMark = (next: Part) => {
    commit(next);
    if (picked?.kind === 'mark' && markTool(next, picked)) setPicked(picked);
  };

  /**
   * A tuplet picked in the Tuplet panel (the button's, or `;`'s at the cursor), step 6. In note input it turns
   * Tuplet entry on, or off for the same tuplet or None (Q6); in normal mode it goes over the picked note's
   * time, squeezes the selection, or takes the tuplet away (Q1, Q2, Q4), or the line under the clip says why not.
   */
  const pickTuplet = (n: number | null) => {
    if (!editing) return;
    if (inputMode) {
      setTupletEntry(n === null || n === tupletEntry ? null : n);
      setTupletFrom(null);
      return;
    }
    const next = applyTuplet(clip, target, n);
    if (isProblem(next)) setNotice({ tone: 'error', lines: [next.problem] });
    else commit(next);
  };
  /** `;`: the Tuplet panel just under the cursor's column. */
  const openTuplets = () => {
    if (view === 'tab') setTupletPanel(cursorSpot(layout, cursor));
  };
  const closeTuplets = (byKey: boolean) => {
    setTupletPanel(null);
    if (byKey) editorRef.current?.focus();
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

  /** The editor as the keys (and the Rest and Grace tools) find it. */
  const editorKeys = (): EditorKeys => ({
    clip, cursor, selection, target, columnOnly, picked, staffPitch: staffCursor, staffShown: parts !== 'tab', lastDigit: lastDigitRef, lines: drawnLines, inputMode, setInputMode: enterInput, inputLength, setInputLength, gridStep, cursorAt, setCursorAt, stepElement, moveSpanEnd: picking.moveSpanEnd,
    tupletEntry, graceEntry, tupletFrom, setTupletFrom, openTuplets, voiceKey, everyVoice,
    commit, toPitch, setColumnOnly, startRegion, setPicked, deletePicked, editPicked, addBar, onTool, hearNote, onNotice: setNotice,
    dropLine: () => setPlayMark(null), leave: () => editorRef.current?.blur(),
  });
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => editorKeyDown(e, editorKeys());

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
    // So does the Tuplet panel `;` opens (step 6).
    if (e.relatedTarget instanceof Element && e.relatedTarget.closest('.tab-tuplet-panel')) return;
    setEditing(false);
    setPicked(null);
    setColumnOnly(false);
    // Leaving the tab puts the Active voice back to Voice 1 (step 9, Q7).
    chooseVoice(0);
  };

  /**
   * Puts a clip in at the cursor, or at the selection's start: over the time there, as MuseScore pastes
   * (issue #238: bars stay full), or with `insert` in before it, as Insert paste and Arrangements…'s Insert do.
   */
  const putAtCursor = (put: Clip, insert: boolean) => {
    const at = selection ? { ...cursor, ...placeOf(clip, selectedRange(selection)[0]) } : cursor;
    // Several Voices: each goes into its own Voice, from the cursor's time (step 9, Q20).
    if (pastesVoices(put)) {
      const made = pasteVoices(whole, track, clip, at, put, insert);
      const run = voiceRange(made.part, voice, [made.from, made.to]);
      const end = run ? placeOf(made.part, run[1]) : at;
      const done = editor.commitVoices(made.clip, made.part, { ...cursor, ...end }, inputMode || !run ? null : { anchor: run[0], focus: run[1] });
      if (done && !inputMode && run) startRegion();
      setView('tab');
      return done;
    }
    const pasted = (insert ? insertPaste : pasteOver)(clip, at, partOf(put));
    let done: boolean;
    if (inputMode) done = commit(pasted.clip, pasted.cursor, null);
    else {
      // In normal mode what was put in is selected, as MuseScore leaves a paste (Jeremy, 2026-10-31).
      const start = isEmpty(clip) ? 0 : indexOf(clip, at.bar, clip.bars[at.bar].columns.length === 0 ? 0 : at.column);
      done = commit(pasted.clip, pasted.cursor, { anchor: start, focus: indexOf(pasted.clip, pasted.cursor.bar, pasted.cursor.column) });
      if (done) startRegion();
    }
    setView('tab');
    return done;
  };

  /** Puts pasted tab over the time from the cursor (or in before it, `insert`), or says why it can't. */
  const pasteTab = async (text: string, insert = false) => {
    const result = await readTab(text);
    if (!result.ok) {
      setNotice({ tone: 'error', lines: result.errors });
      return;
    }
    // A paste that would sound one string in two Voices is refused, and says so itself (step 9, Q10).
    if (!putAtCursor(result.clip, insert)) return;
    const lines = result.warnings.filter(line => !CLASH_WARNING.test(line));
    if (lines.length > 0) setNotice({ tone: 'info', lines });
  };
  const pasteText = useEffectEvent((text: string, insert: boolean) => pasteTab(text, insert));

  /** Writes the selected columns (or the cursor's) to the clipboard as alphaTex; a cut also makes them rests. */
  const copyOrCut = useEffectEvent((e: ClipboardEvent, cut: boolean) => {
    const range = copiedRange();
    if (!range || !e.clipboardData) return;
    e.preventDefault();
    // Every Voice of the selection, written with \voice when there are several (step 9, Q20).
    // A picked note, or a selection of one Voice, is copied by itself.
    e.clipboardData.setData('text/plain', writePart(selection && !voiceOnly ? sliceVoices(clip, range) : sliceClip(clip, range)));
    if (!cut) return;
    // Bars stay full (issue #238): a cut leaves rests, as MuseScore's does; Ctrl/⌘+Delete takes the time away.
    // The rests stay selected, so nothing else is left lit (Jeremy, 2026-10-31).
    if (everyVoice((part, run) => clearToRests(part, run).clip)) {
      startRegion();
      return;
    }
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
  // So are Voices the page doesn't draw yet, and two Voices on one string (`docs/specs/2026-11-03-tab-voices-design.md`).
  const unevenLine = [unevenMessage(clip), brokenTupletMessage(clip), ...stringClashes(clip)].filter(Boolean).join(' ');

  // In normal mode a column with no note picked is lit as a selection is, never boxed: arrowing onto a rest,
  // as MuseScore does, lights the rest (Jeremy, 2026-10-31: the box came back after Delete and the arrows).
  const columnLit = editing && !picked && !inputMode && columnOnly && staffCursor == null && columnAt(clip, cursor) !== null;
  // A picked Mark's run of columns is selected for the tools, but drawn as the Mark's tint, not a selection (step 8).
  const shownSelection = picked?.kind === 'mark' ? null : selection;
  const litStart = shownSelection ? selectedRange(shownSelection)[0] : columnLit ? cursorIndex : null;
  const litEnd = shownSelection ? selectedRange(shownSelection)[1] : columnLit ? cursorIndex : null;

  /*
   * What the drawing is handed, the same from one render to the next while it shows the same thing, so
   * a playback step or a change elsewhere on the page doesn't draw it again (`TabClip` is a `memo`).
   */
  const showsCursor = editing && !picked;
  const { bar: cursorBar, column: cursorColumn, string: cursorString } = cursor;
  const boxed = shownSelection !== null;
  // A picked Tie chain lights all its written notes, and a selection the chains it runs on into (step 5).
  const tiedKey = showsCursor && !inputMode ? JSON.stringify(litTiedNotes(clip, cursor, selection, columnOnly, editor.alone)) : '[]';
  const highlight = useMemo(() => ({
    cursor: showsCursor ? { bar: cursorBar, column: cursorColumn, string: cursorString } : null,
    range: litStart === null || litEnd === null ? null : [litStart, litEnd] as [number, number],
    boxed, columnOnly, staffPitch: staffCursor, input: inputMode, at: cursorAt,
    tied: JSON.parse(tiedKey) as { index: number; string: number }[],
  }), [showsCursor, cursorBar, cursorColumn, cursorString, litStart, litEnd, boxed, columnOnly, staffCursor, inputMode, cursorAt, tiedKey]);
  const errors = useMemo(() => barErrors(clip), [clip]);
  // A selection covers every Voice in its time (Q12), drawn selected in each; not one Select only voice made.
  const shownVoiceSelections = useMemo(
    () => (shownSelection && !voiceOnly ? voiceSelections(clip, shownSelection) : undefined),
    [clip, shownSelection, voiceOnly],
  );
  const clipHandlers = useStableHandlers({
    onPick: picking.onPick, onPickStaff: picking.onPickStaff, onDragStaff: picking.onDragStaff,
    onDragFret: inputMode ? undefined : picking.onDragFret, onDragSpan: picking.onDragSpan, onDragRange: picking.onDragRange, onPickRect: picking.onPickRect,
    onMiss: () => { setSelection(null); setPlayMark(null); setPicked(null); (document.activeElement as HTMLElement | null)?.blur(); },
    onPickText: picking.onPickText, onPickMark: picking.onPickMark, onPickColumn: pickColumn, onPickVoice: pickVoice,
    onPickWarning: head.openFix,
    onPickRhythm: inputMode ? undefined : picking.onPickRhythm,
    // In note input the pointer moves the caret (issue #396).
    onHover: inputMode ? picking.onHover : undefined,
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

  /** The Rail's Voice row (Q5): that Voice made active at the cursor's time, the keys back on the tab. */
  const pressVoice = (v: number) => {
    if (view !== 'tab') return;
    editorRef.current?.focus();
    chooseVoice(v);
  };
  /** Whether Voice `v` has notes in the cursor's bar, for its button's tip (Q17). */
  const voicePresentAtCursor = (v: number) => v === voice ? clip.bars[cursor.bar]?.columns.some(c => c.notes.some(Boolean)) ?? false
    : v === 0 || (clip.bars[cursor.bar]?.otherVoices?.some(o => o.voice === v) ?? false);
  /** The symbol palette, with only `groups` (all when left out); the pencil first when `input`. */
  const drawPalette = (groups?: readonly string[], className?: string, input = false) => (
    <TabPalette
      // Lit for the cursor's notes; while a word over the tab is picked, only that word's tool (Jeremy, 2026-10-27).
      isOn={id => (pickedTool ? id === pickedTool : lit && (inputMode && (toolValue(id) || id === 'dot') ? lengthIsOn(inputLength, id)
        // In note input Grace lights while Grace entry is on (step 6, Q11).
        : inputMode && id === 'grace' ? graceEntry
        // A beam tool lights for every note it acts on having its override (spec Q8, Q10).
        : id === 'beamBreak' || id === 'beamJoin' ? beamLit(clip, target, id === 'beamBreak' ? 'break' : 'join')
        : isOn(clip, cursor, id, columnOnly)))}
      kinds={inputMode && lit ? { ...paletteKinds, tuplet: tupletEntry ? { ...inputLength, tuplet: tupletEntry } : null } : paletteKinds}
      onTool={onTool} onBend={quarters => onPanelChoice(() => setBend(clip, target, quarters))}
      onTuplet={pickTuplet}
      onOttava={o => onPanelChoice(() => setOttava(clip, target, o))}
      onWhammy={shape => onPanelChoice(() => setWhammy(clip, target, shape ? WHAMMY_SHAPES[shape] : null))} disabled={view !== 'tab'}
      inputMode={inputMode} groups={groups} className={className} onInputMode={input ? () => enterInput(!inputMode) : undefined}
      grid={fixedGrid ? grid : null} gridValue={fixedGrid ? grid : inputLength.value} onGrid={pickGrid}
      voices={input ? { active: editing ? voice : null, onVoice: pressVoice, present: v => voicePresentAtCursor(v) } : undefined} />
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
      <TabRail
        palette={drawPalette} open={railPanel}
        onOpen={id => { setRailPanel(id); setChordsAt(null); }}
        chords={(
          <ChordPanel
            key={track} clip={clip} track={whole.tracks[track]} cursor={cursor} editing={editing} at={chordsAt}
            onChange={next => commit(next)}
            inputLength={inputMode ? inputLength : null}
            onInsertAtInput={(part, column) => writeAtInput(editorKeys(), part, column)}
            hear={playbackSettings.hearChords}
            onHear={frets => playback.hearShape(frets)}
            onDone={() => editorRef.current?.focus({ preventScroll: true })}
          />
        )}
        chordsHead={<HearChordsToggle hear={playbackSettings.hearChords} onHearChange={hearChords => setPlaybackSettings(s => ({ ...s, hearChords }))} />}
      >
      <section className="card tab-card" aria-label="Clip">
        {/* Over the clip: Staff | Tab | Both and Size at the top left (Notation only, issue #277); the view switch, then copy and save, at the top right (Jeremy, 2026-10-27). */}
        <div className="tab-card-bar">
          <div className="tab-card-start">
            {view === 'tab' && (
              <div className="seg tab-parts" role="group" aria-label="Show">
                {PARTS.map(p => (
                  // A press keeps the focus where it is, as the palette's do: the editor stays in use, its cursor and Grid with it (issue #396).
                  <button key={p} type="button" className="seg-opt" aria-pressed={parts === p} onMouseDown={e => e.preventDefault()} onClick={() => setParts(p)}>
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
                      shadow={inputMode ? inputLength.value : null} gridStep={inputMode ? gridStep : null} gridLook={gridLook}
                      picked={editing ? picked : null}
                      errors={errors} mutedVoices={editing} voiceSelections={shownVoiceSelections}
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
            {view === 'tab' && tupletPanel && (
              <TupletPanel
                {...tupletPanel} current={inputMode ? tupletEntry : (cursorKinds.tuplet?.tupletSpan ? null : cursorKinds.tuplet?.tuplet ?? null)}
                onPick={n => { closeTuplets(true); pickTuplet(n); }} onClose={closeTuplets}
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
            clip={clip} playback={playback} from={playFrom} until={playUntil} selection={selectedColumns} onLoop={toggleLoop}
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
              chooseVoice(0);
            }
            setMenu(null);
          }}
          items={menu.hit ? [
            // A picked word or repeat's count: Edit, then Delete; a mark, a repeat's start or a double bar: Delete; bar 1's signatures: Edit.
            ...(hasEdit(menu.hit) ? [{ label: 'Edit', onSelect: () => editPicked(menu.hit!) }] : []),
            ...(hasDelete(menu.hit) ? [{ label: 'Delete', onSelect: () => deletePicked(menu.hit!) }] : []),
          ] : [
            // Picked or selected notes: into another Voice (Q11); a selection over several Voices: one of them alone (Q21).
            ...(!inputMode && (selection || (!columnOnly && noteAt(clip, cursor))) ? [{
              label: 'Move to voice', onSelect: () => {},
              items: [0, 1, 2, 3].filter(v => v !== voice).map(v => ({ label: `Voice ${v + 1}`, onSelect: () => { moveToVoiceKey(v); } })),
            }] : []),
            ...(selection && !voiceOnly && spansVoices(clip, selection) ? [{
              label: 'Select only voice', onSelect: () => {},
              items: [voice, ...voiceSelections(clip, selection).keys()].sort((a, b) => a - b).map(v => ({ label: `Voice ${v + 1}`, onSelect: () => selectOnlyVoice(v) })),
            }] : []),
            // The bar under a right-click already has the cursor: the press put it there.
            { label: 'Insert bar before', onSelect: () => addBar('before') },
            { label: 'Insert bar after', onSelect: () => addBar('after') },
            // Paste writes over what is there; this puts the clipboard's tab in before the cursor instead (issue #238).
            { label: 'Insert paste', onSelect: () => void navigator.clipboard?.readText().then(text => { if (text) void pasteTab(text, true); }, () => {}) },
            // On notes that can take a Beam override, the two beam tools, ticked as set (spec Q9).
            ...(canBeamTarget(clip, beamTarget, 'break') ? [{ label: 'Break beam before', checked: beamLit(clip, beamTarget, 'break'), onSelect: () => onTool('beamBreak') }] : []),
            ...(canBeamTarget(clip, beamTarget, 'join') ? [{ label: 'Join beam to previous', checked: beamLit(clip, beamTarget, 'join'), onSelect: () => onTool('beamJoin') }] : []),
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
