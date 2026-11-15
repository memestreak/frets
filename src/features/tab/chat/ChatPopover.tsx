'use client';

/**
 * The Chat popover (`docs/specs/2026-11-15-tab-chat-popover-design.md`, issue #488): a prompt typed over the
 * tab at the selection or the cursor, opened with Ctrl/⌘+I or the right-click menus' Chat…. It sends through
 * the page's Chat conversation (`useChatSession`), so the model, its tools and the one Undo step per reply are
 * the Chat panel's, and stays open to show the reply. ↑ and ↓ bring back the prompts sent from it this visit.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { usePanelClose, usePanelInside } from '../barPanel';
import { ReplyMarkdown } from './ReplyMarkdown';
import { usageLine } from './ChatPanel';
import { scopedPrompt, type About } from './about';
import type { ChatSession, Note } from './useChatSession';

/** The prompts sent from the popover this visit, newest last, for ↑ and ↓. */
const sent: string[] = [];

/** Forgets the prompts sent; for tests. */
export function forgetPrompts() {
  sent.length = 0;
}

export function ChatPopover({ x, y, about, session, hasKey, onClose, onUndo, onOpenChat }: {
  /** Where its left edge and top go, in the tab's own units. */
  x: number;
  y: number;
  /** What the prompt is about: the selected bars, a picked word or mark, the cursor's note, or the whole arrangement. */
  about: About;
  session: ChatSession;
  hasKey: boolean;
  /** `byKey` when Esc closed it, so the keys go back to the tab. */
  onClose: (byKey: boolean) => void;
  /** Takes back the reply's changes, one Undo step. */
  onUndo: () => void;
  onOpenChat: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  /** How far back ↑ has gone through the prompts sent: 0 is what is being typed. */
  const [back, setBack] = useState(0);
  /** The place in the conversation of this popover's latest reply, once it has sent. */
  const [replyAt, setReplyAt] = useState<number | null>(null);
  usePanelInside(boxRef, x);
  usePanelClose(boxRef, onClose);
  useEffect(() => inputRef.current?.focus({ preventScroll: true }), []);

  const send = () => {
    const said = text.trim();
    if (!said || !hasKey || session.working) return;
    sent.push(said);
    // The prompt is the next entry, its reply the one after.
    setReplyAt(session.entries.length + 1);
    setText('');
    setBack(0);
    void session.send(scopedPrompt(said, about));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // The page's own keys stay out of the field, Esc too: it closes the popover and leaves the selection.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose(true);
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    } else if (e.key === 'ArrowUp' && back < sent.length) {
      e.preventDefault();
      setText(sent[sent.length - 1 - back]);
      setBack(back + 1);
    } else if (e.key === 'ArrowDown' && back > 0) {
      e.preventDefault();
      setText(back > 1 ? sent[sent.length - back + 1] : '');
      setBack(back - 1);
    }
  };

  const reply = replyAt === null ? null : session.entries[replyAt] ?? null;
  const done = reply && reply.kind !== 'ask' ? reply : null;
  return (
    <div ref={boxRef} className="tab-chat-popover card" style={{ left: x, top: y }} role="dialog" aria-label="Chat">
      <span className="tab-chat-popover-head">
        <span className="tab-time-caption">Chat</span>
        <span className="tab-chat-popover-scope">{about.label}</span>
      </span>
      <input
        ref={inputRef} className="input tab-chat-popover-input" value={text} aria-label="Prompt"
        placeholder={hasKey ? 'Ask, or say what to change' : 'Add your OpenRouter key in Settings first'}
        disabled={!hasKey} onChange={e => { setText(e.target.value); setBack(0); }} onKeyDown={onKeyDown}
      />
      {replyAt !== null && (
        <div className="tab-chat-popover-reply" aria-live="polite">
          {session.working && !done && (
            <>
              <Notes notes={session.working.notes} />
              <p className="tab-chat-working">Thinking…</p>
            </>
          )}
          {done && (
            <>
              <Notes notes={done.notes} />
              {done.kind === 'error'
                ? <p className="tab-chat-error"><span aria-hidden="true">⚠ </span>{done.text}</p>
                : <>
                    {done.text && <ReplyMarkdown text={done.text} />}
                    <p className="tab-chat-meta">{usageLine(done.model, done.usage)}</p>
                  </>}
              <span className="tab-chat-popover-actions">
                {done.changed && <button type="button" className="btn btn-ghost" onClick={onUndo}>Undo</button>}
                <button type="button" className="btn btn-ghost" onClick={onOpenChat}>Open in Chat</button>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Notes({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null;
  return <ul className="tab-chat-notes">{notes.map((n, i) => <li key={i} data-failed={n.failed || undefined}>{n.text}</li>)}</ul>;
}
