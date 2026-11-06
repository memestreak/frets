'use client';

/**
 * The Chord dialog (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issue #251), opened from the
 * Chords panel. Look up: type a name, see its shapes (creating a chord from it comes later). Edit: a
 * chord of the track's set, its shape marked; another shape picked and OK gives the chord that shape.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { Modal } from '@/components/Modal';
import { shapeKey, type Shape } from '@/lib/chords/shapes';
import { chordDefOf } from './chordSet';
import type { Part } from './clip';
import { chordOfName, lowFirst, PLAIN_LOOK, shapesOf, toShape } from './chordShapes';

/** What the dialog is open for: looking a name up, or a chord of the set (by name) to change. */
export type ChordDialogMode = { kind: 'lookUp' } | { kind: 'edit'; name: string };

/** How many shapes the dialog shows. */
const MAX_SHAPES = 12;

interface ChordDialogProps {
  mode: ChordDialogMode | null;
  /** The part: its tuning, and its `\chord` definitions. */
  clip: Part;
  /** Edit's OK: the chord's new shape, low string first. */
  onShape: (name: string, shape: Shape) => void;
  /** Sounds a shape as it is picked (when the panel's Hear is on). */
  onHear: (shape: Shape) => void;
  onClose: () => void;
}

export function ChordDialog({ mode, clip, onShape, onHear, onClose }: ChordDialogProps) {
  return (
    <Modal open={mode !== null} onClose={onClose} title={mode?.kind === 'edit' ? `Edit ${mode.name}` : 'Look up a chord'} className="chord-dialog">
      {/* Keyed by what it opened for, so each opening starts afresh. */}
      {mode && <ChordDialogBody key={mode.kind === 'edit' ? `edit:${mode.name}` : 'lookUp'} mode={mode} clip={clip} onShape={onShape} onHear={onHear} onClose={onClose} />}
    </Modal>
  );
}

function ChordDialogBody({ mode, clip, onShape, onHear, onClose }: Omit<ChordDialogProps, 'mode'> & { mode: ChordDialogMode }) {
  const editing = mode.kind === 'edit';
  /** Look up's typed name. */
  const [typed, setTyped] = useState('');
  const field = useRef<HTMLInputElement>(null);
  // Look up takes the keys at once: after the dialog, which focuses itself as it opens.
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const name = editing ? mode.name : typed.trim();
  const tuning = useMemo(() => lowFirst(clip), [clip]);
  const chord = useMemo(() => (name ? chordOfName(name) : null), [name]);
  const def = editing ? chordDefOf(clip.chords, mode.name) : undefined;
  const stored = def?.frets ? toShape(def.frets) : null;
  const shapes = useMemo(() => {
    const found = chord ? shapesOf(chord, tuning) : [];
    // A stored shape the Chords page doesn't have shows first.
    return stored && !found.some(s => shapeKey(s) === shapeKey(stored)) ? [stored, ...found] : found;
  }, [chord, tuning, stored]);
  /** The shape picked in the dialog; at first, the chord's own. */
  const [chosen, setChosen] = useState<Shape | null>(stored);
  const at = chosen ? shapes.findIndex(s => shapeKey(s) === shapeKey(chosen)) : -1;

  const choose = (shape: Shape) => {
    setChosen(shape);
    onHear(shape);
  };
  const step = (by: 1 | -1) => {
    if (shapes.length > 0) choose(shapes[(Math.max(0, at) + by + shapes.length) % shapes.length]);
  };
  const ok = () => {
    if (editing && chosen && (!stored || shapeKey(chosen) !== shapeKey(stored))) onShape(mode.name, chosen);
    onClose();
  };

  return (
    <div className="chord-dialog-body">
      {!editing && (
        <input
          ref={field} className="input" aria-label="Chord name" placeholder="Am7, G/B…"
          value={typed} onChange={e => { setTyped(e.target.value); setChosen(null); }}
        />
      )}
      <div className="chord-panel-row">
        <h4 className="chord-panel-label">Shape</h4>
        {shapes.length > 1 && (
          <span className="chord-panel-stepper">
            <button type="button" className="chord-panel-step" aria-label="Previous shape" onClick={() => step(-1)}>‹</button>
            {at >= 0 && <span>{at + 1} of {shapes.length}</span>}
            <button type="button" className="chord-panel-step" aria-label="Next shape" onClick={() => step(1)}>›</button>
          </span>
        )}
      </div>
      {!name && <p className="chord-panel-note">Type a chord name to see its shapes.</p>}
      {name && !chord && !stored && <p className="chord-panel-note">“{name}” isn’t a chord name, so it has no shapes.</p>}
      {chord && (
        <div className="chord-dialog-shapes" role="group" aria-label="Shapes">
          {shapes.slice(0, MAX_SHAPES).map(s => (
            <button
              key={shapeKey(s)} type="button" className="chord-panel-shape" aria-pressed={chosen !== null && shapeKey(s) === shapeKey(chosen)}
              aria-label={`Shape ${shapeKey(s)}`} onClick={() => choose(s)}
            >
              <ChordDiagram chord={chord} shape={s} look={PLAIN_LOOK} tuning={tuning} />
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={ok}>OK</button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  );
}
