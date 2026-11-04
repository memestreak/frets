import { useRef } from 'react';
import type { Part } from './clip';
import { removeBarLine, setBeatText, setCapo, setChordName, setEnding, setSection, setTempo } from './barEdits';
import { isBarLine } from './barLines';
import { columnAt, indexOf, noteAt, placeOf, runAround, selectedRange, setFret, type Cursor, type Selection } from './editing';
import { elementsOf, stepElement } from './elements';
import { chainStart, isChained } from './ties';
import { PANEL_DROP, PANEL_LEAD } from './fieldSpots';
import { splitRestAt } from './grid';
import type { FretDrag, Hit, StaffDrag, StaffHit } from './hitTest';
import { isWholeBarRest, type Layout } from './layout';
import type { TextHit, WordHit } from './layoutText';
import type { MarkHit } from './marks';
import { removeMark } from './noteEdits';
import { pitchAt } from './normalMode';
import { writtenStrings } from './notation';
import { RUN_MARKS, type RunMark } from './runs';
import { movedPitch, moveNotes, notesToMove, noteToString, pitchAtStep, pitchOf, stringAtPitch, toggleStaffNote } from './staffEntry';
import type { FieldKind } from './WordField';
import type { EditorState, Picked } from './useEditorState';
import type { Notice } from './notice';

/** Every column of a bar, selected. */
const barSelection = (of: Part, bar: number): Selection => ({ anchor: indexOf(of, bar, 0), focus: indexOf(of, bar, of.bars[bar].columns.length - 1) });

/**
 * What a press, a drag or Alt+← → on the drawn tab does: where the cursor goes, what is selected or
 * picked, and the notes a press enters in note input or a drag moves. Each is handed to `TabClip`
 * (or the keys); the page wires them up.
 */
export function useTabPicking(editor: EditorState, { drawn, layout, hearNote, setNotice, openWord, openSignature, dropLine }: {
  /** The shown track as drawn, and its layout. */
  drawn: Part;
  layout: Layout;
  /** A note just entered or moved sounds, with "Hear notes" on. */
  hearNote: (at: Cursor) => void;
  setNotice: (notice: Notice | null) => void;
  /** Opens a word's field, as Edit does (`useHeadPanels`). */
  openWord: (kind: FieldKind | 'tempo', at: Cursor) => void;
  /** Opens a bar's time or key signature panel under a press. */
  openSignature: (kind: 'time' | 'key', bar: number, at: { x: number; y: number }) => void;
  /** Takes the playback line away. */
  dropLine: () => void;
}) {
  const {
    clip, dispatch, cursor, selection, columnOnly, staffPitch, picked, inputMode, inputLength,
    setCursor, setSelection, setColumnOnly, setStaffPitch, setPicked, setAlone, editorRef, lastDigitRef, commit, startRegion, toPitch,
  } = editor;

  /**
   * Where a press on a note puts the cursor (`docs/specs/2026-11-04-tab-ties-forward-design.md`): on a Tie
   * chain's first note, the chain being one note, or with Alt (`alone`) on the Tied note pressed, picked by itself.
   */
  const notePlace = (at: Cursor, alone: boolean): Cursor => (alone ? at : chainStart(clip, at));
  /** After the commit that put the cursor there: a Tied note picked by itself stays so. */
  const markAlone = (at: Cursor, alone: boolean) => {
    if (alone && isChained(clip, at)) setAlone(true);
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
      openSignature(hit.kind, hit.bar, { x: press.x - PANEL_LEAD, y: press.y + PANEL_DROP });
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
    lastDigitRef.current = null;
    // A hairpin's run isn't selected: no palette tool works on it, so it lights alone (issue #276).
    const run = hit.to !== undefined && hit.to !== hit.index && hit.mark !== 'hairpin';
    commit(clip, at, run ? { anchor: hit.index, focus: hit.to! } : null);
    setColumnOnly(hit.string === null);
    setPicked(hit);
    editorRef.current?.focus();
  };

  /** Opens the picked word's field, or a repeat's count's; a repeat's start and a double bar have none. */
  const editPicked = (hit: WordHit) => {
    if (hit.kind === 'repeatStart' || hit.kind === 'doubleBar') return;
    const at = wordPlace(hit);
    commit(clip, at, null);
    openWord(hit.kind === 'repeatEnd' || hit.kind === 'repeatCount' ? 'repeat' : hit.kind, at);
  };

  /**
   * Takes a picked word or mark away. Nothing is left selected and no cursor shows (Jeremy, 2026-10-27):
   * the tab lets the keys go, as after a press on blank space.
   */
  const deletePicked = (hit: Picked) => {
    if (hit.kind === 'mark') commit(removeMark(clip, hit), cursor, null);
    else if (isBarLine(hit)) commit(removeBarLine(clip, hit), wordPlace(hit), null);
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

  /** A Shift+drag's rectangle (issue #238): the columns it took in are selected, as Shift+arrows select them. */
  const onPickRect = (from: number, to: number) => {
    lastDigitRef.current = null;
    setPicked(null);
    dropLine();
    commit(clip, { ...cursor, ...placeOf(clip, to) }, { anchor: from, focus: to });
    startRegion();
    editorRef.current?.focus();
  };

  /** Alt+← → (issue #238): the next or last thing a press can pick, picked as a press would. */
  const stepToElement = (step: 1 | -1) => {
    const list = elementsOf(drawn, layout);
    const index = indexOf(clip, cursor.bar, cursor.column);
    const note = !columnOnly && noteAt(clip, cursor);
    const current = picked ? picked
      : note ? { kind: 'note' as const, index, string: cursor.string } : { kind: 'column' as const, index };
    const next = stepElement(list, current, step);
    if (!next) return;
    if (next.kind === 'mark') return onPickMark(next);
    const at = { ...cursor, ...('index' in next ? placeOf(clip, next.index) : { bar: next.bar, column: 0 }) };
    lastDigitRef.current = null;
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

  /** A press on the tab: the cursor there, a note entered (note input) or a bar selected (normal mode); with Shift, the selection grows. */
  const onPick = ({ at: into = 0, ...hit }: Hit, extend: boolean, alone = false) => {
    lastDigitRef.current = null;
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
      const there = hasColumn && noteAt(clip, hit);
      if (inputMode && hasColumn && !there) {
        // In note input a press on a string enters an open string there, as MuseScore's does; digits then change it.
        // Inside a rest it goes at the grid line pressed (issue #293).
        const here = splitRestAt(clip, hit, into);
        commit(setFret(here.clip, here.cursor, 0, inputLength), here.cursor, null);
        hearNote(here.cursor);
      } else if (!inputMode && !there && hasColumn) {
        // In normal mode a press beside the notes selects the bar, as MuseScore's does (Jeremy, 2026-10-31, issue #238).
        commit(clip, hit, barSelection(clip, hit.bar));
        startRegion();
      } else if (there) {
        commit(clip, notePlace(hit, alone), null);
        markAlone(hit, alone);
      } else {
        commit(clip, hit, null);
        if (!inputMode) setColumnOnly(true);
      }
    }
  };

  /**
   * A press on a rest in normal mode (issue #276), or on a note's stem under the tab alone (issue #290): its
   * column alone is selected, as MuseScore selects one, not its bar; with Shift the selection grows to it.
   */
  const onPickRhythm = (at: { bar: number; column: number }, extend: boolean) => {
    const hit = { ...at, string: cursor.string };
    if (extend) {
      onPick(hit, true);
      return;
    }
    lastDigitRef.current = null;
    // A Whole-bar rest storing more than one rest (5/8 `rq. rq`) is picked as one: all its rests selected.
    const rests = isWholeBarRest(clip, at.bar) ? clip.bars[at.bar].columns.length : 1;
    const whole = rests > 1 ? { anchor: indexOf(clip, at.bar, 0), focus: indexOf(clip, at.bar, rests - 1) } : null;
    commit(clip, whole ? { ...hit, column: 0 } : hit, whole);
    setStaffPitch(null);
    setColumnOnly(true);
  };

  /** A press on the staff: the staff cursor there, on the head pressed or the line or space. */
  const onPickStaff = (hit: StaffHit, extend: boolean, alone = false) => {
    lastDigitRef.current = null;
    // A head pressed doesn't take the focus until now (issue #337); taken first, so the focus's own
    // staff cursor (with the staff alone) gives way to the one set below.
    editorRef.current?.focus();
    const at = { bar: hit.bar, column: hit.column, string: hit.string ?? cursor.string };
    const note = hit.string === null ? null : noteAt(clip, at);
    const pitch = note && note.fret !== null ? writtenStrings(clip.tuning)[hit.string!] + (clip.capo ?? 0) + note.fret : pitchAtStep(clip, hit.bar, hit.step);
    if (extend && clip.bars[hit.bar].columns.length > 0 && columnAt(clip, cursor)) {
      const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
      commit(clip, at, { anchor, focus: indexOf(clip, hit.bar, hit.column) });
      startRegion();
      return;
    }
    if (note) {
      toPitch(clip, notePlace(at, alone), pitch);
      markAlone(at, alone);
    } else if (inputMode && clip.bars[hit.bar].columns.length > 0) {
      // In note input a press on a line or space enters the shadow note's pitch there (issue #238), inside a rest at
      // the grid line pressed (issue #293).
      const here = splitRestAt(clip, at, hit.at ?? 0);
      const edit = stringAtPitch(here.clip, here.cursor, pitch) === null ? toggleStaffNote(here.clip, here.cursor, pitch, inputLength) : { clip: here.clip, string: null };
      toPitch(edit.clip, here.cursor, pitch);
      if (edit.string !== null) hearNote({ ...here.cursor, string: edit.string });
      if ('problem' in edit && edit.problem) setNotice({ tone: 'error', lines: [edit.problem] });
    } else if (inputMode) {
      toPitch(clip, at, pitch);
    } else {
      // In normal mode a press beside the heads selects the bar, as on the tab.
      commit(clip, at, clip.bars[hit.bar].columns.length > 0 ? barSelection(clip, hit.bar) : null);
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
      lastDigitRef.current = null;
      editorRef.current?.focus();
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

  /** A fret number being dragged to another string: the clip it started from, and the string it last landed on. */
  const fretFrom = useRef<{ clip: Part; string: number } | null>(null);

  /**
   * A fret number dragged up or down the tab in normal mode (issue #238, as MuseScore's Ctrl/⌘+↑ ↓): the
   * note goes to the string under the pointer at the same pitch, its fret worked out again. Over a string
   * that has a note in the column or can't play the pitch, it goes to the nearest one back that can. Each new
   * string sounds (with Hear notes on); letting go makes it one undo step, off the drawing it goes back.
   */
  const onDragFret = (drag: FretDrag) => {
    const { hit } = drag;
    if (!fretFrom.current) fretFrom.current = { clip, string: hit.string };
    const from = fretFrom.current;
    // The string under the pointer, else the nearest one back toward where the note started that can take it.
    const toward = Math.sign(hit.string - drag.string);
    let landing = drag.string;
    while (landing !== hit.string && !noteToString(from.clip, hit, landing)) landing += toward;
    const moved = landing !== from.string;
    if (!drag.cancelled) from.string = landing;
    const shown = drag.cancelled ? from.clip : noteToString(from.clip, hit, from.string)!;
    const string = drag.cancelled ? hit.string : from.string;
    if (drag.done) {
      fretFrom.current = null;
      if (shown !== from.clip) dispatch({ type: 'replacePart', part: shown, from: from.clip });
      else dispatch({ type: 'previewPart', part: from.clip });
    } else dispatch({ type: 'previewPart', part: shown });
    setCursor({ ...hit, string });
    if (moved && !drag.done) hearNote({ ...hit, string });
  };

  /**
   * A press on a P.M. or let ring line selects every column under it, so its palette button shows
   * pressed and one press turns the whole run off. The cursor goes to the run's first marked note.
   */
  const onPickRun = (mark: RunMark, index: number) => {
    lastDigitRef.current = null;
    setColumnOnly(false);
    const { has } = RUN_MARKS.find(r => r.mark === mark)!;
    const [from, to] = runAround(clip, index, has);
    const place = placeOf(clip, from);
    const notes = clip.bars[place.bar].columns[place.column].notes;
    const string = notes.findIndex(n => n?.[mark]);
    commit(clip, { ...place, string }, { anchor: from, focus: to });
  };

  return {
    onPick, onPickRhythm, onPickStaff, onPickText, onPickMark, onPickRun, onPickRect, onDragStaff, onDragFret,
    stepToElement, editPicked, deletePicked,
  };
}
