'use client';

import { useEffect, useRef } from 'react';
import { KeyPicker } from '@/components/KeyPicker';
import { prettyNote } from '@/lib/notation';
import { usePanelInside } from './BarTimePanel';
import { changesKey, keyAt, keyTonic, MAJOR_NAMES, MAX_FIFTHS, MINOR_NAMES, type Clip, type Key } from './clip';

const PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function pitchClass(name: string): number {
  return (PITCH[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12;
}

/** The key with this tonic, spelled as the tile names it where a key signature can (D♯ major is written E♭). */
export function keyOfTonic(tonic: string, minor: boolean): Key {
  const names = minor ? MINOR_NAMES : MAJOR_NAMES;
  let at = names.indexOf(tonic);
  if (at < 0) at = names.findIndex(n => pitchClass(n) === pitchClass(tonic));
  const fifths = at - MAX_FIFTHS;
  return minor ? { fifths, minor: true } : { fifths };
}

/**
 * The panel over the tab that sets the key signature from one bar on (issue #122), opened by the
 * palette's key signature button or a press on a drawn key signature, as the time signature's panel
 * is: Major or Minor, and the key on the shared piano `KeyPicker`.
 */
export function BarKeyPanel({ clip, bar, x, y, onChange, onClose }: {
  clip: Clip;
  bar: number;
  x: number;
  y: number;
  /** The key from this bar on, or null to take a later bar's change away. */
  onChange: (key: Key | null) => void;
  onClose: (byKey: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  usePanelInside(boxRef, x);
  const key = keyAt(clip, bar);
  const minor = !!key.minor;
  const changed = changesKey(clip, bar);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) onClose(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Major or Minor keeps the key signature: G major becomes E minor, its relative.
  const setMinor = (m: boolean) => onChange(m ? { fifths: key.fifths, minor: true } : { fifths: key.fifths });
  const caption = bar === 0 ? 'Key signature' : `Key signature from bar ${bar + 1}`;
  return (
    <div ref={boxRef} className="tab-bar-time card tab-bar-key" style={{ left: x, top: y }} role="dialog" aria-label={caption}>
      <span className="tab-bar-time-title">
        {caption}: {prettyNote(keyTonic(key))} {minor ? 'minor' : 'major'}
      </span>
      <span className="seg" role="group" aria-label="Major or minor">
        {[false, true].map(m => (
          <button key={String(m)} type="button" className="seg-opt" aria-pressed={minor === m} onClick={() => setMinor(m)}>
            {m ? 'Minor' : 'Major'}
          </button>
        ))}
      </span>
      <KeyPicker
        label="Key" value={keyTonic(key)}
        resolve={note => keyTonic(keyOfTonic(note, minor))}
        onPick={note => onChange(keyOfTonic(note, minor))}
      />
      {bar > 0 && (
        <button type="button" className="btn btn-secondary tab-bar-time-remove" disabled={!changed} onClick={() => onChange(null)}>
          Remove the change
        </button>
      )}
    </div>
  );
}
