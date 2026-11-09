import { type FocusEvent, useEffect, useEffectEvent, useRef } from 'react';
import { useShortcuts } from '@/components/shortcuts/useShortcuts';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { columnCount, noteAt } from './editing';
import { lineKeyDown, popupTakesEscape } from './editorKeys';
import { stepGrid } from './grid';
import type { Parts } from './layout';
import { writtenStrings } from './notation';
import { TAB_SHORTCUTS } from './shortcuts';
import { pitchAtStep } from './staffEntry';
import type { TabPrefs } from './tabSettings';
import type { EditorState } from './useEditorState';
import type { PlayRange } from './usePlayRange';
import type { View } from './views';

/** Fields, dialogs and the like: the page's keys, paste and undo leave what is typed there to them. */
export const TEXT_FIELDS = 'input, select, textarea, dialog';

/** Where the focus may go from the tab and note input mode stay on: the clip's own fields, the palettes and their collapsed strip, panels and menus. */
/** What the tab gives the focus to for a while, staying lit and keeping what is picked (`onEditorBlur`). */
const TAB_KEEPERS = '.shape-menu, .tab-tuplet-panel, .tab-word';
const NOTE_INPUT_KEEPERS = '[data-testid="tab-paper"], .tab-palette, .tab-stack-strip, .tab-rail-panel, [role="dialog"], [role="menu"], .shape-menu, dialog';

/**
 * The keys that work anywhere on the page (Jeremy, 2026-10-30: shortcuts are page-wide), not the tab's own
 * (`editorKeys.ts`): the grid keys, Esc and N for note input mode, L, Space, the playback line's keys, paste,
 * copy, cut, undo and redo; and what the tab does as it takes the keys and lets them go.
 */
export function usePageKeys(editor: EditorState, { view, parts, range, showPlayback, setEditingPrefs, enterNoteInput, chooseVoice, paste, copyOrCut, undo }: {
  view: View;
  /** What the Notation view shows: the staff, the tab or both. */
  parts: Parts;
  /** Playback and where it plays (`usePlayRange`). */
  range: PlayRange;
  /** Whether the playback controls show; hidden, Space and L do nothing. */
  showPlayback: boolean;
  /** Changes Settings › Tab › Editing (the grid). */
  setEditingPrefs: TabPrefs['setEditing'];
  /** Note input mode on or off. */
  enterNoteInput: (on: boolean) => void;
  /** Makes a Voice active (`useVoicePick`). */
  chooseVoice: (next: number) => void;
  /** Puts pasted text in at the cursor, or in before it with `insert`. */
  paste: (text: string, insert: boolean) => void;
  /** Writes the selection (or the cursor's column) to the clipboard; a cut also makes it rests. */
  copyOrCut: (e: ClipboardEvent, cut: boolean) => void;
  /** Undo, or with `redo` Redo. */
  undo: (redo: boolean) => void;
}) {
  const {
    clip, cursor, selection, setSelection, noteInputMode, staffPitch, setStaffPitch, columnOnly, setColumnOnly,
    tabFocused, setTabFocused, setPicked, setNotice, editorRef,
  } = editor;
  const { playback, playFrom, playUntil, markAt, toggleLoop, placeLine, editAtLine } = range;

  // Off the tab, in the Notation view, the arrow keys, Delete and Esc work on the playback line (`lineKeyDown`).
  const onLineKey = useEffectEvent((e: KeyboardEvent) => {
    if (view !== 'tab') return;
    // N anywhere on the page goes into note input mode and back out, as on the tab (Jeremy, 2026-10-30: shortcuts are page-wide).
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    // Alt+[ and Alt+] make note input mode's grid finer and coarser, as Dorico's do (issue #293), turning the fixed grid on
    // at what it was first; Alt+G switches between the fixed grid and note input mode's length. On the tab or off it.
    const gridKey = e.code === 'BracketLeft' ? -1 : e.code === 'BracketRight' ? 1 : e.code === 'KeyG' ? 'toggle' : 0;
    if (gridKey && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !(e.target as Element | null)?.closest?.(`${TEXT_FIELDS}, [role="dialog"], [role="menu"]`)) {
      e.preventDefault();
      if (gridKey === 'toggle') setEditingPrefs(p => ({ ...p, fixedGrid: !p.fixedGrid }));
      else setEditingPrefs(p => ({ ...p, fixedGrid: true, grid: p.fixedGrid ? stepGrid(p.grid, gridKey) : p.grid }));
      return;
    }
    // Esc anywhere on the page leaves note input mode (Jeremy, 2026-11-03): after a press off the tab, on the rail or a
    // control too. An open panel, menu or dialog takes it first, as in Dorico and MuseScore; the next Esc leaves.
    if (e.key === 'Escape' && noteInputMode && !(e.target as Element | null)?.closest?.('.tab-editor') && !popupTakesEscape(e)) {
      e.preventDefault();
      enterNoteInput(false);
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
      enterNoteInput(!noteInputMode);
      return;
    }
    lineKeyDown(e, { clip, count: columnCount(clip), line: markAt, selection, select: setSelection, placeLine, editAtLine });
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

  /** Whether the next paste is Insert paste, from Ctrl/⌘+Shift+V. */
  const insertNext = useRef(false);
  const pasteText = useEffectEvent((text: string, insert: boolean) => paste(text, insert));
  const copyOrCutNow = useEffectEvent((e: ClipboardEvent, cut: boolean) => copyOrCut(e, cut));
  const undoNow = useEffectEvent((redo: boolean) => {
    undo(redo);
    setNotice(null);
  });

  // Paste anywhere on the page; copy and cut in the editor; undo and redo.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as Element | null)?.closest?.(TEXT_FIELDS)) return;
      const text = e.clipboardData?.getData('text/plain');
      const insert = insertNext.current;
      insertNext.current = false;
      if (!text) return;
      e.preventDefault();
      pasteText(text, insert);
    };
    // Copy and cut belong to the editor only; elsewhere they copy the page's own selected text.
    const inEditor = (e: Event) => editorRef.current !== null && editorRef.current.contains(e.target as Node);
    const onCopy = (e: ClipboardEvent) => { if (inEditor(e)) copyOrCutNow(e, false); };
    const onCut = (e: ClipboardEvent) => { if (inEditor(e)) copyOrCutNow(e, true); };
    const onKey = (e: KeyboardEvent) => {
      // Ctrl/⌘+Shift+V is Insert paste: the paste it makes goes in before the cursor (issue #238).
      insertNext.current = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v';
      // Ctrl+Y redoes too, as in MuseScore and Windows (issue #238); ⌘+Y is left to the browser.
      const redoY = e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'y';
      if (!redoY && (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z')) return;
      if ((e.target as Element | null)?.closest?.(TEXT_FIELDS)) return;
      e.preventDefault();
      undoNow(redoY || e.shiftKey);
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
  }, [editorRef]);

  /** The tab let go of: nothing lit or picked. */
  const leaveTab = () => {
    setTabFocused(false);
    setPicked(null);
    setColumnOnly(false);

    // Leaving the tab puts the Active voice back to Voice 1 (step 9, Q7).
    chooseVoice(0);
  };

  // The focus gone from the clip and its own fields and panels (Tab to another control, a press away from a
  // chord name's field) takes the caret away, so note input mode ends too, as a press away does. The window
  // losing the focus keeps it.
  const onFocusMoved = useEffectEvent(() => {
    if (!document.hasFocus()) return;
    const now = document.activeElement;
    // The tab kept lit for a field or panel of its own (`onEditorBlur`): the focus leaving that, but not
    // back to the tab, leaves the tab as a press away from it does.
    if (tabFocused && !now?.closest(`.tab-editor, ${TAB_KEEPERS}`)) leaveTab();
    if (noteInputMode && (!now || !now.closest(NOTE_INPUT_KEEPERS))) enterNoteInput(false);
  });
  useEffect(() => {
    let timer = 0;
    // Once the focus has landed: during `focusout` it is on nothing yet.
    const moved = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onFocusMoved, 0);
    };
    document.addEventListener('focusout', moved);
    return () => {
      document.removeEventListener('focusout', moved);
      window.clearTimeout(timer);
    };
  }, []);

  /**
   * The focus coming to the clip; with the staff alone, its cursor is the only one, so it shows at once. Not
   * after a press that selected a bar or column, which shows as a box (issue #317).
   */
  const onEditorFocus = () => {
    setTabFocused(true);
    if (parts !== 'staff' || staffPitch !== null || columnOnly) return;
    const note = noteAt(clip, cursor);
    setStaffPitch(note && note.fret !== null ? writtenStrings(clip.tuning)[cursor.string] + (clip.capo ?? 0) + note.fret : pitchAtStep(clip, cursor.bar, 4));
  };

  /**
   * The tab losing the focus leaves the cursor's bar, which fills up when Settings says to (Jeremy, 2026-10-27): a press
   * off the tab, Esc. Not while the focus stays on the clip's own parts (a chord name's field, the
   * time signature panel) or goes to the palette, nor when the whole window loses it.
   */
  const onEditorBlur = (e: FocusEvent<HTMLDivElement>) => {
    // Its right-click menu, the Tuplet panel `;` opens (step 6), and a word's field (a dynamic's, a chord
    // name's…) take the focus for a while and give it back: what is picked stays picked, and the cursor's
    // column stays lit, so it shows what the field changes (Jeremy, 2026-11-09).
    if (e.relatedTarget instanceof Element && e.relatedTarget.closest(TAB_KEEPERS)) return;
    leaveTab();
  };

  return { onEditorFocus, onEditorBlur };
}
