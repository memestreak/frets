import { useEffect, useRef, useState } from 'react';
import type { Clip } from '../clip';
import { noteAt, placeOf, selectedBars, selectedRange } from '../editing';
import { cursorSpot } from '../fieldSpots';
import type { Layout } from '../layout';
import type { EditorState, Picked } from '../useEditorState';
import { WHOLE, aboutBars, aboutThing, noteWords, pickedWords, type About } from './about';
import type { PageSpot } from './arrangementTools';
import type { ChatPrefs } from './chatPrefs';
import { useChatSession } from './useChatSession';

/**
 * The Tab page's Chat (`docs/specs/2026-11-08-tab-chat-design.md`, issue #424): the conversation, where the
 * Chat popover is open (issue #488), and what a prompt is about. The conversation is the page's, not the
 * panel's, so closing the panel keeps it and its running reply (issue #442).
 */
export function useTabChat(editor: EditorState, { whole, track, layout, prefs, panelOpen, change }: {
  /** The whole clip, every track. */
  whole: Clip;
  /** The track shown. */
  track: number;
  /** The drawn clip's layout, where the popover opens. */
  layout: Layout;
  prefs: ChatPrefs;
  /** Whether the Chat palette is showing. */
  panelOpen: boolean;
  /** Puts the model's change in: `amend` joins it to the last undo step, else it is a new one. */
  change: (next: Clip, amend: boolean) => void;
}) {
  const { clip, cursor, selection, picked, tabFocused, columnOnly, editorRef } = editor;
  /** The model's changes go through `chatClip`: a reply's first is an undo step, and its later ones join it, unless the viewer edited in between. */
  const wholeNow = useRef(whole);
  useEffect(() => { wholeNow.current = whole; }, [whole]);
  const chatSet = useRef<Clip | null>(null);
  const chatClip = (next: Clip, first: boolean) => {
    change(next, !first && wholeNow.current === chatSet.current);
    chatSet.current = next;
    // A second change in the same answer reads this one, before the page draws it.
    wholeNow.current = next;
  };
  /** The bar a picked thing is in. */
  const pickedBar = (hit: Picked) => ('bar' in hit ? hit.bar : placeOf(clip, hit.index).bar);
  const chatSpot = (): PageSpot => ({
    track,
    cursorBar: cursor.bar,
    selectedBars: selection ? selectedBars(clip, selection) : null,
    picked: picked ? pickedWords(picked, pickedBar(picked)) : null,
  });
  /** Where the Chat popover is open, and the bars its prompt is about (issue #488). */
  const [chatAt, setChatAt] = useState<{ x: number; y: number; about: About } | null>(null);
  // A reply shown in the Chat popover is read too.
  const chat = useChatSession({
    prefs, current: () => ({ clip: wholeNow.current, spot: chatSpot() }), onClip: chatClip, open: panelOpen || chatAt !== null,
  });

  /**
   * What a Chat prompt is about (issues #488, #498): the selected bars, else what is picked, else the note the
   * cursor is on, else the whole arrangement. What is picked and the cursor's note count only while the tab
   * has them lit, so the Chat palette, opened without touching the tab, says Whole arrangement.
   */
  const chatAbout = (): About => {
    if (selection) return aboutBars(selectedBars(clip, selection));
    if (!tabFocused) return WHOLE;
    if (picked) return aboutThing(pickedWords(picked, pickedBar(picked)));
    const note = !columnOnly ? noteAt(clip, cursor) : null;
    return note ? aboutThing(noteWords(note.fret, cursor.string, cursor.bar, cursor.column)) : WHOLE;
  };
  /**
   * The Chat popover (issue #488): Ctrl/⌘+I, or the right-click menus' Chat…, opens it at the selection's start,
   * else the cursor (where a press put it). Its prompt is about the selected bars, else the whole arrangement.
   */
  const openChatPopover = () => {
    const at = selection ? { ...cursor, ...placeOf(clip, selectedRange(selection)[0]) } : cursor;
    setChatAt({ ...cursorSpot(layout, at), about: chatAbout() });
  };
  const closeChatPopover = (byKey: boolean) => {
    setChatAt(null);
    if (byKey) editorRef.current?.focus({ preventScroll: true });
  };

  return { chat, chatAt, chatAbout, openChatPopover, closeChatPopover };
}
