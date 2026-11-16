import type { Part } from './clip';
import { insertBar, placeOf, type Selection, type Target } from './editing';
import { graceKey, restKey, type EditorKeys } from './editorKeys';
import { cycleLengthDots, lengthOf } from './inputLength';
import { markTool, type MarkHit } from './marks';
import { addedSpan } from './spans';
import { TECHNIQUES, techniqueOn } from './techniques';
import { tieOnInput } from './ties';
import { applyTool, isLengthTool, toolValue, WORD_TOOLS, type ToolId } from './tools';
import { applyTuplet, isProblem } from './tuplets';
import type { EditorState } from './useEditorState';
import type { useHeadPanels } from './useHeadPanels';
import type { Picked } from './useEditorState';

/** The tools that act on the Active voice alone, not every Voice of a selection (step 9, Q19): ties, tuplets, grace notes, Beam overrides. */
const ACTIVE_VOICE_ONLY: ReadonlySet<ToolId> = new Set<ToolId>(['tie', 'tuplet', 'grace', 'beamBreak', 'beamJoin']);

/**
 * What the palette's buttons and panels, the technique popover and the Tuplet panel do to the clip: a tool on the
 * cursor or selection, a bar added, a tuplet picked. Off the tab (after Esc or a press elsewhere) they do nothing.
 */
export function useTabTools(editor: EditorState, { target, head, everyVoice, deletePicked, editorKeys }: {
  /** The cursor and selection the tools act on (a lone column when no string is picked). */
  target: Target;
  /** The fields and panels a word tool, Lyrics or a signature tool opens. */
  head: ReturnType<typeof useHeadPanels>;
  /** An edit on every Voice's notes in a selection's time; false when it doesn't apply (`useVoicePick`). */
  everyVoice: (edit: (part: Part, selection: Selection) => Part) => boolean;
  /** Takes a picked thing away, as Delete does. */
  deletePicked: (hit: Picked) => void;
  /** The keys' view of the page, for the tools that do what a key does (Rest, Grace). */
  editorKeys: () => EditorKeys;
}) {
  const {
    clip, cursor, setCursor, setSelection, tabFocused, columnOnly, setColumnOnly, picked, setPicked, noteInputMode, insertMode,
    inputLength, setInputLength, tupletEntry, setTupletEntry, setTupletFrom, graceEntry, setGraceEntry, commit, setNotice,
  } = editor;

  /** A bar of rests before or after the cursor's bar (Ctrl+Shift+Enter or Ctrl+Enter, the Bars group, the menu), with the cursor in it. */
  const addBar = (where: 'before' | 'after') => {
    const next = insertBar(clip, cursor, where);
    commit(next.clip, next.cursor, null);
  };

  /** Whether a palette tool puts on a Span that is picked once added (let ring, P.M.). */
  const spanTool = (id: ToolId): id is 'letRing' | 'palmMute' => !noteInputMode && (id === 'letRing' || id === 'palmMute');
  /**
   * A let ring or P.M. line just added is picked, as a press on it picks it (`onPickMark`): drawn blue,
   * its notes no longer lit, so it can be dragged straight to the length wanted (Jeremy, 2026-11-09).
   */
  const pickAdded = (next: Part, hit: MarkHit) => {
    setSelection(hit.to !== undefined && hit.to !== hit.index ? { anchor: hit.index, focus: hit.to } : null);
    setCursor({ ...cursor, ...placeOf(next, hit.index) });
    setColumnOnly(true);
    setPicked(hit);
  };

  /** A palette change; a picked mark changed by it (vibrato to wide, a bend's amount) stays picked while it is there. */
  const commitKeepingMark = (next: Part) => {
    commit(next);
    if (picked?.kind === 'mark' && markTool(next, picked)) setPicked(picked);
  };

  /** What a palette button does on the cursor or selection (`onTool`), and what the technique popover does with the tool it names. */
  const runTool = (id: ToolId) => {
    if (id in WORD_TOOLS) head.openWord(WORD_TOOLS[id as keyof typeof WORD_TOOLS]);
    else if (id === 'lyrics') head.openLyric(cursor);
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
      const tied = tieOnInput(clip, cursor, inputLength, insertMode);
      if (tied) commit(tied, cursor);
    }
    // A dead note goes on one string; with none picked there is nothing to mark.
    else if (!(columnOnly && id === 'dead')) {
      // On a selection, a Mark goes on every Voice's notes in its time (Q19). In Insert mode a length changes the
      // Active voice's notes only, and every Voice moves with them (`docs/specs/2026-11-14-tab-insert-mode-design.md`).
      const pushes = insertMode && isLengthTool(id);
      const next = applyTool(clip, target, id, pushes);
      const added = spanTool(id) ? addedSpan(clip, next, id, target) : null;
      if (!picked && !pushes && !ACTIVE_VOICE_ONLY.has(id) && everyVoice((part, run) => applyTool(part, { ...target, selection: run }, id))) {
        if (added) pickAdded(next, added);
        return;
      }
      if (added) {
        commit(next);
        pickAdded(next, added);
      } else commitKeepingMark(next);
    }
  };

  /**
   * A palette button or panel choice. Off the tab (after Esc or a press elsewhere) nothing is under the
   * cursor, so the palette acts on nothing, as it lights nothing (Jeremy, 2026-10-30).
   */
  const onTool = (id: ToolId) => {
    if (tabFocused) runTool(id);
  };

  /**
   * The technique the technique popover named (Shift+P, issue #501), on the cursor or selection as its palette button
   * puts it; one every target note already has is left as it is, as the popover only adds (spec Q6).
   */
  const addTechnique = (name: string) => {
    const technique = TECHNIQUES.find(t => t.name === name);
    if (!technique || techniqueOn(clip, target, technique, columnOnly)) return;
    if (technique.tool) {
      runTool(technique.tool);
      return;
    }
    // One kind of a mark the palette steps through (wide vibrato, a full bend): on every Voice's notes in a selection's time, as a palette mark goes.
    const edit = technique.edit!;
    if (!picked && everyVoice((part, run) => edit(part, { ...target, selection: run }))) return;
    commitKeepingMark(edit(clip, target));
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

  /** A choice in the Bend, Tuplet, Octave line or Whammy bar panel: like a palette button, nothing off the tab. */
  const onPanelChoice = (apply: () => Part) => {
    if (tabFocused) commitKeepingMark(apply());
  };

  return { addBar, onTool, addTechnique, pickTuplet, onPanelChoice };
}
