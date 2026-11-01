import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { MicError, MicReading } from '@/components/tuner/listener';
import { CHAT_TEXT } from '@/features/tuner/mcp/ChatTuner';
import { APP_INFO, TunerApp } from '@/features/tuner/mcp/TunerApp';

/* The tuner's MCP App (#283): Listen and Stop, the reading, a refused mic, the host's theme and teardown. */

/** Stands in for the microphone: the test says what it hears. */
const mic = vi.hoisted(() => ({
  startResult: null as MicError | null,
  starts: 0,
  listener: null as null | { listening: boolean; emit: (r: MicReading) => void },
}));

vi.mock('@/components/tuner/listener', async importOriginal => {
  const real = await importOriginal<typeof import('@/components/tuner/listener')>();
  class FakeListener {
    private reading: MicReading = real.SILENT;
    private readonly subscribers = new Set<() => void>();
    listening = false;
    constructor() {
      mic.listener = this;
    }
    async start() {
      mic.starts += 1;
      this.listening = mic.startResult == null;
      return mic.startResult;
    }
    stop() {
      this.listening = false;
    }
    subscribe = (fn: () => void) => {
      this.subscribers.add(fn);
      return () => { this.subscribers.delete(fn); };
    };
    getReading = () => this.reading;
    emit(reading: MicReading) {
      this.reading = reading;
      this.subscribers.forEach(fn => fn());
    }
  }
  return { ...real, MicListener: FakeListener };
});

const hearPitch = (p: number) => act(() => {
  mic.listener!.emit({ level: 0.5, pitch: p, midi: Math.round(p), hold: null });
});
const cents = () => screen.getByTestId('tuner-cents');
const note = () => screen.getByTestId('tuner-note');

/** The app in a stand-in host, joined by an in-memory pipe in place of postMessage. */
async function mountApp() {
  const [appSide, hostSide] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(null, { name: 'host', version: '1' }, {}, { hostContext: { theme: 'dark' } });
  const initialized = new Promise<void>(resolve => {
    bridge.oninitialized = () => resolve();
  });
  await bridge.connect(hostSide);
  const app = new App(APP_INFO, {}, { autoResize: false });
  const realConnect = app.connect.bind(app);
  app.connect = () => realConnect(appSide);
  render(<TunerApp app={app} />);
  await act(() => initialized);
  return bridge;
}

beforeEach(() => {
  mic.startResult = null;
  mic.starts = 0;
  document.documentElement.removeAttribute('data-theme');
});

describe('the tuner app', () => {
  it('waits for Listen before asking for the mic, and takes the host’s theme', async () => {
    await mountApp();
    expect(mic.starts).toBe(0);
    expect(cents()).toHaveTextContent(CHAT_TEXT.off);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('reads the string heard once listening, and drops the reading on Stop', async () => {
    await mountApp();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Listen' })); });
    expect(mic.starts).toBe(1);
    expect(cents()).toHaveTextContent('Play a string');
    await hearPitch(45 - 0.08);
    expect(note()).toHaveTextContent('A2');
    expect(cents()).toHaveTextContent('8¢ flat');
    expect(screen.getByRole('button', { name: 'Play A₂' })).toHaveAttribute('data-heard', 'true');
    await hearPitch(45.02);
    expect(cents()).toHaveTextContent('In tune');
    expect(screen.getByRole('button', { name: 'Play A₂' })).toHaveAttribute('data-in-tune', 'true');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })); });
    expect(mic.listener!.listening).toBe(false);
    expect(note()).toHaveTextContent('–');
    expect(cents()).toHaveTextContent(CHAT_TEXT.off);
  });

  it('says the strings still play when the chat app keeps the mic from it', async () => {
    mic.startResult = 'denied';
    await mountApp();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Listen' })); });
    expect(cents()).toHaveTextContent(CHAT_TEXT.denied);
    expect(screen.getByRole('button', { name: 'Listen' })).toBeInTheDocument();
  });

  it('lets the mic go when the host takes the app away', async () => {
    const bridge = await mountApp();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Listen' })); });
    expect(mic.listener!.listening).toBe(true);
    await act(() => bridge.teardownResource({}));
    expect(mic.listener!.listening).toBe(false);
    expect(screen.getByRole('button', { name: 'Listen' })).toBeInTheDocument();
  });
});
