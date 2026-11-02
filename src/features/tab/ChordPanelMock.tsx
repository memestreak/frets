'use client';

/**
 * MOCK, not for merging: the chord library from PR #300 (issues #242 and #251), copied here as the
 * Chords panel of the rail mock (PaletteMock.tsx, issue #301). It lists the arrangement's chords (the
 * names over its columns, plus any added here), shows the picked chord's shapes from the Chords page,
 * and inserts the name, the notes or both at the cursor. Nothing is stored: a chord added here is
 * gone on reload, and no `\chord` definitions are written yet.
 */
import { useMemo, useState } from 'react';
import { ChordDiagram, PAGE_LOOK, type DiagramLook } from '@/components/chords/ChordDiagram';
import { findVoicings, voicingKey, type Voicing } from '@/lib/chords/voicings';
import { chordOf, type ChordInfo } from '@/lib/theory/chords';
import { findChord } from '@/lib/theory/chordSearch';
import type { Part } from './clip';
import { columnAt, withColumn, type Cursor } from './editing';
import { writtenStrings } from './notation';

/** Plain ink dots, no degree colours (Jeremy, 2026-11-01). */
const PLAIN_LOOK: DiagramLook = { ...PAGE_LOOK, tone: () => ({ fill: 'var(--ink)', fg: 'var(--surface-raised)' }) };

type InsertWhat = 'name' | 'notes' | 'both';
const INSERT_WHAT: readonly { id: InsertWhat; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'notes', label: 'Notes' },
  { id: 'both', label: 'Both' },
];

/** A chord the panel lists: its name as written, what Frets reads it as (null: plain text), and how often the clip uses it. */
interface Entry {
  name: string;
  chord: ChordInfo | null;
  uses: number;
}

function readName(name: string): ChordInfo | null {
  // A slash chord's shapes are its chord's, for the mock.
  const found = findChord(name.split('/')[0]);
  return found ? chordOf(found.root, found.type) : null;
}

/** The chord names over the clip's columns, in the order they first appear, with how often each is used. */
function songChords(clip: Part): Map<string, number> {
  const uses = new Map<string, number>();
  for (const bar of clip.bars) {
    for (const column of bar.columns) {
      if (column.chord) uses.set(column.chord, (uses.get(column.chord) ?? 0) + 1);
    }
  }
  return uses;
}

/** The tuning low string first, as MIDI, which the voicing search takes. */
const lowFirst = (clip: Part): number[] => [...writtenStrings(clip.tuning)].reverse();

interface ChordPanelProps {
  clip: Part;
  cursor: Cursor;
  /** Whether the cursor is in the tab: off it, Insert does nothing, as the palette does. */
  editing: boolean;
  onInsert: (next: Part) => void;
}

/** The Chords panel's contents (its title is the rail panel's). */
export function ChordPanel({ clip, cursor, editing, onInsert }: ChordPanelProps) {
  const [added, setAdded] = useState<string[]>(['Dsus2']);
  const [picked, setPicked] = useState<string | null>(null);
  const [shapeKey, setShapeKey] = useState<string | null>(null);
  const [what, setWhat] = useState<InsertWhat>('both');
  const [typed, setTyped] = useState('');

  const entries = useMemo<Entry[]>(() => {
    const uses = songChords(clip);
    const names = [...uses.keys(), ...added.filter(n => !uses.has(n))];
    return names.map(name => ({ name, chord: readName(name), uses: uses.get(name) ?? 0 }));
  }, [clip, added]);

  const tuning = useMemo(() => lowFirst(clip), [clip]);
  const current = entries.find(e => e.name === picked) ?? entries[0] ?? null;
  const shapes = useMemo<Voicing[]>(() => {
    if (!current?.chord) return [];
    const v = findVoicings(current.chord, tuning);
    return [...v.open, ...v.moveable].slice(0, 9);
  }, [current, tuning]);
  const shape = shapes.find(s => voicingKey(s) === shapeKey) ?? shapes[0] ?? null;

  const add = () => {
    const name = typed.trim();
    if (!name) return;
    if (!entries.some(e => e.name === name)) setAdded([...added, name]);
    setPicked(name);
    setShapeKey(null);
    setTyped('');
  };

  const insert = () => {
    if (!editing || !current || !columnAt(clip, cursor)) return;
    onInsert(withColumn(clip, cursor, column => {
      const next = what === 'notes' ? column : { ...column, chord: current.name };
      if (what === 'name' || !shape) return next;
      // A voicing is low string first; a column's notes are high e first.
      return { ...next, notes: next.notes.map((_, s) => {
        const fret = shape[shape.length - 1 - s];
        return fret === null ? null : { fret };
      }) };
    }));
  };

  // Presses on the panel's buttons keep the tab's cursor, as the palette's do.
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="chord-panel grid gap-4">
      <input
        className="input" placeholder="Add a chord: Am7, G/B…" aria-label="Add a chord"
        value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }}
      />
      <ul className="chord-panel-list" aria-label="This arrangement's chords">
        {entries.length === 0 && <li className="text-(--ink-muted)">No chords yet.</li>}
        {entries.map(entry => {
          const first = entry.chord ? firstShape(entry.chord, tuning) : null;
          return (
            <li key={entry.name}>
              <button
                type="button" className="chord-panel-entry" aria-pressed={entry === current}
                onMouseDown={keep} onClick={() => { setPicked(entry.name); setShapeKey(null); }}
              >
                <span className="chord-panel-thumb" aria-hidden="true">
                  {entry.chord && first && <ChordDiagram chord={entry.chord} voicing={first} look={PLAIN_LOOK} tuning={tuning} />}
                </span>
                <span className="chord-panel-name">{entry.name}</span>
                {entry.uses === 0
                  ? <span className="chord-panel-unused" role="img" aria-label="Not used" title="Not used in this arrangement">○</span>
                  : <span className="chord-panel-uses" title={`Used ${entry.uses} times`}>{entry.uses}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {current && (
        <div className="grid gap-2">
          <h3 className="chord-panel-heading">Shapes for {current.name}</h3>
          {shapes.length === 0
            ? <p className="text-(--ink-muted)">Frets can&apos;t read this name, so it has no shapes.</p>
            : (
              <div className="chord-panel-shapes">
                {shapes.map(s => (
                  <button
                    key={voicingKey(s)} type="button" className="chord-panel-shape" aria-pressed={s === shape}
                    aria-label={`Shape ${voicingKey(s)}`} onMouseDown={keep} onClick={() => setShapeKey(voicingKey(s))}
                  >
                    <ChordDiagram chord={current.chord!} voicing={s} look={PLAIN_LOOK} tuning={tuning} />
                  </button>
                ))}
              </div>
            )}
        </div>
      )}
      {current && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="group" aria-label="Insert">
            {INSERT_WHAT.map(o => (
              <button key={o.id} type="button" className="seg-opt" aria-pressed={what === o.id} onMouseDown={keep} onClick={() => setWhat(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onMouseDown={keep} onClick={insert}>Insert</button>
        </div>
      )}
    </div>
  );
}

function firstShape(chord: ChordInfo, tuning: number[]): Voicing | null {
  const v = findVoicings(chord, tuning);
  return v.open[0] ?? v.moveable[0] ?? null;
}
