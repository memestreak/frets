'use client';

/**
 * Settings › Tab › Chat's two prompt fields (`docs/specs/2026-11-09-tab-chat-prompt-design.md`, issue
 * #426): the instructions, editable with a way back to the default and the agent guide shown under them
 * read-only, and the viewer's own prompt. Both go into the next message sent, mid-conversation too (Q5).
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { SettingsField } from '@/components/settings/types';
import { DEFAULT_CHAT, instructionsOf, keptInstructions, type ChatPrefs } from './chatPrefs';
import { loadGuide } from './guide';

/** The instructions: the default until edited; "Reset to default" shows only while they differ (Q4). */
export const instructionsField: SettingsField<ChatPrefs> = {
  key: 'instructions', label: 'Instructions',
  control: ({ value, set, labelId }) => (
    <div className="settings-prompt">
      <textarea
        className="input settings-textarea" aria-labelledby={labelId} rows={10} spellCheck={false}
        value={instructionsOf(value)}
        onChange={e => set({ ...value, instructions: keptInstructions(e.target.value) })}
      />
      <GuideView
        reset={value.instructions === DEFAULT_CHAT.instructions ? undefined : () => set({ ...value, instructions: DEFAULT_CHAT.instructions })}
      />
    </div>
  ),
};

/** The viewer's own prompt, sent last; empty sends nothing. */
export const customField: SettingsField<ChatPrefs> = {
  key: 'custom', label: 'Custom prompt',
  control: ({ value, set, labelId }) => (
    <textarea
      className="input settings-textarea" aria-labelledby={labelId} rows={4}
      placeholder="Sent with every request, after the guide. For example: Suggest fingerings a beginner can play."
      value={value.custom}
      onChange={e => set({ ...value, custom: e.target.value })}
    />
  ),
};

/**
 * Under the instructions: a line saying the guide follows them, a Show button that unfolds it read-only
 * (Q1), and "Reset to default" while the instructions are edited. Reset sits on the same line, so
 * nothing moves when it appears.
 */
function GuideView({ reset }: { reset?: () => void }) {
  const [shown, setShown] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  // Unfolded by a press, so brought into the pane's view; the page itself never scrolls.
  useEffect(() => {
    if (shown) box.current?.scrollIntoView?.({ block: 'nearest' });
  }, [shown]);
  useEffect(() => {
    if (!shown || text !== null) return;
    let live = true;
    void loadGuide().then(t => { if (live) setText(t); });
    return () => { live = false; };
  }, [shown, text]);
  return (
    <>
      <div className="settings-prompt-foot">
        <span className="settings-prompt-note">Then the alphaTex guide, always sent.</span>
        <button
          type="button" className="btn btn-ghost settings-prompt-btn" aria-expanded={shown} aria-controls={id}
          onClick={e => { setShown(s => !s); e.currentTarget.blur(); }}
        >
          {shown ? 'Hide guide' : 'Show guide'}
        </button>
        {reset && (
          <button type="button" className="btn btn-ghost settings-prompt-btn" onClick={reset}>
            Reset to default
          </button>
        )}
      </div>
      {shown && (
        // Read-only, but a box the keyboard can reach and scroll, and its text can be selected and copied.
        <textarea
          ref={box} id={id} className="settings-guide" readOnly rows={12} spellCheck={false} aria-label="The alphaTex guide"
          value={text === null ? 'Loading…' : text || 'The guide could not be loaded.'}
        />
      )}
    </>
  );
}
