'use client';

/**
 * The Chords panel, the Tab rail's last panel (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issue
 * #251): the track's Chord set, the chord picked in it (its name and its shapes, the stored one
 * marked) and Insert. A chord name's Edit, or its double-click, opens it at that chord; moving the
 * cursor changes nothing here. With its Hear toggle on, picking a chord or a shape sounds it.
 */
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { ChordDiagram, PAGE_LOOK, type DiagramLook } from '@/components/chords/ChordDiagram';
import { findShapes, shapeKey, type Shape } from '@/lib/chords/shapes';
import { chordOf, withBass, type ChordInfo } from '@/lib/theory/chords';
import { readChordName } from '@/lib/theory/chordSearch';
import { pitchClassOf } from '@/lib/theory/notes';
import { chordDefOf, chordSet, withChordShape, withoutChord, type ChordEntry } from './chordSet';
import type { Column, Part, Track } from './clip';
import { columnAt, withColumn, type Cursor } from './editing';
import { writtenStrings } from './notation';
import { NoteSoundIcon } from './PlaybackFooter';

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

/** The panel's sections that fold: the track's chords and the shapes. */
type FoldId = 'chords' | 'shape';
const FOLD_IDS: readonly FoldId[] = ['chords', 'shape'];
/** Which of the Chords panel's sections are folded, kept across visits like the open panel (not a preference). */
export const CHORD_PANEL_KEY = 'frets.tab.chordPanel';

/** The sections `frets.tab.chordPanel` keeps folded; none for anything unreadable. */
export function parseChordPanel(text: string | null): FoldId[] {
  try {
    const saved: unknown = JSON.parse(text ?? 'null');
    if (saved && typeof saved === 'object' && 'folded' in saved && Array.isArray(saved.folded)) {
      return FOLD_IDS.filter(id => (saved.folded as unknown[]).includes(id));
    }
  } catch {
    // Unreadable: all open.
  }
  return [];
}

/** The folded sections and a toggle for one, kept in `frets.tab.chordPanel`. */
function useFolded(): [readonly FoldId[], (id: FoldId) => void] {
  const [folded, setFolded] = useState<readonly FoldId[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- what is kept exists only in the browser.
  useEffect(() => setFolded(parseChordPanel(localStorage.getItem(CHORD_PANEL_KEY))), []);
  const fold = (id: FoldId) => {
    const next = folded.includes(id) ? folded.filter(f => f !== id) : [...folded, id];
    setFolded(next);
    try {
      localStorage.setItem(CHORD_PANEL_KEY, JSON.stringify({ folded: next }));
    } catch {
      // Not kept: it still folds now.
    }
  };
  return [folded, fold];
}

/** A section of the panel that folds from its heading, each on its own; `extra` sits at the heading's right while it is open. */
function Fold({ id, title, label = title, folded, onFold, extra, children }: {
  id: FoldId; title: string; label?: string; folded: readonly FoldId[]; onFold: (id: FoldId) => void; extra?: ReactNode; children: ReactNode;
}) {
  const open = !folded.includes(id);
  return (
    <section className="chord-panel-section" aria-label={label}>
      <div className="chord-panel-row">
        <h3 className="chord-panel-label">
          <button
            type="button" className="chord-panel-fold" aria-expanded={open}
            onMouseDown={e => e.preventDefault()} onClick={() => onFold(id)}
          >
            {/* A chevron: down while open, right while folded. */}
            <svg className="chord-panel-chevron" width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} data-open={open || undefined}>
              <path d="M6 3.5L10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {title}
          </button>
        </h3>
        {open && extra}
      </div>
      {open && children}
    </section>
  );
}

/** The Chords panel's Hear toggle, in its head by the title: picking a chord or a shape sounds it while on. */
export function HearChordsToggle({ hear, onHearChange }: { hear: boolean; onHearChange: (hear: boolean) => void }) {
  return (
    <button
      type="button" className="chord-panel-hear" aria-label="Hear chords as you pick them" aria-pressed={hear}
      data-tip="Hear chords as you pick them" onMouseDown={e => e.preventDefault()} onClick={() => onHearChange(!hear)}
    >
      <NoteSoundIcon />
    </button>
  );
}

/** A small trash can. */
function TrashIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.6 6.5v5M9.4 6.5v5" />
    </svg>
  );
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
  /** Whether a chord or shape picked sounds: `HearChordsToggle`, in the panel's head (a Playback preference). */
  hear: boolean;
  /** Sounds a shape, high e first. */
  onHear: (frets: readonly (number | null)[]) => void;
  /** Gives the focus back to the tab, after a name is typed. */
  onDone: () => void;
}

export function ChordPanel({ clip, track, cursor, editing, at, onChange, hear, onHear, onDone }: ChordPanelProps) {
  /** The chord picked in the panel, over `at` and the cursor's. */
  const [picked, setPicked] = useState<string | null>(null);
  /** What the name field holds while typed in, or null when it shows the chord. */
  const [typed, setTyped] = useState<string | null>(null);
  const [what, setWhat] = useState<InsertWhat>('both');
  const [folded, fold] = useFolded();
  // Edit at another chord starts afresh there.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new `at` is an outside event.
  useEffect(() => { setPicked(null); setTyped(null); }, [at]);

  const column = columnAt(clip, cursor);
  // The panel shows the chord picked in it or opened by a name's Edit, not the cursor's: moving the cursor
  // changes nothing here (Jeremy, 2026-11-06).
  const name = picked ?? at?.name ?? null;
  const tuning = useMemo(() => lowFirst(clip), [clip]);
  const set = useMemo(() => chordSet({ ...track, chords: clip.chords }), [track, clip.chords]);
  const chord = useMemo(() => (name ? chordOfName(name) : null), [name]);
  const shapes = useMemo(() => (chord ? shapesOf(chord, tuning) : []), [chord, tuning]);
  const def = name ? chordDefOf(clip.chords, name) : undefined;
  const stored = def?.frets ? toShape(def.frets) : null;
  // A stored shape the Chords page doesn't have shows first.
  const shown = stored && !shapes.some(s => shapeKey(s) === shapeKey(stored)) ? [stored, ...shapes] : shapes;
  const current = stored ? shown.findIndex(s => shapeKey(s) === shapeKey(stored)) : -1;

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
    const frets = shapeFor(n);
    if (hear && frets) onHear(frets);
  };

  const pickShape = (shape: Shape) => {
    if (!name) return;
    onChange(withChordShape(clip, name, toFrets(shape)));
    if (hear) onHear(toFrets(shape));
  };
  const step = (by: 1 | -1) => {
    if (shown.length > 0) pickShape(shown[(Math.max(0, current) + by + shown.length) % shown.length]);
  };

  /** Enter in the name field: the name goes over the cursor's column. */
  const enter = () => {
    const text = (typed ?? '').trim();
    setTyped(null);
    if (text && column) {
      setPicked(text);
      onChange(withColumn(clip, cursor, c => ({ ...c, chord: text })));
    }
    onDone();
  };

  const insert = () => {
    if (!editing || !name || !column) return;
    const frets = shapeFor(name);
    let next = withColumn(clip, cursor, c => insertedColumn(c, what, name, frets));
    // A name inserted with no definition yet gets the shape it was inserted with.
    if (!def?.frets && frets && what !== 'notes') next = withChordShape(next, name, frets);
    onChange(next);
  };

  /** The trash can by an unused chord: no column loses its name. */
  const remove = (entry: ChordEntry) => {
    if (entry.uses > 0) return;
    onChange(withoutChord(clip, entry.name));
    if (picked === entry.name) setPicked(null);
  };

  // Presses on the panel's buttons keep the tab's focus, and so its cursor, as the palette's do.
  const keep = (e: MouseEvent) => e.preventDefault();

  return (
    <div className="chord-panel">
      <Fold id="chords" title="This track’s chords" folded={folded} onFold={fold}>
        {set.length === 0 && <p className="chord-panel-note">None yet.</p>}
        <ul className="chord-panel-list">
          {set.map(entry => {
            const c = chordOfName(entry.name);
            const s = entry.def?.frets ? toShape(entry.def.frets) : null;
            return (
              <li key={entry.name} className="chord-panel-item">
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
                {/* Only an unused chord can go, so no column loses its name (Jeremy, 2026-11-06). */}
                {entry.uses === 0 && (
                  <button
                    type="button" className="chord-panel-delete" aria-label={`Delete ${entry.name}`} data-tip="Delete"
                    onMouseDown={keep} onClick={() => remove(entry)}
                  >
                    <TrashIcon />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Fold>

      <div className="chord-panel-field">
        <span className="chord-panel-label" aria-hidden="true">Chord</span>
        <input
          className="input" aria-label="Chord name"
          placeholder="Am7, G/B…"
          value={typed ?? name ?? ''} onChange={e => setTyped(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') enter();
            if (e.key === 'Escape') setTyped(null);
          }}
          onBlur={() => setTyped(null)}
        />
      </div>

      <Fold
          id="shape" title="Shape" label="Shapes" folded={folded} onFold={fold}
          extra={shown.length > 1 && (
            <span className="chord-panel-stepper">
              <button type="button" className="chord-panel-step" aria-label="Previous shape" onMouseDown={keep} onClick={() => step(-1)}>‹</button>
              {current >= 0 && <span>{current + 1} of {shown.length}</span>}
              <button type="button" className="chord-panel-step" aria-label="Next shape" onMouseDown={keep} onClick={() => step(1)}>›</button>
            </span>
          )}
        >
          {!name && <p className="chord-panel-note">Pick a chord to see its shapes.</p>}
          {name && !chord && !stored && <p className="chord-panel-note">“{name}” isn’t a chord name, so it has no shapes.</p>}
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
        </Fold>


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
