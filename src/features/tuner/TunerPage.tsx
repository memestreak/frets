'use client';

import { useEffect, useState } from 'react';
import { MicListener, type MicStatus } from '@/components/tuner/listener';
import { TunerPanel } from '@/components/tuner/TunerPanel';

/**
 * The Tuner page: the tuner in a card, its mic listening from the moment
 * the page opens (the browser asks the first time) until it is left.
 */
export default function TunerPage() {
  const [listener] = useState(() => new MicListener());
  const [status, setStatus] = useState<MicStatus>('starting');

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

  return (
    <section className="card tuner-card" aria-labelledby="tuner-title">
      <TunerPanel
        listener={listener} status={status}
        title={<h1 id="tuner-title" className="m-0">Tuner</h1>}
      />
    </section>
  );
}
