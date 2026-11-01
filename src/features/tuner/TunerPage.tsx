'use client';

import { useEffect, useState } from 'react';
import { MicListener, type MicStatus } from '@/components/tuner/listener';
import { TunerPanel } from '@/components/tuner/TunerPanel';
import { useMock, type Mock } from '@/components/mocks/useMock';
import { ChatTuner, type ChatLayout } from './mcp/ChatTuner';

/** Mock (#283): the chat's compact tuner in a chat-wide column, to pick its layout. */
const CHAT_MOCK: Mock = {
  param: 'chat',
  label: 'Chat tuner',
  options: [
    { value: 'page', label: 'The page' },
    { value: 'a', label: 'a · Bar under the note' },
    { value: 'b', label: 'b · Small dial' },
    { value: 'c', label: 'c · Strings as the readout' },
  ],
};

/**
 * The Tuner page: the tuner in a card, its mic listening from the moment
 * the page opens (the browser asks the first time) until it is left.
 */
export default function TunerPage() {
  const [listener] = useState(() => new MicListener());
  const [status, setStatus] = useState<MicStatus>('starting');
  const chat = useMock(CHAT_MOCK);

  useEffect(() => {
    let live = true;
    void listener.start().then(error => {
      if (live) setStatus(error ?? (listener.listening ? 'on' : 'off'));
    });
    return () => {
      live = false;
      listener.stop();
    };
  }, [listener]);

  if (chat !== 'page') {
    const toggle = () => {
      if (listener.listening) {
        listener.stop();
        setStatus('off');
        return;
      }
      setStatus('starting');
      void listener.start().then(error => setStatus(error ?? (listener.listening ? 'on' : 'off')));
    };
    return (
      <div className="mx-auto max-w-[560px]">
        <ChatTuner listener={listener} status={status} onListen={toggle} sound="acoustic" layout={chat as ChatLayout} />
      </div>
    );
  }

  return (
    <section className="card tuner-card" aria-labelledby="tuner-title">
      <TunerPanel
        listener={listener} status={status}
        title={<h1 id="tuner-title" className="m-0">Tuner</h1>}
      />
    </section>
  );
}
