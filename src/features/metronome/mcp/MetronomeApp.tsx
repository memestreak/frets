/**
 * The metronome as an MCP App (#269): the page's views and core in a host's iframe, with no
 * storage. `useHost` is the bridge to the host: it shows the rhythm the tool call asked for, tells
 * the model what the user changes, follows the host's theme, and lets the audio go on teardown.
 */
import { App, applyDocumentTheme, type McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { useEffect, useRef, useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { ViewChoice } from '../controls';
import { defaultRhythm, type Rhythm } from '../rhythm';
import { DEFAULT_DISPLAY, DEFAULT_PLAYBACK, type ViewId } from '../storage';
import { useMetronomeCore, type Metronome } from '../useMetronomeCore';
import { useTapKey } from '../useTapKey';
import { MetronomeView } from '../views';
import { listenToHost } from './host';
import { Strip } from './Strip';
import { describeRhythm, rhythmFromInput, type MetronomeState, type ToolInput } from './tool';

/** How long after the last change the model is told: a drag sends one update, not forty. */
export const REPORT_DELAY_MS = 1000;

export const APP_INFO = { name: 'Frets metronome', version: '1.0.0' };

/** The tool result's state, if it is one. */
function stateOf(raw: unknown): MetronomeState | null {
  const s = raw as Partial<MetronomeState> | null | undefined;
  return s && typeof s === 'object' && s.rhythm && typeof s.view === 'string' ? (s as MetronomeState) : null;
}

/** What the model is told: one line, and the rhythm to pass back to `show_metronome`. */
export function modelContext(rhythm: Rhythm, view: ViewId, playing: boolean) {
  return {
    content: [{
      type: 'text' as const,
      text: `The user's metronome is now at ${describeRhythm(rhythm)}, ${playing ? 'playing' : 'stopped'}.`
        + ' To change it, call show_metronome with this rhythm as `rhythm`.',
    }],
    structuredContent: { rhythm, view, playing },
  };
}

function useHost(app: App, m: Metronome, view: ViewId, setView: (v: ViewId) => void) {
  const [connected, setConnected] = useState(false);
  /** The last state the host gave or was told, so it isn't told back what it already knows. */
  const known = useRef<string | null>(null);
  const { setRhythm, close } = m;

  useEffect(() => {
    const show = (state: MetronomeState) => {
      known.current = JSON.stringify([state.rhythm, state.view, false]);
      setRhythm(state.rhythm);
      setView(state.view);
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
  }, [app, setRhythm, setView, close]);

  const { rhythm, playing } = m;
  useEffect(() => {
    if (!connected) return;
    const key = JSON.stringify([rhythm, view, playing]);
    if (key === known.current) return;
    const id = window.setTimeout(() => {
      known.current = key;
      void app.updateModelContext(modelContext(rhythm, view, playing));
    }, REPORT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [app, connected, rhythm, view, playing]);
}

/** MOCK (2026-10-31): the layouts Jeremy is choosing between for Claude's chat column. */
const LAYOUTS = [['now', 'Now'], ['a', 'A Tighter'], ['b', 'B One row'], ['c', 'C Scaled']] as const;
type Layout = (typeof LAYOUTS)[number][0];

export function MetronomeApp({ app }: { app: App }) {
  const m = useMetronomeCore(() => ({ rhythm: defaultRhythm(), volume: DEFAULT_PLAYBACK.volume }));
  const [view, setView] = useState<ViewId>(DEFAULT_DISPLAY.view);
  const [layout, setLayout] = useState<Layout>('a');
  useHost(app, m, view, setView);
  useSpaceKey(m.toggle);
  useTapKey(m.tap);
  return (
    <ViewChoice.Provider value={{ view, setView }}>
      <HoverTips>
        <div className="mcp-app" data-layout={layout}>
          {layout === 'b' ? <Strip m={m} /> : <MetronomeView view={view} m={m} />}
          <div className="seg mcp-mock" role="group" aria-label="Layout (mock)">
            {LAYOUTS.map(([id, name]) => (
              <button key={id} type="button" className="seg-opt" aria-pressed={layout === id} onClick={() => setLayout(id)}>{name}</button>
            ))}
          </div>
        </div>
      </HoverTips>
    </ViewChoice.Provider>
  );
}
