'use client';

import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { ShapeMenu } from '@/components/chords/export/ShapeMenu';
import { menuSpot, useMenuTrigger } from '@/components/chords/export/useMenuTrigger';
import { usePreferenceSaveProblem } from '@/hooks/usePersist';
import { GearIcon } from '@/components/icons';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useGeneralGroup } from '@/components/settings/general';
import { KEEPS_SELECTION, useDeselect } from '@/hooks/useDeselect';
import { writeAscii } from './ascii';
import { barErrors, brokenTupletMessage, emptyClip, partOf, stringClashes, titled, trackName, withPart, unevenMessage, UNTITLED, ticks, type Clip, type Part } from './clip';
import { pastesVoices, pasteVoices, sliceVoices, spansVoices, voiceRange, voiceSelections } from './voices';
import { clipAction, type ClipAction, type PartAction } from './clipState';
import { useArrangements } from './useArrangements';
import { clampCursor, columnAt, indexOf, sliceClip, insertBar, insertPaste, isEmpty, noteAt, withRestsInEmptyBars, pasteOver, placeOf, selectedRange, START } from './editing';
import { isBarLine, type BarLineHit } from './barLines';
import { beamLit, canBeamTarget, clearToRests, setBend, setOttava, setWhammy } from './noteEdits';
import { applyTuplet, isProblem } from './tuplets';
import { TupletPanel } from './TupletPanel';
import { cursorSpot } from './fieldSpots';
import { WHAMMY_SHAPES } from './whammy';
import { editorKeyDown, graceKey, restKey, writeAtInput, type EditorKeys } from './editorKeys';
import { layoutClip, PARTS, type Parts } from './layout';
import type { Lines } from './jumps';
import { gridTicks, type GridValue } from './grid';
import { textBox, type TextHit } from './layoutText';
import { writtenStrings } from './notation';
import { dropShowParam, readShowParam } from './shareLink';
import type { Notice } from './notice';
import { pitchAtStep, type TypedAccidental } from './staffEntry';
import { markBox, markTool } from './marks';
import { litTiedNotes, tieOnInput } from './ties';
import { useClipActions } from './ClipActions';
import { SizeField } from './ViewOptions';
import { TabClip, type DoubleClickPlace } from './TabClip';
import { ImportDialog } from './TabDialogs';
import { TabPalette } from './TabPalette';
import { TabRail, useOpenPanel } from './TabRail';
import { ChatPanel } from './chat/ChatPanel';
import { useChatSession } from './chat/useChatSession';
import type { PageSpot } from './chat/arrangementTools';
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
import { ChordChart } from './ChordChart';
import { chartChords, type ChartChord } from './chordDiagrams';

import { laidOut, paletteOf, sectionsOf, shownColours, viewOf, type ColourPair, type TabView } from './viewOptions';
import { TAB_SETTINGS_START, tabSettingsGroup, useTabPrefs } from './tabSettings';
import { VIEWS, type View } from './views';
import { PinnedPlayback } from './PinnedPlayback';
import { LoopHandles, PlaybackFooter, Playhead, type PlaybackSettings } from './PlaybackFooter';
import { useArrangementFile } from './useArrangementFile';
import { useEditorState, type Picked } from './useEditorState';
import { useHeadPanels } from './useHeadPanels';
import { usePageKeys } from './usePageKeys';
import { usePlayRange } from './usePlayRange';
import { useStableHandlers } from './useStableHandlers';
import { useTabPicking } from './useTabPicking';
import { useActiveVoice, useVoicePick } from './useVoicePick';
import { useWidth } from './useWidth';
import { showShortcuts } from '@/components/shortcuts/useShortcuts';
import { isMac } from '@/lib/shortcuts';

/** What a press may land on and keep the selection and the playback line: controls, the drawing and the palette. */
const TAB_KEEPS = `${KEEPS_SELECTION}, .tab-editor svg, .tab-palette, .tab-rail, .tab-rail-panel`;
/** The modifier the file shortcuts take, as the tips name it: ⌘ on a Mac, Ctrl elsewhere. */
const MOD = isMac() ? '⌘' : 'Ctrl+';


/** How far above and below the drawn clip a press still moves the cursor or the playback line, in px: about the card's margin. */
const COLUMN_REACH = 16;
/** The reader's warning of two Voices on one string (`stringClashes`): a paste that has one is refused with its own line (step 9, Q10). */
const CLASH_WARNING = /has two voices on string \d+\.$/;
/**
 * The reader's warning of a bar that doesn't fill its time (`unevenMessage`): a copied run of notes always
 * has one, but a paste writes it through the meter, so the bars it lands in stay full and the line would be wrong.
 */
const UNEVEN_WARNING = /doesn't add up to/;

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
 * tab (`useTabPicking`), the fields and panels over it (`useHeadPanels`), the file actions
 * (`useArrangementFile`), the Active voice (`useVoicePick`), playback and the playback line
 * (`usePlayRange`), and the page-wide keys (`usePageKeys`).
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
  // The Active voice (step 9, `GLOSSARY.md`), from 0.
  const { voice, setVoice } = useActiveVoice(opened, track);
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
  // The View options' Chord diagrams and Chord chart (issue #242).
  const chordDiagrams = notation.chordDiagrams;
  const chartOn = notation.chordChart;
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
  // Where Settings opens: the Tab group's first section, or Tab › Chat from the Chat panel.
  const [settingsAt, setSettingsAt] = useState(TAB_SETTINGS_START);
  const openSettings = (at = TAB_SETTINGS_START) => {
    setSettingsAt(at);
    setSettingsOpen(true);
  };
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
  const layout = useMemo(() => layoutClip(drawn, clipWidth, parts, chordDiagrams), [drawn, clipWidth, parts, chordDiagrams]);
  // The Chord chart under the score head (issue #242): every track's chords with a shape, once.
  const chart = useMemo(() => (chartOn ? chartChords(drawn) : []), [drawn, chartOn]);
  const paperStyle = colours ? paperVars(colours) : undefined;
  /**
   * The AlphaTex view's text as typed, and the clip it was typed against: kept, across changes of
   * view, until an edit elsewhere (on the Standard view, an undo, an import) changes the clip; then the
   * clip is written out again in Frets' own layout, without comments (Jeremy, 2026-10-27).
   */
  const [draft, setDraft] = useState<{ text: string; clip: Clip } | null>(null);
  const alphaTexText = draft && draft.clip === whole ? draft.text : writeAlphaTex(whole);
  // What the text views show and copy.
  const shownText = view === 'ascii' ? writeAscii(clip, { rhythm: shown.asciiRhythm, chords: shown.asciiChords }) : alphaTexText;

  /* — the editor: a cursor on a column and string, and a run of selected columns — */
  const editor = useEditorState({ clip, dispatch, replace: next => dispatchClip({ type: 'replace', clip: next }), setNotice });
  const {
    cursor, setCursor, selection, selectionAsSet, setSelection, tabFocused, setTabFocused, columnOnly, setColumnOnly,
    staffPitch, setStaffPitch, picked, setPicked, noteInputMode, setNoteInputMode, inputLength, setInputLength,
    editorRef, lastDigitRef, commit, startRegion, toPitch, cursorAt, setCursorAt,
    tupletEntry, setTupletEntry, graceEntry, setGraceEntry, tupletFrom, setTupletFrom,
  } = editor;
  /** Where the Tuplet panel `;` opened is, in the tab's units; null while it is shut (step 6, Q16). */
  const [tupletPanel, setTupletPanel] = useState<{ x: number; y: number } | null>(null);
  /** Note input mode's grid (`grid.ts`, issue #293), a Settings › Tab › Editing preference the palette's Grid button and Alt+[ ] change too. */
  const { fixedGrid, grid, gridLook } = prefs.editing;
  /** The grid's step in ticks: the fixed grid's, else note input mode's length (MuseScore's way, the default). */
  const gridStep = fixedGrid ? gridTicks(grid) : ticks(inputLength);
  /** The Grid panel's pick: a fixed grid, or null for Note length. */
  const pickGrid = (next: GridValue | null) => prefs.setEditing(e => (next === null ? { ...e, fixedGrid: false } : { ...e, fixedGrid: true, grid: next }));
  /** Whether the palette shows the cursor's notes: only while the tab has the keys and no word is picked. */
  const lit = tabFocused && !picked;
  /** The palette tool that sets the picked word or mark, lit while it is picked. */
  const pickedTool = !tabFocused || !picked ? null : picked.kind === 'mark' ? markTool(clip, picked) : isBarLine(picked) ? BAR_LINE_TOOL[picked.kind] : picked.kind === 'ending' ? 'ending' : picked.kind === 'time' ? 'barTime' : picked.kind === 'key' ? 'barKey' : WORD_TOOL[picked.kind];
  /** Set while placing the playback line takes the keys from the tab, so the blur doesn't fill the bar again. */
  /**
   * The staff cursor's pitch while it has the keys: never with the tab alone. With the staff alone it is
   * always there but in a selection; after one, on the middle line until a key or press moves it.
   */
  const staffCursor = parts === 'tab' ? null : staffPitch ?? (parts === 'staff' && tabFocused && noteInputMode && !selectionAsSet ? pitchAtStep(clip, cursor.bar, 4) : null);
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
  // The clip's own instrument, or the nearest of Frets' sounds to it (`instrument.ts`).
  const sound = soundFor(clip.instrument?.program);
  // Playback, the playback line, and where Play starts and stops.
  const range = usePlayRange(editor, {
    whole, wholeWith, sound, settings: playbackSettings, metronome, replace: next => dispatchClip({ type: 'replace', clip: next }),
  });
  const { playback, selectedColumns, markAt, playFrom, playUntil, toggleLoop, pickColumn, dropLine } = range;
  /** A note just entered: it sounds, alone, with "Hear notes as you enter them" on and the controls showing. */
  const hearNote = (at: { bar: number; column: number; string: number }) => {
    if (playbackSettings.hearNotes && showPlayback) playback.hear(at.bar, at.column, at.string);
  };

  // The fields and panels over the tab and from the score's head.
  const head = useHeadPanels(editor, { layout, width: clipWidth, zoom, shown: { tab: view === 'tab', drawn: clipWidth > 0 } });
  // Presses and drags on the drawn tab.
  const picking = useTabPicking(editor, {
    drawn, layout, hearNote, setNotice, openWord: head.openWord,
    openSignature: head.openSignature, dropLine,
  });
  const { deletePicked } = picking;
  // The Active voice picked, and the edits that cross Voices.
  const {
    voiceOnly, chooseVoice, pickVoice, moveToVoiceKey, voiceKey, selectOnlyVoice, everyVoice, stepElement, voicePresentAtCursor,
  } = useVoicePick(editor, { whole, track, voice, setVoice, stepToElement: picking.stepToElement });
  // The rail's open panel; a chord name's Edit (and so its double-click) opens Chords at that chord (issue #251).
  const [railPanel, setRailPanel] = useOpenPanel();
  /**
   * The Chat panel (`docs/specs/2026-11-08-tab-chat-design.md`, issue #424). The model's changes go through `chatClip`: a reply's first is an undo step, and its
   * later ones join it, unless the viewer edited in between.
   */
  const wholeNow = useRef(whole);
  useEffect(() => { wholeNow.current = whole; }, [whole]);
  const chatSet = useRef<Clip | null>(null);
  const chatClip = (next: Clip, first: boolean) => {
    dispatchClip({ type: !first && wholeNow.current === chatSet.current ? 'amend' : 'replace', clip: next });
    chatSet.current = next;
    // A second change in the same answer reads this one, before the page draws it.
    wholeNow.current = next;
  };
  const chatSpot = (): PageSpot => ({
    track,
    cursorBar: cursor.bar,
    selectedBars: selection ? [placeOf(clip, selectedRange(selection)[0]).bar, placeOf(clip, selectedRange(selection)[1]).bar] : null,
  });
  // The conversation is the page's, not the panel's, so closing the panel keeps it and its running reply (issue #442).
  const chat = useChatSession({
    prefs: prefs.chat, current: () => ({ clip: wholeNow.current, spot: chatSpot() }), onClip: chatClip, open: railPanel === 'chat',
  });
  const [chordsAt, setChordsAt] = useState<{ name: string | null } | null>(null);
  /** A chord picked in the tab or the Chord chart (each pick a new object): an open Edit chord or Change chord follows it (Jeremy, 2026-11-07). */
  const [chordFollow, setChordFollow] = useState<{ name: string } | null>(null);
  useEffect(() => {
    if (picked?.kind !== 'chord') return;
    const name = columnAt(clip, { ...cursor, ...placeOf(clip, picked.index) })?.chord;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a chord name picked is an outside event for the panel.
    if (name) setChordFollow({ name });
    // Only a new pick counts; the clip changing under it doesn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);
  const openChordsAt = (index: number) => {
    const place = placeOf(clip, index);
    setCursor(c => ({ ...c, ...place }));
    setPicked(null);
    setChordsAt({ name: columnAt(clip, { ...cursor, ...place })?.chord ?? null });
    setRailPanel('chords');
    editorRef.current?.focus();
  };
  /** A Chord chart chord's Edit: its track shown, if another's, and the Chords panel open at it. */
  const editChartChord = (chord: ChartChord) => {
    const others = whole.tracks.map((_, i) => i).filter(i => i !== track);
    const owner = chord.owner === 0 ? track : others[chord.owner - 1];
    if (owner !== track) chooseTrack(owner);
    setPicked(null);
    setChordsAt({ name: chord.name });
    setRailPanel('chords');
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
      setTabFocused(false);
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
    dropLine();
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
  /** Note input mode on or off; going in, the keys come to the tab. */
  /** The rest last picked on the staff, so going into note input mode from it starts the caret there. */
  const restOnStaff = useRef<{ bar: number; column: number } | null>(null);
  /**
   * The part as note input mode edits it: a bar that holds nothing (a new arrangement's) as its Whole-bar
   * rest, put in the clip as the same music, so the caret, the Grid and its stops work there as in any
   * rest (issues #421, #422).
   */
  const withRests = (): Part => {
    const part = withRestsInEmptyBars(clip);
    if (!part) return clip;
    dispatchClip({ type: 'fill', clip: withPart(whole, part, track) });
    return part;
  };
  // A bar emptied in note input mode (every bar deleted, an undo back to a new arrangement) is its rest again.
  useEffect(() => {
    const part = noteInputMode ? withRestsInEmptyBars(clip) : null;
    if (part) dispatchClip({ type: 'fill', clip: withPart(whole, part, track) });
  }, [noteInputMode, clip, whole, track, dispatchClip]);
  const enterNoteInput = (on: boolean) => {
    const part = on ? withRests() : clip;
    // Going in lets any selection or pick go, the cursor at the selection's start, as Dorico's caret and
    // MuseScore's note input mode begin there (Jeremy, 2026-11-06).
    const at = on && selection ? { ...cursor, ...placeOf(part, selectedRange(selection)[0]) } : cursor;
    setNoteInputMode(on);
    setCursorAt(at, 0);
    accidentalRef.current = null;
    if (on) {
      if (selection) {
        setCursor(at);
        setSelection(null);
      }
      setPicked(null);
      setInputLength(startLength(part, at));
      // On a note pressed in normal mode, the caret goes onto it, its string (or its pitch on the staff) picked,
      // so digits retype it, as Dorico's caret starts on the note selected (Jeremy, 2026-11-07, issue #396).
      // Anywhere else on the tab the caret picks the string it was last on, so a fret can be typed at once, as
      // Dorico's tab caret is always on a string (Jeremy, 2026-11-08, issue #396; no string was picked before).
      // With only the staff drawn it takes the column alone, and no staff line or space is picked for you.
      const onNote = !selection && !columnOnly && noteAt(part, cursor) !== null;
      setColumnOnly(!onNote && parts === 'staff');
      if (!onNote) setStaffPitch(null);
      // On a rest picked on the staff, the caret starts on the staff, on its middle line, as Dorico's starts on
      // the staff picked (Jeremy, 2026-11-07, issue #396).
      const rest = restOnStaff.current;
      if (!onNote && parts !== 'tab' && rest && rest.bar === at.bar && rest.column === at.column) toPitch(part, at, pitchAtStep(part, at.bar, 4), null, part !== clip);
      editorRef.current?.focus();
    }
  };

  /**
   * Goes into note input mode with the caret where a double-click landed, as Dorico's double-click starts
   * note input mode there (Jeremy, 2026-11-07, issue #396): on a string, that string picked, on its note or
   * beside the notes; on the staff, at the note's pitch or the line or space; on a rest on the staff, its middle line.
   */
  /** A sign typed on the staff for the next letter in note input mode (Jeremy, 2026-11-07, issue #396). */
  const accidentalRef = useRef<TypedAccidental | null>(null);

  /** Note input mode off, if it is on. */
  const leaveNoteInput = () => {
    if (noteInputMode) enterNoteInput(false);
  };

  const enterNoteInputAt = ({ hit, staff, rest }: DoubleClickPlace) => {
    const part = withRests();
    const on = hit ?? staff ?? rest;
    if (!on || !part.bars[on.bar]?.columns[on.column]) {
      setSelection(null);
      enterNoteInput(true);
      return;
    }
    const at = { bar: on.bar, column: on.column, string: hit?.string ?? staff?.string ?? cursor.string };
    setNoteInputMode(true);
    setSelection(null);
    setPicked(null);
    setCursorAt(at, 0);
    setInputLength(startLength(part, at));
    if (staff) {
      const note = staff.string === null ? null : noteAt(part, at);
      toPitch(part, at, note && note.fret !== null ? writtenStrings(part.tuning)[at.string] + (part.capo ?? 0) + note.fret : pitchAtStep(part, at.bar, staff.step), null, part !== clip);
    } else if (rest && parts !== 'tab') {
      // A rest on the staff: the caret on the staff's middle line, as N on a rest picked there (Jeremy, 2026-11-07).
      toPitch(part, at, pitchAtStep(part, at.bar, 4), null, part !== clip);
    } else {
      setCursor(at);
      setColumnOnly(!hit && parts === 'staff');
      setStaffPitch(null);
    }
    editorRef.current?.focus();
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
    if (!tabFocused) return;
    if (id in WORD_TOOLS) head.openWord(WORD_TOOLS[id as keyof typeof WORD_TOOLS]);
    // The cursor bar's time signature panel, as a press on its drawn numbers opens (the clip's own in the first bar).
    else if (id === 'barTime') head.openSignature('time', cursor.bar, null);
    else if (id === 'barKey') head.openSignature('key', cursor.bar, null);
    else if (id === 'insertBar') addBar('after');
    else if (id === 'insertBarBefore') addBar('before');
    // In note input mode the Duration buttons set the next note's length, as the length keys do.
    else if (noteInputMode && toolValue(id)) setInputLength(lengthOf(toolValue(id)!));
    else if (noteInputMode && id === 'dot') setInputLength(cycleLengthDots(inputLength));
    // `,` and the Rest tool: a Gap of the Input length in note input mode, Delete in normal mode (step 6, Q12–Q13).
    else if (id === 'rest') restKey(editorKeys());
    // `/` and the Grace tool: Grace entry on and off in note input mode, else a grace note before the picked note (Q8, Q11).
    else if (id === 'grace' && noteInputMode) setGraceEntry(!graceEntry);
    else if (id === 'grace') graceKey(editorKeys());
    // A picked tie arc: the Tie tool takes it away, as Delete does (step 5).
    else if (id === 'tie' && picked?.kind === 'mark' && picked.mark === 'tie') deletePicked(picked);
    // In note input mode `=` adds a tied note of the input length after the note at the cursor (step 5).
    else if (noteInputMode && id === 'tie') {
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
   * A tuplet picked in the Tuplet panel (the button's, or `;`'s at the cursor), step 6. In note input mode it turns
   * Tuplet entry on, or off for the same tuplet or None (Q6); in normal mode it goes over the picked note's
   * time, squeezes the selection, or takes the tuplet away (Q1, Q2, Q4), or the line under the clip says why not.
   */
  const pickTuplet = (n: number | null) => {
    if (!tabFocused) return;
    if (noteInputMode) {
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
    if (tabFocused) commitKeepingMark(apply());
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
    clip, cursor, selection, target, columnOnly, picked, staffPitch: staffCursor, staffShown: parts !== 'tab', tabShown: parts !== 'staff', lastDigit: lastDigitRef, accidental: accidentalRef, lines: drawnLines, noteInputMode, setNoteInputMode: enterNoteInput, inputLength, setInputLength, gridStep, cursorAt, setCursorAt, stepElement, moveSpanEnd: picking.moveSpanEnd,
    tupletEntry, graceEntry, tupletFrom, setTupletFrom, openTuplets, voiceKey, everyVoice,
    commit, toPitch, setColumnOnly, setStaffPitch, startRegion, setPicked, deletePicked, editPicked, addBar, onTool, hearNote, onNotice: setNotice,
    dropLine, leave: () => editorRef.current?.blur(),
  });
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => editorKeyDown(e, editorKeys());


  /**
   * A press anywhere off the drawn bars (the score's head, under the tab, the page around it) lets the
   * selection and the playback line go, as MuseScore's does (Jeremy, 2026-11-01, issue #276; any selection,
   * 2026-11-01). Controls, the palette, menus and dialogs keep them, so their tools still work on them. Told
   * by what is pressed, not by where focus goes, as Safari doesn't focus a pressed button. Esc is the
   * editor's own, a step at a time (`editorKeys.ts`).
   */
  useDeselect(selection !== null || markAt !== null, () => {
    setSelection(null);
    dropLine();
  }, { keep: TAB_KEEPS, escape: false });


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
      const done = editor.commitVoices(made.clip, made.part, { ...cursor, ...end }, noteInputMode || !run ? null : { anchor: run[0], focus: run[1] });
      if (done && !noteInputMode && run) startRegion();
      setView('tab');
      return done;
    }
    const pasted = (insert ? insertPaste : pasteOver)(clip, at, partOf(put));
    let done: boolean;
    if (noteInputMode) done = commit(pasted.clip, pasted.cursor, null);
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
    const lines = result.warnings.filter(line => !CLASH_WARNING.test(line) && !UNEVEN_WARNING.test(line));
    if (lines.length > 0) setNotice({ tone: 'info', lines });
  };

  /** Writes the selected columns (or the cursor's) to the clipboard as alphaTex; a cut also makes them rests. */
  const copyOrCut = (e: ClipboardEvent, cut: boolean) => {
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
  };

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

  // The keys that work anywhere on the page, paste, copy, cut, undo, and the tab taking and letting go of the keys.
  const { onEditorFocus, onEditorBlur } = usePageKeys(editor, {
    view, parts, range, showPlayback, setEditingPrefs: prefs.setEditing, enterNoteInput, chooseVoice,
    paste: (text, insert) => void pasteTab(text, insert), copyOrCut,
    undo: redo => dispatchClip({ type: redo ? 'redo' : 'undo' }),
  });

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
  const columnLit = tabFocused && !picked && !noteInputMode && columnOnly && staffCursor == null && columnAt(clip, cursor) !== null;
  // A picked Mark's run of columns is selected for the tools, but drawn as the Mark's tint, not a selection (step 8).
  const shownSelection = picked?.kind === 'mark' ? null : selection;
  const litStart = shownSelection ? selectedRange(shownSelection)[0] : columnLit ? cursorIndex : null;
  const litEnd = shownSelection ? selectedRange(shownSelection)[1] : columnLit ? cursorIndex : null;

  /*
   * What the drawing is handed, the same from one render to the next while it shows the same thing, so
   * a playback step or a change elsewhere on the page doesn't draw it again (`TabClip` is a `memo`).
   */
  const showsCursor = tabFocused && !picked;
  const { bar: cursorBar, column: cursorColumn, string: cursorString } = cursor;
  const boxed = shownSelection !== null;
  // A picked Tie chain lights all its written notes, and a selection the chains it runs on into (step 5).
  const tiedKey = showsCursor && !noteInputMode ? JSON.stringify(litTiedNotes(clip, cursor, selection, columnOnly, editor.alone)) : '[]';
  const highlight = useMemo(() => ({
    cursor: showsCursor ? { bar: cursorBar, column: cursorColumn, string: cursorString } : null,
    range: litStart === null || litEnd === null ? null : [litStart, litEnd] as [number, number],
    boxed, columnOnly, staffPitch: staffCursor, input: noteInputMode, at: cursorAt,
    tied: JSON.parse(tiedKey) as { index: number; string: number }[],
  }), [showsCursor, cursorBar, cursorColumn, cursorString, litStart, litEnd, boxed, columnOnly, staffCursor, noteInputMode, cursorAt, tiedKey]);
  const errors = useMemo(() => barErrors(clip), [clip]);
  // A selection covers every Voice in its time (Q12), drawn selected in each; not one Select only voice made.
  const shownVoiceSelections = useMemo(
    () => (shownSelection && !voiceOnly ? voiceSelections(clip, shownSelection) : undefined),
    [clip, shownSelection, voiceOnly],
  );
  const clipHandlers = useStableHandlers({
    onPick: (...args: Parameters<typeof picking.onPick>) => { restOnStaff.current = null; picking.onPick(...args); },
    onPickStaff: (...args: Parameters<typeof picking.onPickStaff>) => { restOnStaff.current = null; picking.onPickStaff(...args); }, onDragStaff: picking.onDragStaff,
    onDragFret: noteInputMode ? undefined : picking.onDragFret, onDragSpan: picking.onDragSpan, onDragRange: picking.onDragRange, onPickRect: picking.onPickRect,
    // A press that takes the caret away (blank space, the playback line's place above or below the staff, a
    // mark or a word picked) ends note input mode too, so the pencil is never lit without a caret.
    onMiss: () => { leaveNoteInput(); setSelection(null); dropLine(); setPicked(null); (document.activeElement as HTMLElement | null)?.blur(); },
    onPickText: (...args: Parameters<typeof picking.onPickText>) => { leaveNoteInput(); picking.onPickText(...args); },
    onPickMark: (...args: Parameters<typeof picking.onPickMark>) => { leaveNoteInput(); picking.onPickMark(...args); },
    onPickColumn: (...args: Parameters<typeof pickColumn>) => { leaveNoteInput(); pickColumn(...args); }, onPickVoice: pickVoice,
    onPickWarning: head.openFix,
    onPickRhythm: noteInputMode ? undefined : (rest: Parameters<typeof picking.onPickRhythm>[0], extend: boolean) => {
      restOnStaff.current = parts !== 'tab' && !extend ? { bar: rest.bar, column: rest.column } : null;
      picking.onPickRhythm(rest, extend);
    },
    // A double-click on a word or a repeat's count opens its field, as the menu's Edit does (issue #289);
    // one on a mark or a bar line with no Edit leaves it picked. Out of note input mode, one anywhere else
    // on the staff or the tab goes into it (Jeremy, 2026-10-31) with the caret where it landed (2026-11-07).
    onDoubleClick: (word: TextHit | null, onMark: boolean, place: DoubleClickPlace) => {
      if (word && hasEdit(word)) return editPicked(word);
      if (word || onMark || noteInputMode) return;
      enterNoteInputAt(place);
    },
  });

  /** The Rail's Voice row (Q5): that Voice made active at the cursor's time, the keys back on the tab. */
  const pressVoice = (v: number) => {
    if (view !== 'tab') return;
    editorRef.current?.focus();
    chooseVoice(v);
  };
  /** The symbol palette, with only `groups` (all when left out); the pencil first when `input`. */
  const drawPalette = (groups?: readonly string[], className?: string, input = false) => (
    <TabPalette
      // Lit for the cursor's notes; while a word over the tab is picked, only that word's tool (Jeremy, 2026-10-27).
      isOn={id => (pickedTool ? id === pickedTool : lit && (noteInputMode && (toolValue(id) || id === 'dot') ? lengthIsOn(inputLength, id)
        // In note input mode Grace lights while Grace entry is on (step 6, Q11).
        : noteInputMode && id === 'grace' ? graceEntry
        // A beam tool lights for every note it acts on having its override (spec Q8, Q10).
        : id === 'beamBreak' || id === 'beamJoin' ? beamLit(clip, target, id === 'beamBreak' ? 'break' : 'join')
        : isOn(clip, cursor, id, columnOnly)))}
      kinds={noteInputMode && lit ? { ...paletteKinds, tuplet: tupletEntry ? { ...inputLength, tuplet: tupletEntry } : null } : paletteKinds}
      onTool={onTool} onBend={quarters => onPanelChoice(() => setBend(clip, target, quarters))}
      onTuplet={pickTuplet}
      onOttava={o => onPanelChoice(() => setOttava(clip, target, o))}
      onWhammy={shape => onPanelChoice(() => setWhammy(clip, target, shape ? WHAMMY_SHAPES[shape] : null))} disabled={view !== 'tab'}
      noteInputMode={noteInputMode} groups={groups} className={className} onNoteInputMode={input ? () => enterNoteInput(!noteInputMode) : undefined}
      grid={fixedGrid ? grid : null} gridValue={fixedGrid ? grid : inputLength.value} onGrid={pickGrid}
      voices={input ? { active: tabFocused ? voice : null, onVoice: pressVoice, present: v => voicePresentAtCursor(v) } : undefined} />
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
            onClick={() => openSettings()}
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
            key={track} clip={clip} track={whole.tracks[track]} cursor={cursor} tabFocused={tabFocused} at={chordsAt} follow={chordFollow}
            onChange={next => commit(next)}
            inputLength={noteInputMode ? inputLength : null}
            onInsertAtInput={(part, column) => writeAtInput(editorKeys(), part, column)}
            hear={playbackSettings.hearChords}
            onHear={frets => playback.hearShape(frets)}
            onDone={() => editorRef.current?.focus({ preventScroll: true })}
          />
        )}
        chat={
          <ChatPanel
            prefs={prefs.chat} onModel={model => prefs.setChat(c => ({ ...c, model }))} session={chat}
            onOpenSettings={() => openSettings({ group: 'tab', section: 'chat' })}
          />
        }
        chatStatus={chat.status}
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
              <ChordChart chords={chart} width={clipWidth} onEdit={editChartChord} onPick={chord => { if (chord.owner === 0) setChordFollow({ name: chord.name }); }} />
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
                  aria-label={noteInputMode
                    ? 'Tab editor, note input mode: ↑ ↓ pick a string and digits type frets, Shift+digits or on the staff digits set the next note’s length, arrows move, Shift+arrows select; on the staff, Enter adds or removes a note; Esc or N for normal mode; Shift+F10 to insert a bar'
                    : 'Tab editor: a press selects, arrows change the selected note, Shift+arrows select; N for note input mode; Shift+F10 to insert a bar'}
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
                      shadow={noteInputMode ? inputLength.value : null} gridStep={noteInputMode ? gridStep : null} gridLook={gridLook}
                      picked={tabFocused ? picked : null}
                      errors={errors} mutedVoices={tabFocused} voiceSelections={shownVoiceSelections}
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
                {...tupletPanel} current={noteInputMode ? tupletEntry : (cursorKinds.tuplet?.tupletSpan ? null : cursorKinds.tuplet?.tuplet ?? null)}
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
              setTabFocused(false);
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
            ...(!noteInputMode && (selection || (!columnOnly && noteAt(clip, cursor))) ? [{
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
      <SettingsDialog settingsGroups={settingsGroups} open={settingsOpen} at={settingsAt} onClose={() => setSettingsOpen(false)} />
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
