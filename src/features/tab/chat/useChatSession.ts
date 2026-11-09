'use client';

/**
 * The Chat panel's conversation, held by the Tab page rather than the panel (issue #442), so it lasts the
 * whole visit (`docs/specs/2026-11-08-tab-chat-design.md`): closing the panel, or opening another, keeps the
 * conversation, the half-written message and a reply still running. Chat's icon in its header shows a reply
 * running, and a reply that ended while the panel was closed (`status`). Leaving the page stops a reply.
 */
import { useEffect, useRef, useState } from 'react';
import { readAlphaTex } from '../alphatexRead';
import type { Clip } from '../clip';
import { arrangementNow, type PageSpot } from './arrangementTools';
import { completeWithOpenRouter, type ChatMessage, type Complete, type Usage } from './openRouter';
import { loadGuide } from './guide';
import { askWithArrangement, runReply, systemPrompt } from './reply';
import type { ChatPrefs } from './chatPrefs';

/** A line on what a tool did, as "Changed bars 3 to 4 of track 1". */
export type Note = { text: string; failed?: boolean };

/** One entry in the panel's list. */
export type Entry =
  | { kind: 'ask'; text: string }
  | { kind: 'reply'; text: string; notes: Note[]; model: string; usage: Usage }
  | { kind: 'error'; text: string; notes: Note[] };

/** What Chat's icon shows: nothing, a reply running, or a reply not yet seen. */
export type ChatStatus = 'idle' | 'working' | 'unread';

export interface ChatSessionOptions {
  prefs: ChatPrefs;
  /** The whole clip now, and where the viewer is. */
  current: () => { clip: Clip; spot: PageSpot };
  /** A change from the model; `first` when it is the reply's first, which starts its Undo step. */
  onClip: (clip: Clip, first: boolean) => void;
  /** Whether the Chat panel is open, so a reply ending while it is closed is marked unread. */
  open: boolean;
  /** Tests pass their own. */
  complete?: Complete;
  guide?: () => Promise<string>;
}

export interface ChatSession {
  entries: Entry[];
  /** The reply running: its notes so far, and how to stop it. */
  working: { notes: Note[] } | null;
  draft: string;
  setDraft: (text: string) => void;
  /** Sends the draft. */
  send: () => Promise<void>;
  stop: () => void;
  /** New chat: forgets the conversation. */
  clear: () => void;
  status: ChatStatus;
}

export function useChatSession(options: ChatSessionOptions): ChatSession {
  // A reply runs across many renders; it reads the page's newest callbacks, not the ones of the render it started in.
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });

  const [entries, setEntries] = useState<Entry[]>([]);
  /** The conversation as the model sees it, without the system prompt. */
  const history = useRef<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [working, setWorking] = useState<{ notes: Note[] } | null>(null);
  const stopper = useRef<AbortController | null>(null);
  const [unread, setUnread] = useState(false);
  // Opening the panel shows the reply, so it is read.
  if (unread && options.open) setUnread(false);

  // Leaving the page stops a reply: its changes would land on nothing.
  useEffect(() => () => stopper.current?.abort(), []);

  const send = async () => {
    const text = draft.trim();
    const { prefs, complete = completeWithOpenRouter, guide = loadGuide } = latest.current;
    if (!text || stopper.current || !prefs.apiKey) return;
    setDraft('');
    setEntries(list => [...list, { kind: 'ask', text }]);
    const stop = new AbortController();
    stopper.current = stop;
    const notes: Note[] = [];
    setWorking({ notes: [] });
    // The conversation keeps the ask alone; the request carries it with the arrangement as it is now,
    // so the model needn't spend a call reading it first.
    const asked: ChatMessage = { role: 'user', content: text };
    let changed = false;
    try {
      const current = () => latest.current.current();
      const { clip, spot } = current();
      const withArrangement: ChatMessage = { role: 'user', content: askWithArrangement(text, await arrangementNow(clip, spot, readAlphaTex)) };
      const result = await runReply({
        complete, apiKey: prefs.apiKey, model: prefs.model,
        messages: [{ role: 'system', content: systemPrompt(await guide(), prefs) }, ...history.current, withArrangement],
        current, read: readAlphaTex, signal: stop.signal,
        onClip: clip => { latest.current.onClip(clip, !changed); changed = true; },
        onNote: note => { notes.push(note); setWorking({ notes: [...notes] }); },
      });
      history.current = [...history.current, asked, ...result.messages];
      setEntries(list => [...list, { kind: 'reply', text: result.text, notes: result.notes, model: result.model, usage: result.usage }]);
    } catch (e) {
      const text = stop.signal.aborted ? 'Stopped.' : e instanceof Error ? e.message : 'Something went wrong.';
      // The ask stays in the conversation, so the next one can refer to it.
      history.current = [...history.current, asked, { role: 'assistant', content: `(No answer: ${text})` }];
      setEntries(list => [...list, { kind: 'error', text, notes }]);
    } finally {
      stopper.current = null;
      setWorking(null);
      if (!latest.current.open) setUnread(true);
    }
  };

  const clear = () => {
    history.current = [];
    setEntries([]);
  };

  return {
    entries, working, draft, setDraft, send, clear,
    stop: () => stopper.current?.abort(),
    status: working ? 'working' : unread ? 'unread' : 'idle',
  };
}
