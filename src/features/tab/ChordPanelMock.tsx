'use client';

/**
 * MOCK, not for merging (issue #251, step 2 of the chords-in-Tab plan): the Chords panel, in three
 * places against the tool rail behind `?mock=a|b|c` while Jeremy picks one. The panel's contents are
 * the same in each: the chord at the cursor (its name and shapes, the current one marked), names for
 * the column's notes, this track's chords, and Insert. Picking a shape writes the chord's `\chord`
 * definition, as the built panel will. Not yet: hearing the chord, keys.
 */
import { useMemo, useState } from 'react';
import { ChordDiagram, PAGE_LOOK, type DiagramLook } from '@/components/chords/ChordDiagram';
import { useMock, type Mock } from '@/components/mocks/useMock';
import { findShapes, shapeKey, type Shape } from '@/lib/chords/shapes';
import { nameNotes } from '@/lib/theory/chordNames';
import { chordOf, withBass, type ChordInfo } from '@/lib/theory/chords';
import { readChordName } from '@/lib/theory/chordSearch';
import { pitchClassOf } from '@/lib/theory/notes';
import { chordDefOf, chordSet, type ChordDef } from './chordSet';
import type { Part, Track } from './clip';
import { columnAt, withColumn, type Cursor } from './editing';
import { writtenStrings } from './notation';

export const CHORDS_MOCK: Mock = {
  param: 'mock',
  label: 'Chords panel',
  options: [
    // The page as it ships today: no Chords panel.
    { value: 'off', label: 'Off' },
    { value: 'a', label: 'a Rail panel' },
    { value: 'b', label: 'b Under the tools' },
    { value: 'c', label: 'c Right of the clip' },
  ],
};

export type ChordsLayout = 'off' | 'a' | 'b' | 'c';

export function useChordsMock(): ChordsLayout {
  return useMock(CHORDS_MOCK) as ChordsLayout;
}

/** Plain ink dots: no degree colours (Jeremy, 2026-11-01). */
const PLAIN_LOOK: DiagramLook = { ...PAGE_LOOK, tone: () => ({ fill: 'var(--ink)', fg: 'var(--surface-raised)' }) };

/** The chord a name means, with its bass for a slash chord; null for a name that isn't a chord ("N.C."). */
function chordOfName(name: string): ChordInfo | null {
  const reading = readChordName(name);
  if (!reading) return null;
  const chord = chordOf(reading.root, reading.type);
  return reading.bass ? withBass(chord, pitchClassOf(reading.bass)) : chord;
}

/** A voicing (low string first) as a definition's frets (high e first), and back. */
const toFrets = (v: Shape): (number | null)[] => [...v].reverse();
const toVoicing = (frets: readonly (number | null)[]): Shape => [...frets].reverse();

/** The track with `name`'s definition set to `shape`: the last of that name changed, its other properties kept; else one added. */
function withChordShape(part: Part, name: string, shape: Shape): Part {
  const chords = part.chords ?? [];
  const at = chords.findLastIndex(def => def.name === name);
  const def: ChordDef = { ...(at >= 0 ? chords[at] : { name }), frets: toFrets(shape) };
  return { ...part, chords: at >= 0 ? chords.map((d, i) => (i === at ? def : d)) : [...chords, def] };
}

type InsertWhat = 'name' | 'notes' | 'both';
const INSERT_WHAT: readonly { id: InsertWhat; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'notes', label: 'Notes' },
  { id: 'both', label: 'Both' },
];

interface ChordPanelProps {
  clip: Part;
  /** The whole track, whose Chord set the panel lists (every Voice's names). */
  track: Track;
  cursor: Cursor;
  /** The chord Edit opened the panel at; the cursor's column's chord otherwise. */
  at: string | null;
  onChange: (next: Part) => void;
}

/** The Chords panel's contents, the same in every layout. */
export function ChordPanel({ clip, track, cursor, at, onChange }: ChordPanelProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [what, setWhat] = useState<InsertWhat>('both');
  const column = columnAt(clip, cursor);
  const name = picked ?? at ?? column?.chord ?? null;
  const [typed, setTyped] = useState<string | null>(null);

  const tuning = useMemo(() => [...writtenStrings(clip.tuning)].reverse(), [clip.tuning]);
  const set = useMemo(() => chordSet({ ...track, chords: clip.chords }), [track, clip.chords]);
  const chord = name ? chordOfName(name) : null;
  const shapes = useMemo<Shape[]>(() => {
    if (!chord) return [];
    const v = findShapes(chord, tuning);
    return [...v.open, ...v.moveable];
  }, [chord, tuning]);
  const def = name ? chordDefOf(clip.chords, name) : undefined;
  const current = def?.frets ? toVoicing(def.frets) : null;
  const currentKey = current ? shapeKey(current) : null;
  const index = shapes.findIndex(s => shapeKey(s) === currentKey);
  // A stored shape the list doesn't have still shows, first.
  const shown = current && index < 0 ? [current, ...shapes] : shapes;
  const shownIndex = current ? Math.max(0, index < 0 ? 0 : index) : -1;

  // Names for the notes in the cursor's column.
  const names = useMemo(() => {
    const open = writtenStrings(clip.tuning);
    const pitches = (column?.notes ?? []).flatMap((n, s) => (n && n.fret !== null ? [open[s] + (clip.capo ?? 0) + n.fret] : []));
    if (pitches.length < 2) return [];
    return nameNotes(pitches, Math.min(...pitches)).slice(0, 4);
  }, [column, clip.tuning, clip.capo]);

  const pickShape = (shape: Shape) => { if (name) onChange(withChordShape(clip, name, shape)); };
  const step = (by: 1 | -1) => {
    if (shown.length === 0) return;
    pickShape(shown[(Math.max(0, shownIndex) + by + shown.length) % shown.length]);
  };

  const insert = () => {
    if (!name || !column) return;
    const shape = current ?? shapes[0] ?? null;
    let next = withColumn(clip, cursor, col => {
      const named = what === 'notes' ? col : { ...col, chord: name };
      if (what === 'name' || !shape) return named;
      return { ...named, notes: toFrets(shape).map(fret => (fret === null ? null : { fret })) };
    });
    if (!def && shape && what !== 'notes') next = withChordShape(next, name, shape);
    onChange(next);
  };

  const rename = () => {
    const text = (typed ?? '').trim();
    setTyped(null);
    if (!text || !column) return;
    setPicked(text);
    onChange(withColumn(clip, cursor, col => ({ ...col, chord: text })));
  };

  // Presses on the panel keep the tab's focus, and so its cursor, as the palette's do.
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="chord-panel">
      <label className="chord-panel-field">
        <span className="chord-panel-label">Chord</span>
        <input
          className="input" aria-label="Chord name" placeholder="Am7, G/B…"
          value={typed ?? name ?? ''} onChange={e => setTyped(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setTyped(null); }} onBlur={() => setTyped(null)}
        />
      </label>

      {name && (
        <section className="chord-panel-section" aria-label="Shapes">
          <div className="chord-panel-row">
            <h3 className="chord-panel-label">Shape</h3>
            {shown.length > 0 && (
              <span className="chord-panel-stepper">
                <button type="button" className="chord-panel-step" aria-label="Previous shape" onMouseDown={keep} onClick={() => step(-1)}>‹</button>
                <span>{shownIndex >= 0 ? `${shownIndex + 1} of ${shown.length}` : `${shown.length}`}</span>
                <button type="button" className="chord-panel-step" aria-label="Next shape" onMouseDown={keep} onClick={() => step(1)}>›</button>
              </span>
            )}
          </div>
          {!chord && <p className="chord-panel-note">“{name}” isn’t a chord name, so it has no shapes.</p>}
          {chord && (
            <div className="chord-panel-shapes">
              {shown.slice(0, 9).map((s, i) => (
                <button
                  key={shapeKey(s)} type="button" className="chord-panel-shape" aria-pressed={i === shownIndex}
                  aria-label={`Shape ${shapeKey(s)}`} onMouseDown={keep} onClick={() => pickShape(s)}
                >
                  <ChordDiagram chord={chord} shape={s} look={PLAIN_LOOK} tuning={tuning} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {names.length > 0 && (
        <section className="chord-panel-section" aria-label="Names for these notes">
          <h3 className="chord-panel-label">These notes are</h3>
          <div className="chord-panel-chips">
            {names.map(n => (
              <button
                key={n.symbol} type="button" className="chord-panel-chip" aria-pressed={n.symbol === name} title={n.why}
                onMouseDown={keep} onClick={() => { setPicked(n.symbol); onChange(withColumn(clip, cursor, col => ({ ...col, chord: n.symbol }))); }}
              >
                {n.symbol}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="chord-panel-section" aria-label="This track's chords">
        <h3 className="chord-panel-label">This track’s chords</h3>
        {set.length === 0 && <p className="chord-panel-note">None yet: type a name above.</p>}
        <ul className="chord-panel-list">
          {set.map(entry => {
            const c = chordOfName(entry.name);
            const v = entry.def?.frets ? toVoicing(entry.def.frets) : null;
            return (
              <li key={entry.name}>
                <button
                  type="button" className="chord-panel-entry" aria-pressed={entry.name === name}
                  onMouseDown={keep} onClick={() => setPicked(entry.name)}
                >
                  <span className="chord-panel-thumb" aria-hidden="true">
                    {c && v && <ChordDiagram chord={c} shape={v} look={PLAIN_LOOK} tuning={tuning} />}
                  </span>
                  <span className="chord-panel-name">{entry.name}</span>
                  {entry.uses === 0
                    ? <span className="chord-panel-unused" role="img" aria-label="Not used" title="Not used in this track">○</span>
                    : <span className="chord-panel-uses" title={`Used ${entry.uses} times`}>{entry.uses}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {name && (
        <div className="chord-panel-insert">
          <div className="seg" role="group" aria-label="Insert">
            {INSERT_WHAT.map(o => (
              <button key={o.id} type="button" className="seg-opt" aria-pressed={what === o.id} onMouseDown={keep} onClick={() => setWhat(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onMouseDown={keep} onClick={insert}>Insert {name}</button>
        </div>
      )}
    </div>
  );
}

/** The Chords panel's rail icon: a small chord grid with one dot. */
export const CHORDS_ICON = (
  <>
    <rect x="5" y="4" width="14" height="16" rx="1" />
    <path d="M5 9h14M5 14h14M9.7 4v16M14.3 4v16" />
    <circle cx="12" cy="11.5" r="1.6" fill="currentColor" stroke="none" />
  </>
);
