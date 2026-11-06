'use client';

/**
 * The Chords panel, the Tab rail's last panel (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issue
 * #251): the track's Chord set, each chord with Edit and, unused, a trash can; + to add one; and Insert
 * for the chord picked. Edit, a double-click on a chord, + and a chord name's Edit or double-click in the
 * tab open the chord view (`ChordView`) where the + was. Picking a chord only picks it; moving the cursor
 * changes nothing here. With its Hear toggle on, picking a chord or a shape sounds it.
 */
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { chordDefOf, chordSet, withChordShape, withNewChord, withoutChord, withRenamedChord, type ChordEntry } from './chordSet';
import { chordToDraw, lowFirst, PLAIN_LOOK, shapeFor, toFrets, toShape } from './chordShapes';
import type { Column, Duration, Part, Track } from './clip';
import { columnAt, emptyColumn, withColumn, type Cursor } from './editing';
import { ChordView } from './ChordView';
import { NoteSoundIcon } from './PlaybackFooter';

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

/** The panel's sections that fold: the track's chords (more may come). */
type FoldId = 'chords';
const FOLD_IDS: readonly FoldId[] = ['chords'];
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

/** A small pencil. */
function PencilIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5zM9 4l3 3" />
    </svg>
  );
}

/** A small plus. */
function PlusIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
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
  /** The chord a name's Edit last asked for (each Edit a new object): its chord view opens. */
  at: { name: string | null } | null;
  onChange: (next: Part) => void;
  /** Note input's length while note input is on, else null: Insert then writes a new column of it and moves on. */
  inputLength: Duration | null;
  /** Insert in note input: `part` (the clip with any definition added) with `column` written at the cursor, the cursor moved on. */
  onInsertAtInput: (part: Part, column: Column) => void;
  /** Whether a chord or shape picked sounds: `HearChordsToggle`, in the panel's head (a Playback preference). */
  hear: boolean;
  /** Sounds a shape, high e first. */
  onHear: (frets: readonly (number | null)[]) => void;
  /** Gives the focus back to the tab, when the chord view closes. */
  onDone: () => void;
}

export function ChordPanel({ clip, track, cursor, editing, at, onChange, inputLength, onInsertAtInput, hear, onHear, onDone }: ChordPanelProps) {
  /** The chord picked in the list: what Insert writes. Moving the cursor doesn't change it (Jeremy, 2026-11-06). */
  const [picked, setPicked] = useState<string | null>(null);
  /** What the chord view is open for: a new chord (+), a chord of the set, or nothing (closed). */
  const [view, setView] = useState<{ kind: 'add' } | { kind: 'edit'; name: string } | null>(null);
  const openOn = (n: string) => {
    setPicked(n);
    setView({ kind: 'edit', name: n });
  };
  const closeView = () => {
    setView(null);
    onDone();
  };
  const [what, setWhat] = useState<InsertWhat>('both');
  const [folded, fold] = useFolded();
  // A name's Edit picks that chord and opens its chord view.
  useEffect(() => {
    if (!at?.name) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new `at` is an outside event.
    openOn(at.name);
  }, [at]);

  const column = columnAt(clip, cursor);
  const tuning = useMemo(() => lowFirst(clip), [clip]);
  const set = useMemo(() => chordSet({ ...track, chords: clip.chords }), [track, clip.chords]);
  const name = picked && set.some(e => e.name === picked) ? picked : null;

  /** A chord's own shape (low string first), from its definition; null for none. */
  const shapeOfDef = (n: string) => {
    const frets = chordDefOf(clip.chords, n)?.frets;
    return frets ? toShape(frets) : null;
  };

  const pick = (n: string) => {
    setPicked(n);
    const frets = shapeFor(clip, n);
    if (hear && frets) onHear(frets);
  };

  const insert = () => {
    if (!editing || !name || !column) return;
    const frets = shapeFor(clip, name);
    // A name inserted with no definition yet gets the shape it was inserted with.
    const defined = !chordDefOf(clip.chords, name)?.frets && frets && what !== 'notes' ? withChordShape(clip, name, frets) : clip;
    // In note input, notes go in as a note typed does: a new column of the Input length at the cursor, and on.
    if (inputLength && what !== 'name' && frets) {
      onInsertAtInput(defined, insertedColumn(emptyColumn(inputLength), what, name, frets));
      return;
    }
    onChange(withColumn(defined, cursor, c => insertedColumn(c, what, name, frets)));
  };

  /** The trash can by an unused chord: no column loses its name. */
  const remove = (entry: ChordEntry) => {
    if (entry.uses > 0) return;
    onChange(withoutChord(clip, entry.name));
    if (picked === entry.name) setPicked(null);
  };

  // Presses on the panel's buttons keep the tab's focus, and so its cursor, as the palette's do.
  const keep = (e: MouseEvent) => e.preventDefault();
  /** The chord the view is open on, while it is still in the set. */
  const viewOn = view?.kind === 'edit' && set.some(e => e.name === view.name) ? view.name : null;

  return (
    <div className="chord-panel">
      <Fold id="chords" title="This track’s chords" folded={folded} onFold={fold}>
        {set.length === 0 && <p className="chord-panel-note">None yet.</p>}
        <ul className="chord-panel-list">
          {set.map(entry => {
            const s = entry.def?.frets ? toShape(entry.def.frets) : null;
            const c = s && chordToDraw(clip, entry.name, s);
            return (
              <li key={entry.name} className="chord-panel-item">
                <button
                  type="button" className="chord-panel-entry" aria-pressed={entry.name === name}
                  onMouseDown={keep} onClick={() => pick(entry.name)}
                  onDoubleClick={() => openOn(entry.name)}
                >
                  <span className="chord-panel-thumb" aria-hidden="true">
                    {c && s && <ChordDiagram chord={c} shape={s} look={PLAIN_LOOK} tuning={tuning} />}
                  </span>
                  <span className="chord-panel-name">{entry.name}</span>
                  {entry.uses === 0
                    ? <span className="chord-panel-unused" role="img" aria-label="Not used" title="Not used in this track">○</span>
                    : <span className="chord-panel-uses" title={`Used ${entry.uses} ${entry.uses === 1 ? 'time' : 'times'}`}>{entry.uses}</span>}
                </button>
                <button
                  type="button" className="chord-panel-icon" aria-label={`Edit ${entry.name}`} data-tip="Edit"
                  onMouseDown={keep} onClick={() => openOn(entry.name)}
                >
                  <PencilIcon />
                </button>
                {/* Only an unused chord can go, so no column loses its name (Jeremy, 2026-11-06). */}
                {entry.uses === 0 ? (
                  <button
                    type="button" className="chord-panel-icon chord-panel-delete" aria-label={`Delete ${entry.name}`} data-tip="Delete"
                    onMouseDown={keep} onClick={() => remove(entry)}
                  >
                    <TrashIcon />
                  </button>
                ) : <span aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
        {view?.kind === 'add' || viewOn ? (
          <ChordView
            key={viewOn === null ? 'add' : `edit:${viewOn}`}
            opened={viewOn ? { name: viewOn, shape: shapeOfDef(viewOn) } : null}
            clip={clip} column={column} taken={set.map(e => e.name)}
            onAdd={(n, frets) => { onChange(withNewChord(clip, n, frets)); setPicked(n); closeView(); }}
            onSave={(from, to, frets) => {
              const renamed = withRenamedChord(clip, from, to);
              onChange(frets ? withChordShape(renamed, to, frets) : renamed);
              setPicked(to);
              closeView();
            }}
            onHear={shape => { if (hear) onHear(toFrets(shape)); }}
            onClose={closeView}
          />
        ) : (
          <button
            type="button" className="chord-panel-icon chord-panel-add" aria-label="Add a chord" data-tip="Add a chord"
            onMouseDown={keep} onClick={() => setView({ kind: 'add' })}
          >
            <PlusIcon />
          </button>
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
