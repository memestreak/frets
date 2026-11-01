import { act, render, screen, waitFor } from '@testing-library/react';
import { App } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { APP_INFO, MetronomeApp, REPORT_DELAY_MS } from '@/features/metronome/mcp/MetronomeApp';
import { createFretsServer } from '@/mcp/server';
import { APP_URI, TOOL_NAME, describeRhythm, rhythmFromInput } from '@/features/metronome/mcp/tool';
import { defaultRhythm } from '@/features/metronome/rhythm';

/** Enough of Web Audio for the app; Close is counted. */
let closed = 0;
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  resume() { return Promise.resolve(); }
  close() { closed += 1; return Promise.resolve(); }
  createGain() { return { gain: { value: 1 }, connect: (n: unknown) => n }; }
  createBuffer(_c: number, length: number) { return { length, copyToChannel() {} }; }
  createBufferSource() { return { buffer: null, connect: (n: unknown) => n, start() {} }; }
}

beforeEach(() => {
  closed = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('rhythmFromInput', () => {
  it('makes 7 beats grouped 2+2+3 at 92, accents on each group', () => {
    const made = rhythmFromInput({ bpm: 92, beats: 7, groups: '2+2+3' });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const r = made.state.rhythm;
    expect(r).toMatchObject({ bpm: 92, beats: 7, groups: [2, 2, 3] });
    expect(r.steps.map(s => s[0])).toEqual([0, 2, 1, 2, 1, 2, 2]);
  });

  it('takes the beats from the groups when beats are left out', () => {
    const made = rhythmFromInput({ groups: '3+3' });
    expect(made.ok && made.state.rhythm.beats).toBe(6);
  });

  it('refuses groups that don’t add up to the beats', () => {
    const made = rhythmFromInput({ beats: 7, groups: '2+2' });
    expect(made).toEqual({ ok: false, error: 'Groups 2+2 add up to 4, not 7 beats.' });
  });

  it('splits every beat alike, and swing splits plain beats in two', () => {
    const sub = rhythmFromInput({ subdivision: 3 });
    expect(sub.ok && sub.state.rhythm.subs).toEqual([3, 3, 3, 3]);
    const swung = rhythmFromInput({ swing: 67 });
    expect(swung.ok && swung.state.rhythm).toMatchObject({ swing: 67, subs: [2, 2, 2, 2] });
  });

  it('keeps everything in a passed-back rhythm that the call doesn’t change', () => {
    const before = { ...defaultRhythm(), voices: defaultRhythm().voices.map(v => ({ ...v, sound: 'cowbell' as const })) };
    const made = rhythmFromInput({ rhythm: before as unknown as Record<string, unknown>, bpm: 125 });
    expect(made.ok && made.state.rhythm).toEqual({ ...before, bpm: 125 });
  });

  it('checks a passed-back rhythm like a saved one', () => {
    const made = rhythmFromInput({ rhythm: { bpm: 9999, beats: 'x', voices: 3 } });
    expect(made.ok && made.state.rhythm).toEqual({ ...defaultRhythm(), bpm: 400 });
  });

  it('describes a rhythm in one line', () => {
    const made = rhythmFromInput({ bpm: 92, beats: 7, groups: '2+2+3', subdivision: 2, swing: 60 });
    expect(made.ok && describeRhythm(made.state.rhythm)).toBe('92 bpm, 7 beats grouped 2+2+3, 2 clicks a beat, swing 60');
  });
});

async function connectedClient() {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createFretsServer({ metronome: '<p>app</p>' }).connect(serverSide);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(clientSide);
  return client;
}

describe('the server', () => {
  it('lists show_metronome with its app', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name)).toEqual([TOOL_NAME]);
    expect(tools[0]._meta).toMatchObject({ ui: { resourceUri: APP_URI } });
    const schema = tools[0].inputSchema as { properties: Record<string, { minimum?: number; maximum?: number }> };
    expect(schema.properties.bpm).toMatchObject({ minimum: 20, maximum: 400 });
    expect(schema.properties.beats).toMatchObject({ minimum: 1, maximum: 32 });
  });

  it('serves the app as an MCP App resource', async () => {
    const client = await connectedClient();
    const { contents } = await client.readResource({ uri: APP_URI });
    expect(contents[0]).toMatchObject({ uri: APP_URI, mimeType: 'text/html;profile=mcp-app', text: '<p>app</p>' });
  });

  it('returns the checked rhythm, with a line for hosts without apps', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: TOOL_NAME, arguments: { bpm: 92, beats: 7, groups: '2+2+3' } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ rhythm: { bpm: 92, beats: 7, groups: [2, 2, 3] } });
    expect((result.content as { text: string }[])[0].text).toContain('92 bpm, 7 beats grouped 2+2+3');
  });

  it('says what is wrong with a call it can’t make', async () => {
    const client = await connectedClient();
    const bad = await client.callTool({ name: TOOL_NAME, arguments: { beats: 7, groups: '2+2' } });
    expect(bad.isError).toBe(true);
    const out = await client.callTool({ name: TOOL_NAME, arguments: { bpm: 1000 } });
    expect(out.isError).toBe(true);
  });
});

/** The app in a stand-in host, joined by an in-memory pipe in place of postMessage. */
async function mountApp() {
  const [appSide, hostSide] = InMemoryTransport.createLinkedPair();
  const told: string[] = [];
  const bridge = new AppBridge(null, { name: 'host', version: '1' }, { updateModelContext: { text: {} } }, {
    hostContext: { theme: 'dark' },
  });
  bridge.onupdatemodelcontext = async params => {
    told.push((params.content?.[0] as { text: string }).text);
    return {};
  };
  const initialized = new Promise<void>(resolve => {
    bridge.oninitialized = () => resolve();
  });
  await bridge.connect(hostSide);
  const app = new App(APP_INFO, {}, { autoResize: false });
  const realConnect = app.connect.bind(app);
  app.connect = () => realConnect(appSide);
  render(<MetronomeApp app={app} />);
  await act(() => initialized);
  return { bridge, told };
}

describe('the app', () => {
  it('shows the tool’s rhythm in its one layout, takes the host’s theme, and saves nothing', async () => {
    const { bridge } = await mountApp();
    await act(() => bridge.sendToolInput({ arguments: { bpm: 92, beats: 7 } }));
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveTextContent('92'));
    expect(document.querySelectorAll('.metronome-pad')).toHaveLength(7);
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Metronome' })).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.queryByRole('button', { name: 'Shortcuts' })).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('keeps Sound and Volume in Advanced', async () => {
    await mountApp();
    expect(screen.queryByRole('combobox', { name: 'Sound' })).toBeNull();
    act(() => screen.getByRole('button', { name: 'Advanced' }).click());
    expect(screen.getByRole('combobox', { name: 'Sound' })).toBeInTheDocument();
  });

  it('tells the model what the user changes, once they stop, and not what the host gave', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { bridge, told } = await mountApp();
      const args = { bpm: 92 };
      await act(() => bridge.sendToolInput({ arguments: args }));
      await act(async () => { await vi.advanceTimersByTimeAsync(REPORT_DELAY_MS * 2); });
      expect(told).toEqual([]);
      for (let i = 0; i < 3; i++) act(() => screen.getByRole('button', { name: 'Faster' }).click());
      await act(async () => { await vi.advanceTimersByTimeAsync(REPORT_DELAY_MS * 2); });
      expect(told).toEqual(['The user\'s metronome is now at 95 bpm, 4 beats, 1 click a beat, stopped. To change it, call show_metronome with this rhythm as `rhythm`.']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops and lets the audio go when the host takes it away', async () => {
    const { bridge } = await mountApp();
    act(() => screen.getByRole('button', { name: 'Start' }).click());
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    await act(() => bridge.teardownResource({}));
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(closed).toBe(1);
  });
});
