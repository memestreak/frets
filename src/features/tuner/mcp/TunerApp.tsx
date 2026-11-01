/**
 * The tuner as an MCP App (#283): the compact tuner (`ChatTuner`) in a host's frame. A first test build: it
 * listens only when Listen is pressed, and says what the host allowed, to find out which chat apps
 * let it hear the mic. The string buttons play the acoustic recordings built into the app.
 */
import { App, applyDocumentTheme, type McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { useEffect, useState } from 'react';
import { MicListener, type MicStatus } from '@/components/tuner/listener';
import { ChatTuner } from './ChatTuner';

export const APP_INFO = { name: 'Frets tuner', version: '1.0.0' };

/** What the host said about the mic, for the test build's note. */
type HostMic = 'unknown' | 'granted' | 'not granted';

/**
 * Connects to the host, follows its theme, says what it allowed once connected, and lets the mic
 * go on teardown. The returned function stops listening.
 */
function listenToHost(app: App, on: { connected: () => void; teardown: () => void }): () => void {
  const theme = (ctx: McpUiHostContext | undefined) => {
    if (ctx?.theme) applyDocumentTheme(ctx.theme);
  };
  app.addEventListener('hostcontextchanged', theme);
  app.onteardown = () => {
    on.teardown();
    return {};
  };
  void app.connect().then(() => {
    theme(app.getHostContext());
    on.connected();
  });
  return () => {
    app.removeEventListener('hostcontextchanged', theme);
    app.onteardown = undefined;
  };
}

export function TunerApp({ app }: { app: App }) {
  const [listener] = useState(() => new MicListener());
  const [status, setStatus] = useState<MicStatus>('off');
  const [hostMic, setHostMic] = useState<HostMic>('unknown');

  useEffect(() => {
    let live = true;
    const stop = listenToHost(app, {
      connected: () => {
        if (live) setHostMic(app.getHostCapabilities()?.sandbox?.permissions?.microphone ? 'granted' : 'not granted');
      },
      teardown: () => listener.stop(),
    });
    return () => {
      live = false;
      stop();
      listener.stop();
    };
  }, [app, listener]);

  const listening = status === 'on' || status === 'starting';
  const toggle = () => {
    if (listening) {
      listener.stop();
      setStatus('off');
      return;
    }
    setStatus('starting');
    void listener.start().then(error => setStatus(error ?? (listener.listening ? 'on' : 'off')));
  };

  return (
    <ChatTuner
      listener={listener} status={status} onListen={toggle} sound="acoustic" layout="a"
      footer={(
        <p className="text-muted m-0 text-center text-[11px]" data-testid="mic-probe">
          Test build · host mic: {hostMic} · mic: {status}
        </p>
      )}
    />
  );
}
