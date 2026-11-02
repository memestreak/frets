/**
 * The tuner as an MCP App (#283): the compact tuner (`ChatTuner`) in a host's frame. It asks for the
 * mic only when Listen is pressed, and lets it go on Stop or when the host takes the app away. The
 * strings play the acoustic guitar recordings built into the app (`mcp/apps/tuner/main.tsx`). Claude
 * is told nothing back (Jeremy, 2026-11-01).
 */
import type { App } from '@modelcontextprotocol/ext-apps';
import { useEffect, useState } from 'react';
import { MicListener, type MicStatus } from '@/components/tuner/listener';
import { useLetGoAfterUse } from '@/hooks/useLetGoAfterUse';
import { appInfo, listenToHost } from '@/mcp/app';
import { ChatTuner } from './ChatTuner';

export const APP_INFO = appInfo('tuner');

export function TunerApp({ app }: { app: App }) {
  const [listener] = useState(() => new MicListener());
  const [status, setStatus] = useState<MicStatus>('off');
  useLetGoAfterUse();

  useEffect(() => {
    const stop = listenToHost(app, {
      teardown: () => {
        listener.stop();
        setStatus('off');
      },
    });
    return () => {
      stop();
      listener.stop();
    };
  }, [app, listener]);

  const toggle = () => {
    if (status === 'on' || status === 'starting') {
      listener.stop();
      setStatus('off');
      return;
    }
    setStatus('starting');
    void listener.start().then(error => setStatus(error ?? (listener.listening ? 'on' : 'off')));
  };

  return <ChatTuner listener={listener} status={status} onListen={toggle} sound="acoustic" />;
}
