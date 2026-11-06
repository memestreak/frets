'use client';

/**
 * The Chord dialog (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issue #251), opened from the
 * Chords panel. Add: type a name (or take one the cursor column's notes are), see its shapes, the
 * cursor column's fingering first, and add the chord to the track's set with the shape picked. Edit: a
 * chord of the track's set, its shape marked; another shape picked and OK gives the chord that shape.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { Modal } from '@/components/Modal';
import { shapeKey, type Shape } from '@/lib/chords/shapes';
import { chordDefOf } from './chordSet';
import type { Column, Part } from './clip';
import { chordOfName, chordToDraw, fits, fretsOfColumn, lowFirst, namesForColumn, PLAIN_LOOK, shapesOf, toFrets, toShape } from './chordShapes';

/** What the dialog is open for: adding a chord to the set, or a chord of the set (by name) to change. */
export type ChordDialogMode = { kind: 'add' } | { kind: 'edit'; name: string };

/** How many shapes the dialog shows. */
const MAX_SHAPES = 12;

interface ChordDialogProps {
  mode: ChordDialogMode | null;
  /** The part: its tuning, and its `\chord` definitions. */
  clip: Part;
  /** The cursor's column: Add offers what its notes are, and their fingering as a shape. */
  column: Column | null;
  /** The names already in the track's Chord set, which Add doesn't offer to add again. */
  taken: readonly string[];
  /** Add: the new chord's name and shape (high e first), null for a name with no shape. */
  onAdd: (name: string, frets: (number | null)[] | null) => void;
  /** Edit's OK: the chord's new shape, low string first. */
  onShape: (name: string, shape: Shape) => void;
  /** Sounds a shape as it is picked (when the panel's Hear is on). */
  onHear: (shape: Shape) => void;
  onClose: () => void;
}

export function ChordDialog({ mode, ...props }: ChordDialogProps) {
  return (
    <Modal open={mode !== null} onClose={props.onClose} title={mode?.kind === 'edit' ? `Edit ${mode.name}` : 'Add a chord'} className="chord-dialog">
      {/* Keyed by what it opened for, so each opening starts afresh. */}
      {mode && <ChordDialogBody key={mode.kind === 'edit' ? `edit:${mode.name}` : 'add'} mode={mode} {...props} />}
    </Modal>
  );
}

function ChordDialogBody({ mode, clip, column, taken, onAdd, onShape, onHear, onClose }: Omit<ChordDialogProps, 'mode'> & { mode: ChordDialogMode }) {
  const editing = mode.kind === 'edit';
  /** Add's typed name. */
  const [typed, setTyped] = useState('');
  const field = useRef<HTMLInputElement>(null);
  // Add takes the keys at once: after the dialog, which focuses itself as it opens.
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const name = editing ? mode.name : typed.trim();
  const tuning = useMemo(() => lowFirst(clip), [clip]);
  const chord = useMemo(() => (name ? chordOfName(name) : null), [name]);
  const def = editing ? chordDefOf(clip.chords, mode.name) : undefined;
  const stored = def?.frets ? toShape(def.frets) : null;
  /** Add: what the cursor column's notes are, and their fingering. */
  const names = useMemo(() => (editing ? [] : namesForColumn(clip, column)), [editing, clip, column]);
  const atCursor = useMemo(() => {
    const frets = editing ? null : fretsOfColumn(column);
    return frets ? toShape(frets) : null;
  }, [editing, column]);
  /** A shape Edit or Add has besides the name's (the definition's own, or the cursor column's) shows first. */
  const own = stored ?? atCursor;
  const shapes = useMemo(() => {
    const found = chord ? shapesOf(chord, tuning) : [];
    return own && !found.some(s => shapeKey(s) === shapeKey(own)) ? [own, ...found] : found;
  }, [chord, tuning, own]);
  /** The shape picked in the dialog; at first, Edit's chord's own. */
  const [picked, setPicked] = useState<Shape | null>(stored);
  /** Add picks the cursor column's fingering at first, unless the chord typed has other notes; else the name's first shape. */
  const first = atCursor && (!chord || fits(chord, atCursor, tuning)) ? atCursor : (shapes.find(s => s !== atCursor) ?? null);
  const chosen = editing ? picked : picked ?? first;
  const at = chosen ? shapes.findIndex(s => shapeKey(s) === shapeKey(chosen)) : -1;
  const isTaken = !editing && taken.includes(name);

  const choose = (shape: Shape) => {
    setPicked(shape);
    onHear(shape);
  };
  const step = (by: 1 | -1) => {
    if (shapes.length > 0) choose(shapes[(Math.max(0, at) + by + shapes.length) % shapes.length]);
  };
  const ok = () => {
    if (editing && chosen && (!stored || shapeKey(chosen) !== shapeKey(stored))) onShape(mode.name, chosen);
    onClose();
  };
  const add = () => {
    if (editing || !name || isTaken) return;
    onAdd(name, chosen ? toFrets(chosen) : null);
    onClose();
  };
  const type = (text: string) => {
    setTyped(text);
    setPicked(null);
  };

  return (
    <div className="chord-dialog-body">
      {!editing && (
        <input
          ref={field} className="input" aria-label="Chord name" placeholder={names[0] ?? 'Am7, G/B…'}
          value={typed} onChange={e => type(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
      )}
      {names.length > 0 && (
        <div className="chord-dialog-names">
          <span className="chord-panel-note" id="chord-dialog-names">The notes at the cursor are</span>
          <div className="chord-panel-chips" role="group" aria-labelledby="chord-dialog-names">
            {names.map(n => (
              <button key={n} type="button" className="chord-panel-chip" aria-pressed={n === name} onClick={() => { type(n); field.current?.focus(); }}>
                {n}
              </button>
            ))}
          </div>
        </div>
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
      {!name && !own && <p className="chord-panel-note">Type a chord name to see its shapes.</p>}
      {name && !chord && !own && <p className="chord-panel-note">“{name}” isn’t a chord name, so it has no shapes.</p>}
      {shapes.length > 0 && (
        <div className="chord-dialog-shapes" role="group" aria-label="Shapes">
          {shapes.slice(0, MAX_SHAPES).map(s => {
            const drawn = chordToDraw(clip, name, s);
            const here = atCursor !== null && shapeKey(s) === shapeKey(atCursor);
            return (
              <button
                key={shapeKey(s)} type="button" className="chord-panel-shape" aria-pressed={chosen !== null && shapeKey(s) === shapeKey(chosen)}
                aria-label={`Shape ${shapeKey(s)}${here ? ', at the cursor' : ''}`} onClick={() => choose(s)}
              >
                {drawn ? <ChordDiagram chord={drawn} shape={s} look={PLAIN_LOOK} tuning={tuning} /> : <span className="chord-dialog-caption">{shapeKey(s)}</span>}
                {here && <span className="chord-dialog-caption" aria-hidden="true">At the cursor</span>}
              </button>
            );
          })}
        </div>
      )}
      {isTaken && <p className="chord-panel-note">“{name}” is already in this track’s chords.</p>}
      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={ok}>OK</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{name && !isTaken ? 'Cancel' : 'Close'}</button>
            {name && !isTaken && <button type="button" className="btn btn-primary" onClick={add}>Add {name}</button>}
          </>
        )}
      </div>
    </div>
  );
}
