'use client';

/**
 * The Chords panel, the Tab rail's last panel (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issue
 * #251): the chord being looked at (its name and its shapes, the stored one marked), names for the
 * cursor column's notes, the track's Chord set with New chord, and Insert. A chord name's Edit, or its
 * double-click, opens it at that chord.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ChordDiagram, PAGE_LOOK, type DiagramLook } from '@/components/chords/ChordDiagram';
import { findShapes, shapeKey, type Shape } from '@/lib/chords/shapes';
import { nameNotes } from '@/lib/theory/chordNames';
import { chordOf, withBass, type ChordInfo } from '@/lib/theory/chords';
import { readChordName } from '@/lib/theory/chordSearch';
import { pitchClassOf } from '@/lib/theory/notes';
import { chordDefOf, chordSet, withChordShape, withNewChord } from './chordSet';
import type { Column, Part, Track } from './clip';
import { columnAt, withColumn, type Cursor } from './editing';
import { writtenStrings } from './notation';

/** Plain ink dots, as printed chord charts: no degree colours (Jeremy, 2026-11-01). */
const PLAIN_LOOK: DiagramLook = { ...PAGE_LOOK, tone: () => ({ fill: 'var(--ink)', fg: 'var(--surface-raised)' }) };

/** The chord a name means, over its bass for a slash chord; null for a name that isn't a chord ("N.C."). */
export function chordOfName(name: string): ChordInfo | null {
  const reading = readChordName(name);
  if (!reading) return null;
  const chord = chordOf(reading.root, reading.type);
  return reading.bass ? withBass(chord, pitchClassOf(reading.bass)) : chord;
}

/** A shape (low string first, as the Chords page has them) as a definition's frets (high e first), and back. */
const toFrets = (shape: Shape): (number | null)[] => [...shape].reverse();
const toShape = (frets: readonly (number | null)[]): Shape => [...frets].reverse();

/** The track's tuning low string first, as MIDI, which the shape search takes. */
const lowFirst = (part: Part): number[] => [...writtenStrings(part.tuning)].reverse();

/** A chord's shapes on the track's tuning: the open ones, then the best few moveable ones (published first). */
function shapesOf(chord: ChordInfo, tuning: readonly number[]): Shape[] {
  const found = findShapes(chord, tuning);
  return [...found.open, ...found.moveable];
}

/** The names `nameNotes` finds for a column's notes, the best four; none for fewer than two notes. */
export function namesForColumn(part: Part, column: Column | null): string[] {
  const open = writtenStrings(part.tuning);
  const pitches = (column?.notes ?? []).flatMap((n, s) => (n && n.fret !== null ? [open[s] + (part.capo ?? 0) + n.fret] : []));
  if (pitches.length < 2) return [];
  return nameNotes(pitches, Math.min(...pitches)).slice(0, 4).map(n => n.symbol);
}

type InsertWhat = 'name' | 'notes' | 'both';
const INSERT_WHAT: readonly { id: InsertWhat; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'notes', label: 'Notes' },
  { id: 'both', label: 'Both' },
];

/** The column with `name` over it, `frets` as its notes, or both. */
export function insertedColumn(column: Column, what: InsertWhat, name: string, frets: readonly (number | null)[] | null): Column {
  const named = what === 'notes' ? column : { ...column, chord: name };
  if (what === 'name' || !frets) return named;
  return { ...named, notes: frets.map(fret => (fret === null ? null : { fret })) };
}

interface ChordPanelProps {
  /** The part being edited: its tuning, capo, cursor column and `\chord` definitions. */
  clip: Part;
  /** The whole track, whose Chord set the panel lists (the names in every Voice). */
  track: Track;
  cursor: Cursor;
  /** Whether the cursor is in the tab: off it, Insert does nothing, as the palette does. */
  editing: boolean;
  /** The chord a name's Edit last opened the panel at (each Edit a new object), or null: the cursor column's. */
  at: { name: string | null } | null;
  onChange: (next: Part) => void;
  /** Gives the focus back to the tab, after a name is typed. */
  onDone: () => void;
}

export function ChordPanel({ clip, track, cursor, editing, at, onChange, onDone }: ChordPanelProps) {
  /** The chord picked in the panel, over `at` and the cursor's. */
  const [picked, setPicked] = useState<string | null>(null);
  /** What the name field holds while typed in, or null when it shows the chord. */
  const [typed, setTyped] = useState<string | null>(null);
  /** New chord: the field names a chord for the set, not the column. */
  const [naming, setNaming] = useState(false);
  const [what, setWhat] = useState<InsertWhat>('both');
  const field = useRef<HTMLInputElement>(null);
  // Edit at another chord starts afresh there.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new `at` is an outside event.
  useEffect(() => { setPicked(null); setNaming(false); setTyped(null); }, [at]);

  const column = columnAt(clip, cursor);
  const name = naming ? null : picked ?? at?.name ?? column?.chord ?? null;
  const tuning = useMemo(() => lowFirst(clip), [clip]);
  const set = useMemo(() => chordSet({ ...track, chords: clip.chords }), [track, clip.chords]);
  const chord = useMemo(() => (name ? chordOfName(name) : null), [name]);
  const shapes = useMemo(() => (chord ? shapesOf(chord, tuning) : []), [chord, tuning]);
  const def = name ? chordDefOf(clip.chords, name) : undefined;
  const stored = def?.frets ? toShape(def.frets) : null;
  // A stored shape the Chords page doesn't have shows first.
  const shown = stored && !shapes.some(s => shapeKey(s) === shapeKey(stored)) ? [stored, ...shapes] : shapes;
  const current = stored ? shown.findIndex(s => shapeKey(s) === shapeKey(stored)) : -1;
  const names = useMemo(() => namesForColumn(clip, column), [clip, column]);

  /** The shape a chord is inserted with: its stored one, else its first. */
  const shapeFor = (n: string): (number | null)[] | null => {
    const d = chordDefOf(clip.chords, n);
    if (d?.frets) return d.frets;
    const c = chordOfName(n);
    const first = c ? shapesOf(c, tuning)[0] : undefined;
    return first ? toFrets(first) : null;
  };

  const pick = (n: string) => {
    setPicked(n);
    setNaming(false);
  };

  const pickShape = (shape: Shape) => {
    if (!name) return;
    onChange(withChordShape(clip, name, toFrets(shape)));
  };
  const step = (by: 1 | -1) => {
    if (shown.length > 0) pickShape(shown[(Math.max(0, current) + by + shown.length) % shown.length]);
  };

  /** Enter in the name field: a New chord joins the set; otherwise the name goes over the cursor's column. */
  const enter = () => {
    const text = (typed ?? '').trim();
    setTyped(null);
    if (text && naming) {
      onChange(withNewChord(clip, text, shapeFor(text)));
      pick(text);
    } else if (text && column) {
      setPicked(text);
      onChange(withColumn(clip, cursor, c => ({ ...c, chord: text })));
    }
    onDone();
  };

  const startNew = () => {
    setNaming(true);
    setTyped('');
    field.current?.focus();
  };

  const insert = () => {
    if (!editing || !name || !column) return;
    const frets = shapeFor(name);
    let next = withColumn(clip, cursor, c => insertedColumn(c, what, name, frets));
    // A name inserted with no definition yet gets the shape it was inserted with.
    if (!def?.frets && frets && what !== 'notes') next = withChordShape(next, name, frets);
    onChange(next);
  };

  // Presses on the panel's buttons keep the tab's focus, and so its cursor, as the palette's do.
  const keep = (e: MouseEvent) => e.preventDefault();

  return (
    <div className="chord-panel">
      <label className="chord-panel-field">
        <span className="chord-panel-label">{naming ? 'New chord' : 'Chord'}</span>
        <input
          ref={field} className="input" aria-label={naming ? 'New chord name' : 'Chord name'}
          placeholder={naming ? 'Name it: Am7, G/B…' : 'Am7, G/B…'}
          value={typed ?? name ?? ''} onChange={e => setTyped(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') enter();
            if (e.key === 'Escape') { setTyped(null); setNaming(false); }
          }}
          onBlur={() => { setTyped(null); setNaming(false); }}
        />
      </label>

      {name && (
        <section className="chord-panel-section" aria-label="Shapes">
          <div className="chord-panel-row">
            <h3 className="chord-panel-label">Shape</h3>
            {shown.length > 1 && (
              <span className="chord-panel-stepper">
                <button type="button" className="chord-panel-step" aria-label="Previous shape" onMouseDown={keep} onClick={() => step(-1)}>‹</button>
                {current >= 0 && <span>{current + 1} of {shown.length}</span>}
                <button type="button" className="chord-panel-step" aria-label="Next shape" onMouseDown={keep} onClick={() => step(1)}>›</button>
              </span>
            )}
          </div>
          {!chord && !stored && <p className="chord-panel-note">“{name}” isn’t a chord name, so it has no shapes.</p>}
          {chord && (
            <div className="chord-panel-shapes">
              {shown.slice(0, 9).map((s, i) => (
                <button
                  key={shapeKey(s)} type="button" className="chord-panel-shape" aria-pressed={i === current}
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
        <section className="chord-panel-section" aria-label="These notes are">
          <h3 className="chord-panel-label">These notes are</h3>
          <div className="chord-panel-chips">
            {names.map(n => (
              <button
                key={n} type="button" className="chord-panel-chip" aria-pressed={n === name}
                onMouseDown={keep} onClick={() => { pick(n); onChange(withColumn(clip, cursor, c => ({ ...c, chord: n }))); }}
              >
                {n}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="chord-panel-section" aria-label="This track’s chords">
        <div className="chord-panel-row">
          <h3 className="chord-panel-label">This track’s chords</h3>
          <button type="button" className="chord-panel-new" onMouseDown={keep} onClick={startNew}>+ New chord</button>
        </div>
        {set.length === 0 && <p className="chord-panel-note">None yet.</p>}
        <ul className="chord-panel-list">
          {set.map(entry => {
            const c = chordOfName(entry.name);
            const s = entry.def?.frets ? toShape(entry.def.frets) : null;
            return (
              <li key={entry.name}>
                <button
                  type="button" className="chord-panel-entry" aria-pressed={entry.name === name}
                  onMouseDown={keep} onClick={() => pick(entry.name)}
                >
                  <span className="chord-panel-thumb" aria-hidden="true">
                    {c && s && <ChordDiagram chord={c} shape={s} look={PLAIN_LOOK} tuning={tuning} />}
                  </span>
                  <span className="chord-panel-name">{entry.name}</span>
                  {entry.uses === 0
                    ? <span className="chord-panel-unused" role="img" aria-label="Not used" title="Not used in this track">○</span>
                    : <span className="chord-panel-uses" title={`Used ${entry.uses} ${entry.uses === 1 ? 'time' : 'times'}`}>{entry.uses}</span>}
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
