'use client';

/**
 * The browser's MIDI outputs, through Web MIDI (`docs/specs/2026-11-09-tab-midi-out-design.md`), for
 * Settings' MIDI output list and the port Tab's playback goes out of. Access is asked for once per page
 * (the browser asks the person the first time), only once something needs it: a port picked, or the
 * section shown.
 */
import { useEffect, useState } from 'react';

export type MidiAccessState =
  /** Not asked yet, or waiting for the person's answer. */
  | 'pending'
  /** The browser has no Web MIDI (Safari). */
  | 'unsupported'
  /** The person, or the page's settings, refused it. */
  | 'denied'
  | 'ready';

export interface MidiOutputs {
  state: MidiAccessState;
  /** Every output the browser reports, by name, in its order. */
  outputs: MIDIOutput[];
}

let asked: Promise<MIDIAccess> | null = null;

/** Whether the browser has Web MIDI (Safari has none). */
const supported = () => typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';

/** Web MIDI access, asked for once; the same answer for everyone after. */
function access(): Promise<MIDIAccess> {
  asked ??= navigator.requestMIDIAccess({ sysex: false });
  return asked;
}

/** Forgets the access asked for: for tests. */
export function forgetMidiAccess() {
  asked = null;
}

const outputsOf = (midi: MIDIAccess) => [...midi.outputs.values()].filter(o => o.state !== 'disconnected');

/** The MIDI outputs, kept up to date as ports come and go; nothing is asked for until `wanted`. */
export function useMidiOutputs(wanted: boolean): MidiOutputs {
  const [found, setFound] = useState<MidiOutputs>({ state: 'pending', outputs: [] });
  const has = supported();
  useEffect(() => {
    if (!wanted || !has) return;
    const asking = access();
    let live = true;
    let midi: MIDIAccess | null = null;
    const update = () => {
      if (live && midi) setFound({ state: 'ready', outputs: outputsOf(midi) });
    };
    asking.then(
      m => {
        midi = m;
        m.addEventListener('statechange', update);
        update();
      },
      () => {
        if (live) setFound({ state: 'denied', outputs: [] });
      },
    );
    return () => {
      live = false;
      midi?.removeEventListener('statechange', update);
    };
  }, [wanted, has]);
  return has ? found : { state: 'unsupported', outputs: [] };
}

/**
 * The port playback goes out of: the output named `name`, found among the browser's. `missing` says
 * a port is picked and can't be had (gone, refused, no Web MIDI), for the footer's ⚠; still waiting
 * for the browser's answer is not missing.
 */
export function useMidiPort(name: string): { port: MIDIOutput | null; missing: string | null } {
  const { state, outputs } = useMidiOutputs(name !== '');
  if (name === '') return { port: null, missing: null };
  const port = outputs.find(o => o.name === name) ?? null;
  if (port) return { port, missing: null };
  if (state === 'pending') return { port: null, missing: null };
  const why = state === 'unsupported' ? 'this browser has no Web MIDI'
    : state === 'denied' ? 'the browser was not allowed to use MIDI devices'
    : 'it isn’t connected';
  return { port: null, missing: `MIDI output “${name}” can’t be used: ${why}. The built-in sound plays instead.` };
}
