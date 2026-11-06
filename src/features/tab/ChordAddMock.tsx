'use client';

/**
 * MOCK (Jeremy's pick pending): adding a chord in the Chords panel itself, in place of the +, rather
 * than in a modal. Three layouts behind `?add=`: a One form, b Fingering first, c Steps. Each looks a
 * chord up by root and type (or by name, behind the magnifier), lets the name differ from the chord's
 * symbol ("A barre/5"), and has a way to draw your own fingering. Cancel or Esc puts the + back.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { SearchIcon } from '@/components/icons';
import { KeyPicker } from '@/components/KeyPicker';
import { diagramStartFret, shapeKey, type Shape } from '@/lib/chords/shapes';
import { chordOf, chordRootOf, CHORD_GROUPS, CHORD_TYPES, type ChordInfo, type ChordRoot } from '@/lib/theory/chords';
import { findChord } from '@/lib/theory/chordSearch';
import type { Column, Part } from './clip';
import { chordToDraw, fits, fretsOfColumn, lowFirst, namesForFrets, PLAIN_LOOK, shapesOf, toFrets, toShape } from './chordShapes';

export type AddLayout = 'a' | 'b' | 'c';

interface ChordAddProps {
  layout: AddLayout;
  clip: Part;
  /** The cursor's column: its fingering, if it has one, is offered first. */
  column: Column | null;
  /** Names already in the track's chords. */
  taken: readonly string[];
  onAdd: (name: string, frets: (number | null)[] | null) => void;
  onHear: (shape: Shape) => void;
  onCancel: () => void;
}

/** How many shapes the panel shows. */
const MAX_SHAPES = 9;

/** The draft chord every layout edits: the chord looked up, the shape picked or drawn, and the name. */
function useDraft(clip: Part, column: Column | null, onHear: (shape: Shape) => void) {
  const tuning = useMemo(() => lowFirst(clip), [clip]);
  const atCursor = useMemo(() => {
    const frets = fretsOfColumn(column);
    return frets ? toShape(frets) : null;
  }, [column]);
  const [root, setRoot] = useState<ChordRoot | ''>('');
  const [typeId, setTypeId] = useState('');
  const chord = useMemo<ChordInfo | null>(() => (root && typeId ? chordOf(root, typeId) : null), [root, typeId]);
  const shapes = useMemo(() => {
    const found = chord ? shapesOf(chord, tuning) : [];
    return atCursor && !found.some(s => shapeKey(s) === shapeKey(atCursor)) ? [atCursor, ...found] : found;
  }, [chord, tuning, atCursor]);
  /** The shape picked or drawn; null until one is. */
  const [shape, setShape] = useState<Shape | null>(atCursor);
  /** Whether `shape` was drawn here (or changed by a tap) rather than picked. */
  const [drawn, setDrawn] = useState(false);
  /** The name typed; null while it follows the chord (it never rewrites what was typed). */
  const [typedName, setTypedName] = useState<string | null>(null);

  const noteNames = useMemo(() => (shape ? namesForFrets(clip, toFrets(shape)) : []), [clip, shape]);
  /** The name offered: the chord's symbol, unless the shape's notes aren't that chord; then what they are. */
  const suggested = chord && (!shape || fits(chord, shape, tuning)) ? chord.symbol : (noteNames[0] ?? chord?.symbol ?? '');
  const name = (typedName ?? suggested).trim();

  const lookUp = (r: ChordRoot | '', t: string) => {
    setRoot(r);
    setTypeId(t);
    const next = r && t ? shapesOf(chordOf(r, t), tuning)[0] : undefined;
    if (next) {
      setShape(next);
      setDrawn(false);
      onHear(next);
    }
  };
  const pick = (s: Shape) => {
    setShape(s);
    setDrawn(false);
    onHear(s);
  };
  const draw = (s: Shape) => {
    setShape(s);
    setDrawn(true);
  };
  return {
    tuning, atCursor, root, typeId, chord, shapes, shape, drawn, noteNames, name, suggested, typedName,
    setRoot: (r: ChordRoot) => lookUp(r, typeId || 'M'),
    setType: (t: string) => lookUp(root || 'C', t),
    found: (r: ChordRoot, t: string) => lookUp(r, t),
    setName: (text: string) => setTypedName(text === '' ? null : text),
    pick, draw,
  };
}
type Draft = ReturnType<typeof useDraft>;

export function ChordAddMock({ layout, clip, column, taken, onAdd, onHear, onCancel }: ChordAddProps) {
  const draft = useDraft(clip, column, onHear);
  // Opening takes the keys (so Esc cancels): the first field, else the form itself.
  const form = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = form.current;
    (el?.querySelector<HTMLElement>('input') ?? el)?.focus();
  }, []);
  const isTaken = taken.includes(draft.name);
  const add = () => {
    if (!draft.name || isTaken) return;
    onAdd(draft.name, draft.shape ? toFrets(draft.shape) : null);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    // Esc cancels, and goes no further (not to note input).
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };
  const buttons = (
    <div className="chord-add-buttons">
      {isTaken && <p className="chord-panel-note">“{draft.name}” is already in this track’s chords.</p>}
      <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      <button type="button" className="btn btn-primary" disabled={!draft.name || isTaken} onClick={add}>
        {draft.name ? `Add ${draft.name}` : 'Add'}
      </button>
    </div>
  );
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc from any of its controls cancels.
    <div ref={form} tabIndex={-1} className="chord-add" role="group" aria-label="New chord" onKeyDown={onKeyDown}>
      <h4 className="chord-add-title">New chord</h4>
      {layout === 'a' && <OneForm draft={draft} clip={clip} onAdd={add} />}
      {layout === 'b' && <FingeringFirst draft={draft} onAdd={add} />}
      {layout === 'c' && <Steps draft={draft} clip={clip} onAdd={add} onCancel={onCancel} buttons={buttons} />}
      {layout !== 'c' && buttons}
    </div>
  );
}

/** Root tiles and the Type menu, with the magnifier swapping the menu for a name field, as on the Chords page. */
function Lookup({ draft }: { draft: Draft }) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [missed, setMissed] = useState(false);
  const searchField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searching) searchField.current?.focus();
  }, [searching]);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const found = findChord(query);
      if (!found) return setMissed(true);
      draft.found(found.root, found.type);
      setSearching(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setSearching(false);
    }
  };
  return (
    <div className="chord-add-lookup">
      <div>
        <span className="field-label" aria-hidden>Root</span>
        <KeyPicker value={draft.root} resolve={chordRootOf} onPick={n => draft.setRoot(n as ChordRoot)} />
      </div>
      <div>
        <span className="field-label">Type</span>
        <div className="chord-add-type">
          {searching ? (
            <input
              ref={searchField} className="input" aria-label="Chord name to look up" placeholder="Am7, F#m7b5…"
              value={query} onChange={e => { setQuery(e.target.value); setMissed(false); }} onKeyDown={onKeyDown}
            />
          ) : (
            <select className="input" aria-label="Type" value={draft.typeId} onChange={e => draft.setType(e.target.value)}>
              {!draft.typeId && <option value="" disabled>—</option>}
              {CHORD_GROUPS.map(g => (
                <optgroup key={g} label={g}>
                  {CHORD_TYPES.filter(t => t.group === g).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
          )}
          <button
            type="button" className="btn btn-secondary btn-icon" aria-label="Find a chord by name" aria-pressed={searching}
            data-tip="Find a chord by name" onClick={() => { setQuery(''); setMissed(false); setSearching(!searching); }}
          >
            <SearchIcon />
          </button>
        </div>
        {missed && <p className="chord-panel-note chord-add-miss">No chord “{query.trim()}”. Try a root then a type: Am7, F#m7b5.</p>}
      </div>
    </div>
  );
}

/** The Name field: it follows the chord (shown as the placeholder) until you type; emptied, it follows again. */
function NameField({ draft, onAdd, hint = true }: { draft: Draft; onAdd: () => void; hint?: boolean }) {
  return (
    <label className="chord-add-field">
      <span className="field-label">Name</span>
      <input
        className="input" aria-label="Name" value={draft.typedName ?? ''} placeholder={draft.suggested || 'A barre/5, Riff A…'}
        onChange={e => draft.setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
      />
      {hint && <span className="chord-panel-note chord-add-hint">Leave it empty to use the chord’s name.</span>}
    </label>
  );
}

/** A grid of shape tiles; the last tile draws your own. */
function ShapeTiles({ draft, clip, onDraw }: { draft: Draft; clip: Part; onDraw: () => void }) {
  const { shapes, shape, atCursor } = draft;
  return (
    <div className="chord-add-shapes" role="group" aria-label="Shapes">
      {shapes.slice(0, MAX_SHAPES).map(s => {
        const chord = chordToDraw(clip, draft.name, s);
        const here = atCursor !== null && shapeKey(s) === shapeKey(atCursor);
        return (
          <button
            key={shapeKey(s)} type="button" className="chord-panel-shape"
            aria-pressed={!draft.drawn && shape !== null && shapeKey(s) === shapeKey(shape)} aria-label={`Shape ${shapeKey(s)}`}
            onClick={() => draft.pick(s)}
          >
            {chord ? <ChordDiagram chord={chord} shape={s} look={PLAIN_LOOK} tuning={draft.tuning} /> : <span className="chord-dialog-caption">{shapeKey(s)}</span>}
            {here && <span className="chord-dialog-caption">At the cursor</span>}
          </button>
        );
      })}
      <button type="button" className="chord-panel-shape chord-add-draw" aria-pressed={draft.drawn} onClick={onDraw}>
        <PencilGlyph />
        <span className="chord-dialog-caption">{draft.drawn ? 'Your own' : 'Draw your own'}</span>
      </button>
    </div>
  );
}

function PencilGlyph() {
  return (
    <svg width={22} height={22} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5zM9 4l3 3" />
    </svg>
  );
}

/** What the drawn shape's notes are; a tap takes one as the name. */
function NoteNames({ draft }: { draft: Draft }) {
  if (draft.noteNames.length === 0) return null;
  return (
    <div className="chord-dialog-names">
      <span className="chord-panel-note">These notes are</span>
      <div className="chord-panel-chips">
        {draft.noteNames.map(n => (
          <button key={n} type="button" className="chord-panel-chip" aria-pressed={n === draft.name} onClick={() => draft.setName(n)}>{n}</button>
        ))}
      </div>
    </div>
  );
}

/* --- a: One form ------------------------------------------------------------------------------- */

function OneForm({ draft, clip, onAdd }: { draft: Draft; clip: Part; onAdd: () => void }) {
  const [drawing, setDrawing] = useState(false);
  return (
    <>
      <NameField draft={draft} onAdd={onAdd} />
      <Lookup draft={draft} />
      <div className="chord-panel-row">
        <span className="chord-panel-label">{drawing ? 'Your own shape' : 'Shape'}</span>
        {drawing && <button type="button" className="chord-add-link" onClick={() => setDrawing(false)}>Back to shapes</button>}
      </div>
      {drawing ? (
        <>
          <ShapeEditor shape={draft.shape} onChange={draft.draw} />
          <NoteNames draft={draft} />
        </>
      ) : (
        <>
          {draft.shapes.length === 0 && <p className="chord-panel-note">Pick a root and type, or draw your own.</p>}
          <ShapeTiles draft={draft} clip={clip} onDraw={() => { setDrawing(true); if (!draft.shape) draft.draw(EMPTY); }} />
        </>
      )}
    </>
  );
}

/* --- b: Fingering first ------------------------------------------------------------------------ */

/** As on the Chords page: the frets are the truth. A pick puts its first shape on one big diagram; ‹ › step shapes; a tap changes it. */
function FingeringFirst({ draft, onAdd }: { draft: Draft; onAdd: () => void }) {
  const { shapes, shape } = draft;
  const at = shape && !draft.drawn ? shapes.findIndex(s => shapeKey(s) === shapeKey(shape)) : -1;
  const step = (by: 1 | -1) => {
    if (shapes.length > 0) draft.pick(shapes[(Math.max(0, at) + by + shapes.length) % shapes.length]);
  };
  return (
    <>
      <Lookup draft={draft} />
      <div className="chord-panel-row">
        <span className="chord-panel-label">{draft.drawn ? 'Your own shape' : 'Shape'}</span>
        {shapes.length > 1 && (
          <span className="chord-panel-stepper">
            <button type="button" className="chord-panel-step" aria-label="Previous shape" onClick={() => step(-1)}>‹</button>
            <span>{at >= 0 ? `${at + 1} of ${shapes.length}` : `– of ${shapes.length}`}</span>
            <button type="button" className="chord-panel-step" aria-label="Next shape" onClick={() => step(1)}>›</button>
          </span>
        )}
      </div>
      <ShapeEditor shape={shape ?? EMPTY} onChange={draft.draw} />
      <p className="chord-panel-note">Tap a string to put a finger there; tap it again to lift it. Left of the nut: open or muted.</p>
      {draft.drawn && <NoteNames draft={draft} />}
      <NameField draft={draft} onAdd={onAdd} />
    </>
  );
}

/* --- c: Steps ---------------------------------------------------------------------------------- */

const STEPS = ['Chord', 'Shape', 'Name'] as const;

function Steps({ draft, clip, onAdd, onCancel, buttons }: { draft: Draft; clip: Part; onAdd: () => void; onCancel: () => void; buttons: ReactNode }) {
  const [step, setStep] = useState(0);
  const [drawing, setDrawing] = useState(false);
  return (
    <>
      <ol className="chord-add-steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>{i + 1} {s}</button>
          </li>
        ))}
      </ol>
      {step === 0 && (
        <>
          <Lookup draft={draft} />
          <button type="button" className="chord-add-link" onClick={() => { setDrawing(true); if (!draft.shape) draft.draw(EMPTY); setStep(1); }}>
            No chord type? Draw a fingering instead
          </button>
        </>
      )}
      {step === 1 && (drawing ? (
        <>
          <button type="button" className="chord-add-link" onClick={() => setDrawing(false)}>Back to shapes</button>
          <ShapeEditor shape={draft.shape} onChange={draft.draw} />
          <NoteNames draft={draft} />
        </>
      ) : (
        <ShapeTiles draft={draft} clip={clip} onDraw={() => { setDrawing(true); if (!draft.shape) draft.draw(EMPTY); }} />
      ))}
      {step === 2 && (
        <>
          {draft.shape && (() => {
            const chord = chordToDraw(clip, draft.name, draft.shape);
            return chord ? <div className="chord-add-preview"><ChordDiagram chord={chord} shape={draft.shape} look={PLAIN_LOOK} tuning={draft.tuning} /></div> : null;
          })()}
          <NameField draft={draft} onAdd={onAdd} />
        </>
      )}
      {step < 2 ? (
        <div className="chord-add-buttons">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          {step > 0 && <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>Back</button>}
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>Next</button>
        </div>
      ) : buttons}
    </>
  );
}

/* --- Drawing your own -------------------------------------------------------------------------- */

const EMPTY: Shape = [null, null, null, null, null, null];
const CELL = 24;
const GAP = 18;
const LEFT = 22;
const TOP = 10;
const FRETS = 5;

/**
 * A chord diagram you tap: low E at the bottom, as the small diagrams have it. A tap on a string at a
 * fret puts the finger there (a second tap lifts it, leaving the string open); left of the nut toggles
 * open and muted. ‹ › move the frets shown, for shapes up the neck.
 */
function ShapeEditor({ shape, onChange }: { shape: Shape | null; onChange: (s: Shape) => void }) {
  const s = shape ?? EMPTY;
  const [start, setStart] = useState(() => diagramStartFret(s));
  // A shape picked elsewhere brings its frets into view.
  const [seen, setSeen] = useState(shapeKey(s));
  if (seen !== shapeKey(s)) {
    setSeen(shapeKey(s));
    const lowest = Math.min(...s.filter((f): f is number => f !== null && f > 0));
    const highest = Math.max(0, ...s.filter((f): f is number => f !== null));
    if (Number.isFinite(lowest) && (lowest < start || highest > start + FRETS - 1)) setStart(diagramStartFret(s));
  }
  const width = LEFT + FRETS * CELL + 6;
  const height = TOP + 5 * GAP + 24;
  const y = (str: number) => TOP + (5 - str) * GAP;
  const set = (str: number, fret: number | null) => {
    const next = s.map((f, i) => (i === str ? fret : f));
    // A tap here keeps the frets shown where they are.
    setSeen(shapeKey(next));
    onChange(next);
  };
  return (
    <div className="chord-add-editor">
      <svg viewBox={`0 0 ${width} ${height}`} className="chord-add-editor-svg" role="group" aria-label="Draw a fingering">
        {/* Hit areas: a band per string, a cell per fret, and the nut's side. */}
        {[0, 1, 2, 3, 4, 5].map(str => (
          <g key={str}>
            <rect
              x={0} y={y(str) - GAP / 2} width={LEFT} height={GAP} fill="transparent" className="chord-add-hit"
              aria-label={`String ${6 - str}: ${s[str] === null ? 'muted' : 'open'}`} role="button"
              onClick={() => set(str, s[str] === null ? 0 : s[str] === 0 ? null : 0)}
            />
            {Array.from({ length: FRETS }, (_, i) => {
              const fret = start + i;
              return (
                <rect
                  key={i} x={LEFT + i * CELL} y={y(str) - GAP / 2} width={CELL} height={GAP} fill="transparent" className="chord-add-hit"
                  role="button" aria-label={`String ${6 - str}, fret ${fret}`}
                  onClick={() => set(str, s[str] === fret ? 0 : fret)}
                />
              );
            })}
          </g>
        ))}
        {Array.from({ length: FRETS + 1 }, (_, i) => (
          <line key={i} x1={LEFT + i * CELL} x2={LEFT + i * CELL} y1={TOP} y2={TOP + 5 * GAP} stroke="var(--line-strong)" />
        ))}
        {start === 1 && <rect x={LEFT - 2} y={TOP - 0.5} width={4} height={5 * GAP + 1} fill="var(--ink)" />}
        {[0, 1, 2, 3, 4, 5].map(str => (
          <line key={str} x1={LEFT} x2={LEFT + FRETS * CELL} y1={y(str)} y2={y(str)} stroke="var(--line-strong)" />
        ))}
        <text x={LEFT + CELL / 2} y={height - 8} textAnchor="middle" fontSize={9} fill="var(--ink-muted)">{start}</text>
        {s.map((fret, str) => {
          if (fret === null) return <text key={str} x={LEFT / 2} y={y(str)} textAnchor="middle" dominantBaseline="central" fontSize={15} fill="var(--ink-muted)">×</text>;
          if (fret === 0) return <circle key={str} cx={LEFT / 2} cy={y(str)} r={6} fill="none" stroke="var(--ink)" strokeWidth={1.75} />;
          if (fret < start || fret >= start + FRETS) return null;
          return <circle key={str} cx={LEFT + (fret - start + 0.5) * CELL} cy={y(str)} r={8.5} fill="var(--ink)" />;
        })}
      </svg>
      <span className="chord-panel-stepper chord-add-position">
        <button type="button" className="chord-panel-step" aria-label="Frets lower" disabled={start <= 1} onClick={() => setStart(Math.max(1, start - 1))}>‹</button>
        <span>Fret {start}</span>
        <button type="button" className="chord-panel-step" aria-label="Frets higher" disabled={start >= 15} onClick={() => setStart(Math.min(15, start + 1))}>›</button>
      </span>
    </div>
  );
}
