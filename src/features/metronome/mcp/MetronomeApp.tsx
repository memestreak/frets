/**
 * The metronome as an MCP App (#269): the page's core in a host's iframe, shown in one compact
 * layout (`Strip.tsx`), with no storage. `useHost` is the bridge to the host: it shows the rhythm the tool call asked for, tells
 * the model what the user changes, follows the host's theme, and lets the audio go on teardown.
 */
import { App, applyDocumentTheme, type McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { useEffect, useRef, useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { defaultRhythm, type Rhythm } from '../rhythm';
import { DEFAULT_PLAYBACK } from '../storage';
import { useMetronomeCore, type Metronome } from '../useMetronomeCore';
import { useTapKey } from '../useTapKey';
import { listenToHost } from './host';
import { Strip } from './Strip';
import { describeRhythm, rhythmFromInput, type MetronomeState, type ToolInput } from './tool';

/** How long after the last change the model is told: a drag sends one update, not forty. */
export const REPORT_DELAY_MS = 1000;

export const APP_INFO = { name: 'Frets metronome', version: '1.0.0' };

/** The tool result's state, if it is one. */
function stateOf(raw: unknown): MetronomeState | null {
  const s = raw as Partial<MetronomeState> | null | undefined;
  return s && typeof s === 'object' && s.rhythm && typeof s.rhythm === 'object' ? (s as MetronomeState) : null;
}

/** What the model is told: one line, and the rhythm to pass back to `show_metronome`. */
export function modelContext(rhythm: Rhythm, playing: boolean) {
  return {
    content: [{
      type: 'text' as const,
      text: `The user's metronome is now at ${describeRhythm(rhythm)}, ${playing ? 'playing' : 'stopped'}.`
        + ' To change it, call show_metronome with this rhythm as `rhythm`.',
    }],
    structuredContent: { rhythm, playing },
  };
}

function useHost(app: App, m: Metronome) {
  const [connected, setConnected] = useState(false);
  /** The last state the host gave or was told, so it isn't told back what it already knows. */
  const known = useRef<string | null>(null);
  const { setRhythm, close } = m;

  useEffect(() => {
    const show = (state: MetronomeState) => {
      known.current = JSON.stringify([state.rhythm, false]);
      setRhythm(state.rhythm);
    };
    const theme = (ctx: McpUiHostContext | undefined) => {
      if (ctx?.theme) applyDocumentTheme(ctx.theme);
    };
    const stop = listenToHost(app, {
      // The input comes first: show it at once, then take the server's checked result.
      input: args => {
        const made = rhythmFromInput(args as ToolInput);
        if (made.ok) show(made.state);
      },
      result: raw => {
        const state = stateOf(raw);
        if (state) show(state);
      },
      context: theme,
      teardown: close,
    });
    let live = true;
    // Nothing is sent to the host until the handshake is done.
    void app.connect().then(() => {
      if (!live) return;
      theme(app.getHostContext());
      setConnected(true);
    });
    return () => {
      live = false;
      stop();
    };
  }, [app, setRhythm, close]);

  const { rhythm, playing } = m;
  useEffect(() => {
    if (!connected) return;
    const key = JSON.stringify([rhythm, playing]);
    if (key === known.current) return;
    const id = window.setTimeout(() => {
      known.current = key;
      void app.updateModelContext(modelContext(rhythm, playing));
    }, REPORT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [app, connected, rhythm, playing]);
}

export function MetronomeApp({ app }: { app: App }) {
  const m = useMetronomeCore(() => ({ rhythm: defaultRhythm(), volume: DEFAULT_PLAYBACK.volume }));
  useHost(app, m);
  useSpaceKey(m.toggle);
  useTapKey(m.tap);
  return (
    <HoverTips>
      <Strip m={m} />
    </HoverTips>
  );
}
