import { useState } from 'react';
import { partOf, type Clip, type Part } from './clip';
import { noteAt, placeOf, type Cursor, type Selection } from './editing';
import type { Hit } from './hitTest';
import { cursorInVoice, moveToVoice, perVoice, selectionInVoice, spansVoices, stepAcrossVoices } from './voices';
import type { EditorState } from './useEditorState';

/**
 * The Active voice (step 9, `GLOSSARY.md`), from 0: the Voice the cursor types into, picked by Alt+1–4, the
 * Rail's Voice row or a press on its notes; back to Voice 1 when the cursor leaves the tab, or another
 * track or arrangement opens. Held apart from `useVoicePick`, as the shown Part, and so the editor, comes from it.
 */
export function useActiveVoice(opened: string, track: number) {
  const [voicePick, setVoicePick] = useState({ opened, track: 0, voice: 0 });
  const voice = voicePick.opened === opened && voicePick.track === track ? voicePick.voice : 0;
  const setVoice = (next: number) => setVoicePick({ opened, track, voice: next });
  return { voice, setVoice };
}

/**
 * Picking the Active voice, and the edits that cross Voices (step 9,
 * `docs/specs/2026-11-03-tab-voices-design.md`): a press on another Voice's note, Alt+1–4, Move to voice,
 * Select only voice, an edit of every Voice a selection covers, and Alt+← → across Voices.
 */
export function useVoicePick(editor: EditorState, { whole, track, voice, setVoice, stepToElement }: {
  /** The whole clip, every track. */
  whole: Clip;
  /** The shown track. */
  track: number;
  /** The Active voice and its setter (`useActiveVoice`). */
  voice: number;
  setVoice: (next: number) => void;
  /** Alt+← → in the Active voice alone (`useTabPicking`). */
  stepToElement: (step: 1 | -1) => void;
}) {
  const {
    clip, cursor, selection, columnOnly, noteInputMode, picked,
    setCursor, setSelection, setPicked, setCursorAt, setColumnOnly, setStaffPitch, editorRef,
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
    setVoice(next);
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
    setVoice(to);
    if (!selection) setColumnOnly(columnOnly);
    return true;
  };
  /** Alt+1–4: with notes picked or selected in normal mode, they move into that Voice; else it becomes active. */
  const voiceKey = (to: number) => {
    const picksNotes = !noteInputMode && (selection !== null || (!columnOnly && noteAt(clip, cursor) !== null));
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
    if (!across) return stepToElement(step);
    const to = partOf(whole, track, across.voice);
    const column = to.bars[across.bar].columns[across.column];
    const string = column.notes.findIndex(Boolean);
    chooseVoice(across.voice, { cursor: { bar: across.bar, column: across.column, string: string >= 0 ? string : cursor.string }, selection: null });
    setColumnOnly(string < 0);
    setStaffPitch(null);
  };
  /** Whether Voice `v` has notes in the cursor's bar, for its Rail button's tip (Q17). */
  const voicePresentAtCursor = (v: number) => v === voice ? clip.bars[cursor.bar]?.columns.some(c => c.notes.some(Boolean)) ?? false
    : v === 0 || (clip.bars[cursor.bar]?.otherVoices?.some(o => o.voice === v) ?? false);

  return { voiceOnly, chooseVoice, pickVoice, moveToVoiceKey, voiceKey, selectOnlyVoice, everyVoice, stepElement, voicePresentAtCursor };
}
