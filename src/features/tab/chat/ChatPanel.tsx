'use client';

/**
 * The Tab page's Chat panel (`docs/specs/2026-11-08-tab-chat-design.md`, issue #424): ask a model about
 * the open arrangement, or ask it to change it. The page calls OpenRouter itself with the viewer's key
 * (Settings › Tab › Chat). The conversation is the page's (`useChatSession`), so it lasts for this visit
 * though the panel closes (issue #442). Each reply's changes are applied at once, and one Undo takes them all back.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ModelPicker } from './ModelPicker';
import { ReplyMarkdown } from './ReplyMarkdown';
import { fetchPresets, fetchToolModels, type Preset, type Usage } from './openRouter';
import type { ChatPrefs } from './chatPrefs';
import type { ChatSession, Entry, Note } from './useChatSession';

export interface ChatPanelProps {
  prefs: ChatPrefs;
  onModel: (model: string) => void;
  /** The conversation, kept by the page (`useChatSession`). */
  session: ChatSession;
  /** Opens Settings at Tab › Chat. */
  onOpenSettings: () => void;
}

export function ChatPanel({ prefs, onModel, session, onOpenSettings }: ChatPanelProps) {
  const { entries, working, draft, setDraft, send, stop, clear } = session;
  const [models, setModels] = useState<string[]>([]);
  /** The presets listed with a key; shown only while that key is still the one saved. */
  const [listed, setListed] = useState<{ apiKey: string; presets: Preset[] }>({ apiKey: '', presets: [] });
  const presets = listed.apiKey === prefs.apiKey ? listed.presets : [];
  const listRef = useRef<HTMLDivElement>(null);

  // The models offered, for the Model field's suggestions; typed freely when the list can't be had.
  useEffect(() => {
    const stop = new AbortController();
    void fetchToolModels(stop.signal).then(list => { if (list) setModels(list); });
    return () => stop.abort();
  }, []);
  // The viewer's presets on OpenRouter, offered first; listing them takes the key.
  useEffect(() => {
    const apiKey = prefs.apiKey;
    if (!apiKey) return;
    const stop = new AbortController();
    void fetchPresets(apiKey, stop.signal).then(list => { if (list) setListed({ apiKey, presets: list }); });
    return () => stop.abort();
  }, [prefs.apiKey]);
  // The newest entry in view, also on opening the panel again: the list scrolls, never the page.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries, working]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // The page's own keys stay out of the box.
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="tab-chat">
      <div className="tab-chat-model">
        <span aria-hidden="true">Model</span>
        <ModelPicker value={prefs.model} onChange={onModel} presets={presets} models={models} disabled={!!working} />
      </div>
      {!prefs.apiKey && (
        <p className="tab-chat-hint">
          Add your OpenRouter key in Settings to start.{' '}
          <button type="button" className="tab-chat-link" onClick={onOpenSettings}>Open Settings</button>
        </p>
      )}
      <div ref={listRef} className="tab-chat-list" aria-live="polite">
        {entries.length === 0 && prefs.apiKey && (
          <p className="tab-chat-hint">
            Ask about this arrangement, or ask for a change. Use undo to revert a reply&apos;s changes.{' '}
            <button type="button" className="tab-chat-link" onClick={onOpenSettings}>More settings</button>
          </p>
        )}
        {entries.map((entry, i) => <ChatEntry key={i} entry={entry} />)}
        {working && (
          <div className="tab-chat-reply">
            <Notes notes={working.notes} />
            <p className="tab-chat-working">Thinking…</p>
          </div>
        )}
      </div>
      <div className="tab-chat-compose">
        <textarea
          className="input" rows={3} value={draft} aria-label="Message"
          placeholder={prefs.apiKey ? 'Ask, or say what to change (Enter sends)' : 'Add your OpenRouter key in Settings first'}
          disabled={!prefs.apiKey} onChange={e => setDraft(e.target.value)} onKeyDown={onKeyDown}
        />
        <div className="tab-chat-actions">
          {entries.length > 0 && !working && (
            <button type="button" className="btn btn-ghost" onClick={clear}>New chat</button>
          )}
          {working
            ? <button type="button" className="btn btn-secondary" onClick={stop}>Stop</button>
            : <button type="button" className="btn btn-primary" disabled={!draft.trim() || !prefs.apiKey} onMouseDown={e => e.preventDefault()} onClick={() => void send()}>Send</button>}
        </div>
      </div>
    </div>
  );
}

function ChatEntry({ entry }: { entry: Entry }) {
  if (entry.kind === 'ask') return <p className="tab-chat-ask">{entry.text}</p>;
  if (entry.kind === 'error') {
    return (
      <div className="tab-chat-reply">
        <Notes notes={entry.notes} />
        <p className="tab-chat-error"><span aria-hidden="true">⚠ </span>{entry.text}</p>
      </div>
    );
  }
  return (
    <div className="tab-chat-reply">
      <Notes notes={entry.notes} />
      {entry.text && <ReplyMarkdown text={entry.text} />}
      <p className="tab-chat-meta">{usageLine(entry.model, entry.usage)}</p>
    </div>
  );
}

function Notes({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="tab-chat-notes">
      {runsOf(notes).map(({ note, count }, i) => (
        <li key={i} data-failed={note.failed || undefined}>{count > 1 ? `${note.text} (${count} times)` : note.text}</li>
      ))}
    </ul>
  );
}

/** The notes with the same note one after another counted once, as "Read the arrangement (3 times)". */
export function runsOf(notes: readonly Note[]): { note: Note; count: number }[] {
  const runs: { note: Note; count: number }[] = [];
  for (const note of notes) {
    const last = runs[runs.length - 1];
    if (last && last.note.text === note.text && !!last.note.failed === !!note.failed) last.count++;
    else runs.push({ note, count: 1 });
  }
  return runs;
}

/** The model, the tokens and the cost under a reply, for comparing models. */
export function usageLine(model: string, usage: Usage): string {
  const parts = [model];
  if (usage.promptTokens !== undefined || usage.completionTokens !== undefined) {
    const cached = usage.cachedTokens ? ` (${usage.cachedTokens.toLocaleString('en')} cached)` : '';
    parts.push(`${(usage.promptTokens ?? 0).toLocaleString('en')} in${cached}, ${(usage.completionTokens ?? 0).toLocaleString('en')} out`);
  }
  if (usage.cost !== undefined) parts.push(`$${usage.cost < 0.01 ? usage.cost.toFixed(4) : usage.cost.toFixed(2)}`);
  return parts.join(' · ');
}
