/**
 * The Tab MCP App (#340, `docs/specs/2026-11-04-show-tab-mcp-app-design.md`): the line `show_tab`
 * was called with, drawn and played (`ChatTab.tsx`), with no storage. `useHost` is the bridge to the
 * host: it shows the line the call asked for, tells the model when the user changes the bpm or the
 * loop, and lets the sound go on teardown.
 */
import type { App } from '@modelcontextprotocol/ext-apps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { appInfo, listenToHost } from '@/mcp/app';
import { DEFAULT_BPM, type Part } from '../clip';
import { ChatTab, type Heard } from './ChatTab';
import { lineFromInput } from './lineJson';
import type { TabState } from './register';
import type { View } from './tool';

/** How long after the last change the model is told: a drag on the bpm sends one update, not forty. */
export const REPORT_DELAY_MS = 1000;

export const APP_INFO = appInfo('tab');

/** What the model is told when the user changes how the line plays. */
export function modelContext(heard: Heard) {
  return {
    content: [{
      type: 'text' as const,
      text: `The user is now playing the line at ${heard.bpm} bpm, ${heard.loop ? 'looping' : 'not looping'}.`,
    }],
    structuredContent: { ...heard },
  };
}

/** The tool result's state, if it is one. */
function stateOf(raw: unknown): TabState | null {
  const s = raw as Partial<TabState> | null | undefined;
  return s && typeof s === 'object' && s.line && typeof s.line === 'object' ? (s as TabState) : null;
}

/** How a line plays before the user changes anything. Keys in `Heard`'s order, to compare as JSON. */
function asked(part: Part): Heard {
  return { bpm: part.bars[0]?.tempo?.bpm ?? DEFAULT_BPM, loop: false };
}

interface Shown {
  part: Part;
  view: View;
}

function useHost(app: App) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [connected, setConnected] = useState(false);
  /** The last bpm and loop the model knows of. */
  const known = useRef<string | null>(null);
  const [heard, setHeard] = useState<Heard | null>(null);

  useEffect(() => {
    const show = (raw: unknown) => {
      const made = lineFromInput(raw);
      if (made.ok) setShown({ part: made.part, view: made.view });
    };
    return listenToHost(app, {
      // The input comes first: show it at once, then take the server's checked line.
      input: show,
      result: raw => {
        const state = stateOf(raw);
        if (state) show({ ...state.line, view: state.view });
      },
      connected: () => setConnected(true),
      // Taking the line away unmounts ChatTab, whose player lets the sound go.
      teardown: () => setShown(null),
    });
  }, [app]);

  // A new line plays as the call asked, at its own bpm with no loop: the model knows that already.
  useEffect(() => {
    if (shown) known.current = JSON.stringify(asked(shown.part));
  }, [shown]);

  useEffect(() => {
    if (!connected || !heard) return;
    const key = JSON.stringify(heard);
    if (key === known.current) return;
    const id = window.setTimeout(() => {
      known.current = key;
      void app.updateModelContext(modelContext(heard));
    }, REPORT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [app, connected, heard]);

  const onHeard = useCallback((h: Heard) => setHeard({ bpm: h.bpm, loop: h.loop }), []);
  const onOpen = useCallback((url: string) => void app.openLink({ url }), [app]);
  return { shown, onHeard, onOpen };
}

export function TabApp({ app }: { app: App }) {
  const { shown, onHeard, onOpen } = useHost(app);
  return (
    <HoverTips>
      {shown && <ChatTab part={shown.part} view={shown.view} onOpen={onOpen} onHeard={onHeard} />}
    </HoverTips>
  );
}
