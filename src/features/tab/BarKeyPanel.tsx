'use client';

import { useRef } from 'react';
import { KeyPicker } from '@/components/KeyPicker';
import { prettyNote } from '@/lib/theory/notes';
import { usePanelClose, usePanelInside } from './barPanel';
import { keyOf, keyOfTonic, keyTonic, type Key } from '@/lib/theory/keys';
import { changesKey, keyAt, type Part } from './clip';

/**
 * The panel over the tab that sets the key signature from one bar on (issue #122), opened by the
 * palette's key signature button or a press on a drawn key signature, as the time signature's panel
 * is: Major or Minor, and the key on the shared piano `KeyPicker`.
 */
export function BarKeyPanel({ clip, bar, x, y, onChange, onClose }: {
  clip: Part;
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

  usePanelClose(boxRef, onClose);

  // Major or Minor keeps the key signature: G major becomes E minor, its relative.
  const setMinor = (m: boolean) => onChange(keyOf(key.fifths, m));
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
