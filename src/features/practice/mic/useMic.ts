'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { heldFor } from './hold';
import { MicListener, micGranted, type MicError } from './listener';

export type MicStatus = 'off' | 'starting' | 'on' | MicError;

interface MicOptions {
  /** False while the trainer has nothing to play, e.g. in Name it. */
  enabled: boolean;
  /** The saved choice: true when the user left the mic on. */
  on: boolean;
  /** Saves the choice. */
  setOn: (on: boolean) => void;
  /**
   * Called with the note held, on every reading while it sounds; returns
   * true once it has judged it, and is not called for that note again
   * until it is played afresh.
   */
  onNote: (midi: number, heldMs: number) => boolean;
}

/**
 * A trainer's microphone: its listener, its status and the button's
 * toggle. Left on, it starts again on the next visit, or when it is
 * enabled again, if the browser still grants the mic; otherwise it saves
 * itself off.
 */
export function useMic({ enabled, on, setOn, onNote }: MicOptions) {
  const [listener] = useState(() => new MicListener());
  const [status, setStatus] = useState<MicStatus>('off');
  const latest = useRef({ on, setOn, onNote });
  useEffect(() => {
    latest.current = { on, setOn, onNote };
  });

  const start = useCallback(async () => {
    setStatus('starting');
    const error = await listener.start();
    if (error) {
      setStatus(error);
      latest.current.setOn(false);
    } else if (listener.listening) {
      setStatus('on');
      latest.current.setOn(true);
    }
  }, [listener]);

  const toggle = () => {
    if (status === 'on' || status === 'starting') {
      listener.stop();
      setStatus('off');
      setOn(false);
    } else {
      void start();
    }
  };

  useEffect(() => {
    let live = true;
    if (enabled && latest.current.on) {
      void micGranted().then(granted => {
        if (!live) return;
        if (granted) void start();
        else latest.current.setOn(false);
      });
    }
    return () => {
      live = false;
      listener.stop();
      setStatus('off');
    };
  }, [enabled, listener, start]);

  useEffect(() => {
    let judged = -1;
    return listener.subscribe(() => {
      const { hold } = listener.getReading();
      if (!hold || hold.since === judged) return;
      if (latest.current.onNote(hold.midi, heldFor(hold))) judged = hold.since;
    });
  }, [listener]);

  return { listener, status, toggle };
}
