'use client';

/**
 * The chord editor (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issue #251): a chord's name, its
 * root and type, and its shape, in the Chords panel itself, where its + was. The + opens it empty (Add
 * chord); a chord's pencil, or a double-click on it in the list or on its name in the tab, opens it on
 * that chord (Save chord, or Save as new chord to keep it and add the changed copy under a new name). Add,
 * Save, Cancel and Esc close it.
 *
 * The chord is looked up by root and type, or by name behind the magnifier, as on the Chords page. The
 * name follows the chord until something is typed in it, so it can differ from the chord's symbol
 * ("A barre/5"). The last shape tile draws your own fingering.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { SearchIcon } from '@/components/icons';
import { KeyPicker } from '@/components/KeyPicker';
import { diagramStartFret, shapeKey, type Shape } from '@/lib/chords/shapes';
import { chordOf, chordRootOf, CHORD_GROUPS, CHORD_TYPES, type ChordInfo, type ChordRoot } from '@/lib/theory/chords';
import { findChord, readChordName } from '@/lib/theory/chordSearch';
import type { Column, Part } from './clip';
import { chordToDraw, fits, fretsOfColumn, lowFirst, namesForFrets, PLAIN_LOOK, shapesOf, toFrets, toShape } from './chordShapes';

/** The chord of the set the editor is open on: its name, and its shape (low string first), if it has one. */
export interface ChordOpened {
  name: string;
  shape: Shape | null;
}

interface ChordEditorProps {
  /** The chord being edited; null for a new one (the +, or Copy to new chord). */
  opened: ChordOpened | null;
  /** A new chord's start: the chord Copy to new chord copies, its shape and a free name. */
  from?: { chord: ChordOpened; name: string } | null;
  /** The part: its tuning and capo. */
  clip: Part;
  /** The cursor's column: a new chord offers its fingering first, and names its notes. */
  column: Column | null;
  /** The names in the track's Chord set, which a chord can't take again. */
  taken: readonly string[];
  /** Add chord, or Save as new chord: the new chord's name and shape (high e first), null for none. */
  onAdd: (name: string, frets: (number | null)[] | null) => void;
  /** Save chord: the chord opened, now called `name`, with this shape (high e first), null for none. */
  onSave: (from: string, name: string, frets: (number | null)[] | null) => void;
  /** Sounds a shape as it is picked (when the panel's Hear is on). */
  onHear: (shape: Shape) => void;
  onClose: () => void;
}

/** How many shapes the editor shows, three to a row; the draw tile makes ten. */
const MAX_SHAPES = 9;
/** A shape with every string muted: where drawing starts when there is no shape yet. */
const NO_SHAPE: Shape = [null, null, null, null, null, null];

/** The chord a name means, as a root and type; for a name that isn't one, what the shape's notes are. */
function readingOf(part: Part, opened: ChordOpened) {
  return readChordName(opened.name) ?? (opened.shape ? readChordName(namesForFrets(part, toFrets(opened.shape))[0] ?? '') : null);
}

/** What the editor edits: the chord looked up, the shape picked or drawn, and the name. */
function useDraft(clip: Part, column: Column | null, opened: ChordOpened | null, from: { chord: ChordOpened; name: string } | null, onHear: (shape: Shape) => void) {
  const tuning = useMemo(() => lowFirst(clip), [clip]);
  /** The chord it starts from: the one opened, or the one copied. */
  const start = opened ?? from?.chord ?? null;
  /** A new chord's offer: the cursor column's fingering. */
  const atCursor = useMemo(() => {
    const frets = start ? null : fretsOfColumn(column);
    return frets ? toShape(frets) : null;
  }, [column, start]);
  // An opened chord starts on its root and type ("A barre/5" on A major, from its notes).
  const [initial] = useState(() => (start ? readingOf(clip, start) : null));
  const [root, setRoot] = useState<ChordRoot | ''>(initial?.root ?? '');
  const [typeId, setTypeId] = useState(initial?.type ?? '');
  const chord = useMemo<ChordInfo | null>(() => (root && typeId ? chordOf(root, typeId) : null), [root, typeId]);
  /** The editor's own shape (the chord's, or the cursor's) shows first, before the chord's. */
  const own = start ? start.shape : atCursor;
  const shapes = useMemo(() => {
    const found = chord ? shapesOf(chord, tuning) : [];
    return own && !found.some(s => shapeKey(s) === shapeKey(own)) ? [own, ...found] : found;
  }, [chord, tuning, own]);
  const [shape, setShape] = useState<Shape | null>(own);
  /** Whether the shape was drawn here, rather than picked from the tiles. */
  const [drawn, setDrawn] = useState(false);
  /** The name typed; null while it follows the chord. It never rewrites what was typed. */
  const [typedName, setTypedName] = useState<string | null>(() => {
    if (from) return from.name;
    if (!opened) return null;
    const symbol = initial ? chordOf(initial.root, initial.type).symbol : null;
    return opened.name === symbol ? null : opened.name;
  });

  const noteNames = useMemo(() => (shape ? namesForFrets(clip, toFrets(shape)) : []), [clip, shape]);
  /** The name offered: the chord's symbol, unless the shape's notes aren't that chord; then what they are. */
  const suggested = chord && (!shape || fits(chord, shape, tuning)) ? chord.symbol : (noteNames[0] ?? chord?.symbol ?? '');
  const name = (typedName ?? suggested).trim();

  /** A new root or type: its first shape replaces the one picked. */
  const lookUp = (r: ChordRoot, t: string) => {
    setRoot(r);
    setTypeId(t);
    const first = shapesOf(chordOf(r, t), tuning)[0];
    if (first) {
      setShape(first);
      setDrawn(false);
      onHear(first);
    }
  };
  return {
    tuning, atCursor, root, typeId, chord, shapes, shape, drawn, noteNames, name, suggested, typedName,
    pickRoot: (r: ChordRoot) => lookUp(r, typeId || 'M'),
    pickType: (t: string) => lookUp(root || 'C', t),
    lookUp,
    /** An empty field follows the chord again. */
    setName: (text: string) => setTypedName(text === '' ? null : text),
    pick: (s: Shape) => {
      setShape(s);
      setDrawn(false);
      onHear(s);
    },
    draw: (s: Shape) => {
      setShape(s);
      setDrawn(true);
    },
  };
}
type Draft = ReturnType<typeof useDraft>;

export function ChordEditor({ opened, from = null, clip, column, taken, onAdd, onSave, onHear, onClose }: ChordEditorProps) {
  const draft = useDraft(clip, column, opened, from, onHear);
  const [drawing, setDrawing] = useState(false);
  // Opening takes the keys, so Esc closes it: a new chord's Name field, or the editor itself.
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = editor.current;
    (opened ? el : el?.querySelector<HTMLElement>('input') ?? el)?.focus();
    // Once, as it opens: the editor is keyed by what it opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frets = draft.shape ? toFrets(draft.shape) : null;
  const isTaken = draft.name !== opened?.name && taken.includes(draft.name);
  const keyOf = (s: Shape | null) => (s ? shapeKey(s) : '');
  const changed = opened !== null && (draft.name !== opened.name || keyOf(draft.shape) !== keyOf(opened.shape));
  const canOk = draft.name !== '' && !isTaken && (opened === null || changed);
  // An opened chord can be kept as it was and saved again, changed, under a name of its own.
  const canAddNew = opened !== null && draft.name !== '' && draft.name !== opened.name && !taken.includes(draft.name);
  const needsNewName = opened !== null && changed && draft.name === opened.name;
  const ok = () => {
    if (!canOk) return;
    if (opened) onSave(opened.name, draft.name, frets);
    else onAdd(draft.name, frets);
  };
  const startDrawing = () => {
    setDrawing(true);
    if (!draft.shape) draft.draw(NO_SHAPE);
  };
  // Esc closes it wherever the focus is: a button pressed in it lets go of the focus after use
  // (`useLetGoAfterUse`), so the key may come from the page. It goes no further (not to note input,
  // nor the selection), and leaves a dialog or menu open over the page to take its own Esc.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const target = e.target as Element | null;
      if (target?.closest?.('[role="dialog"], [role="menu"], dialog[open]')) return;
      // The name to look up takes its own Esc, closing the search only.
      if (target?.closest?.('[data-own-escape]')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close.current();
    };
    window.addEventListener('keydown', onEscape, { capture: true });
    return () => window.removeEventListener('keydown', onEscape, { capture: true });
  }, []);
  /** The shape's notes are named while it is the cursor's or drawn: the other tiles are the chord's. */
  const atCursor = draft.atCursor !== null && draft.shape !== null && shapeKey(draft.shape) === shapeKey(draft.atCursor);

  return (
    <div ref={editor} tabIndex={-1} className="chord-editor" role="group" aria-label={opened ? `Edit ${opened.name}` : from ? `Copy ${from.chord.name} to a new chord` : 'Add a chord'}>
      <label className="chord-editor-field">
        <span className="field-label">Name</span>
        <input
          className="input" aria-label="Name" value={draft.typedName ?? ''} placeholder={draft.suggested || 'Am7, Riff A…'}
          onChange={e => draft.setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              ok();
            }
          }}
        />
        <span className="chord-panel-note chord-editor-hint">Leave it empty to use the chord’s name.</span>
      </label>
      <Lookup draft={draft} />
      <div className="chord-panel-row">
        <span className="chord-panel-label">{drawing ? 'Your own shape' : 'Shape'}</span>
        {drawing && <button type="button" className="chord-editor-link" onClick={() => setDrawing(false)}>Back to shapes</button>}
      </div>
      {drawing ? <ShapeEditor shape={draft.shape ?? NO_SHAPE} onChange={draft.draw} /> : (
        <>
          {draft.shapes.length === 0 && <p className="chord-panel-note">Pick a root and type, or draw your own.</p>}
          <ShapeTiles draft={draft} clip={clip} onDraw={startDrawing} />
        </>
      )}
      {(drawing || atCursor) && <NoteNames draft={draft} label={atCursor ? 'The notes at the cursor are' : 'These notes are'} />}
      <div className="chord-editor-buttons">
        {isTaken && <p className="chord-panel-note">“{draft.name}” is already in this track’s chords.</p>}
        {needsNewName && <p className="chord-panel-note">Give it a new name to save it as a new chord.</p>}
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        {opened && (
          <button type="button" className="btn btn-secondary" disabled={!canAddNew} onClick={() => onAdd(draft.name, frets)}>
            Save as new chord
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={!canOk} onClick={ok}>{opened ? 'Save chord' : 'Add chord'}</button>
      </div>
    </div>
  );
}

/** Root tiles and the Type menu, the magnifier swapping the menu for a name to look up, as on the Chords page. */
function Lookup({ draft }: { draft: Pick<Draft, 'root' | 'typeId' | 'pickRoot' | 'pickType' | 'lookUp'> }) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [missed, setMissed] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searching) field.current?.focus();
  }, [searching]);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const found = findChord(query);
      if (!found) return setMissed(true);
      draft.lookUp(found.root, found.type);
      setSearching(false);
    } else if (e.key === 'Escape') {
      // Esc closes the search, not the editor.
      e.preventDefault();
      e.stopPropagation();
      setSearching(false);
    }
  };
  return (
    <div className="chord-editor-lookup">
      <div>
        {/* The picker names itself (aria-label "Root"); this is the visible label. */}
        <span className="field-label" aria-hidden>Root</span>
        <KeyPicker value={draft.root} resolve={chordRootOf} onPick={n => draft.pickRoot(n as ChordRoot)} />
      </div>
      <div>
        <span className="field-label" aria-hidden>Type</span>
        <div className="chord-editor-type">
          {searching ? (
            <input
              ref={field} className="input" aria-label="Chord name to look up" data-own-escape placeholder="Am7, F#m7b5…"
              autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
              value={query} onChange={e => { setQuery(e.target.value); setMissed(false); }} onKeyDown={onKeyDown}
            />
          ) : (
            <select className="input" aria-label="Type" value={draft.typeId} onChange={e => draft.pickType(e.target.value)}>
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
        {missed && <p className="chord-panel-note chord-editor-miss">No chord “{query.trim()}”. Try a root then a type: Am7, F#m7b5.</p>}
      </div>
    </div>
  );
}

/** The shapes, three to a row, the cursor's captioned; the last tile draws your own. */
function ShapeTiles({ draft, clip, onDraw }: { draft: Draft; clip: Part; onDraw: () => void }) {
  const { shapes, shape, atCursor } = draft;
  return (
    <div className="chord-editor-shapes" role="group" aria-label="Shapes">
      {shapes.slice(0, MAX_SHAPES).map(s => {
        const chord = chordToDraw(clip, draft.name, s);
        const here = atCursor !== null && shapeKey(s) === shapeKey(atCursor);
        return (
          <button
            key={shapeKey(s)} type="button" className="chord-panel-shape"
            aria-pressed={!draft.drawn && shape !== null && shapeKey(s) === shapeKey(shape)}
            aria-label={`Shape ${shapeKey(s)}${here ? ', at the cursor' : ''}`} onClick={() => draft.pick(s)}
          >
            {chord ? <ChordDiagram chord={chord} shape={s} look={PLAIN_LOOK} tuning={draft.tuning} /> : <span className="chord-editor-caption">{shapeKey(s)}</span>}
            {here && <span className="chord-editor-caption" aria-hidden="true">At the cursor</span>}
          </button>
        );
      })}
      <button type="button" className="chord-panel-shape chord-editor-draw" aria-pressed={draft.drawn} onClick={onDraw}>
        <svg width={22} height={22} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5zM9 4l3 3" />
        </svg>
        <span className="chord-editor-caption">{draft.drawn ? 'Your own' : 'Draw your own'}</span>
      </button>
    </div>
  );
}

/** What the shape's notes are, up to four names; a press takes one as the name. */
function NoteNames({ draft, label }: { draft: Draft; label: string }) {
  if (draft.noteNames.length === 0) return null;
  return (
    <div className="chord-editor-names" role="group" aria-label={label}>
      <span className="chord-panel-note" aria-hidden="true">{label}</span>
      <div className="chord-panel-chips">
        {draft.noteNames.map(n => (
          <button key={n} type="button" className="chord-panel-chip" aria-pressed={n === draft.name} onClick={() => draft.setName(n)}>{n}</button>
        ))}
      </div>
    </div>
  );
}

/* Drawing your own: the small diagrams' geometry, in SVG units, five frets at a time. */
const CELL = 24;
const GAP = 18;
const LEFT = 22;
const TOP = 10;
const FRETS = 5;
const STRINGS = [0, 1, 2, 3, 4, 5] as const;
const HIGHEST_START = 15;

/**
 * A chord diagram you press, low E at the bottom as the small diagrams have it. A press on a string at
 * a fret puts a finger there, and a second lifts it, leaving the string open; left of the nut, a press
 * turns an open string muted and a muted one open. ‹ › move the frets shown, for shapes up the neck.
 */
export function ShapeEditor({ shape, onChange }: { shape: Shape; onChange: (s: Shape) => void }) {
  const [start, setStart] = useState(() => diagramStartFret(shape));
  // A shape from elsewhere (a tile, a new chord) brings its frets into view; one drawn here doesn't move them.
  const [seen, setSeen] = useState(shapeKey(shape));
  if (seen !== shapeKey(shape)) {
    setSeen(shapeKey(shape));
    const fretted = shape.filter((f): f is number => f !== null && f > 0);
    if (fretted.length > 0 && (Math.min(...fretted) < start || Math.max(...fretted) > start + FRETS - 1)) setStart(diagramStartFret(shape));
  }
  const width = LEFT + FRETS * CELL + 6;
  const height = TOP + 5 * GAP + 24;
  const y = (s: number) => TOP + (5 - s) * GAP;
  const set = (s: number, fret: number | null) => {
    const next = shape.map((f, i) => (i === s ? fret : f));
    setSeen(shapeKey(next));
    onChange(next);
  };
  return (
    <div className="chord-editor-editor">
      <svg viewBox={`0 0 ${width} ${height}`} className="chord-editor-editor-svg" role="group" aria-label="Draw a fingering">
        {/* Press areas first, under the lines and dots: a band per string beside the nut, a cell per fret. */}
        {STRINGS.map(s => (
          <g key={s}>
            <rect
              x={0} y={y(s) - GAP / 2} width={LEFT} height={GAP} className="chord-editor-hit" role="button"
              aria-label={`String ${6 - s}: ${shape[s] === null ? 'muted' : 'open'}`}
              onClick={() => set(s, shape[s] === null ? 0 : shape[s] === 0 ? null : 0)}
            />
            {Array.from({ length: FRETS }, (_, i) => (
              <rect
                key={i} x={LEFT + i * CELL} y={y(s) - GAP / 2} width={CELL} height={GAP} className="chord-editor-hit" role="button"
                aria-label={`String ${6 - s}, fret ${start + i}`} aria-pressed={shape[s] === start + i}
                onClick={() => set(s, shape[s] === start + i ? 0 : start + i)}
              />
            ))}
          </g>
        ))}
        {Array.from({ length: FRETS + 1 }, (_, i) => (
          <line key={i} x1={LEFT + i * CELL} x2={LEFT + i * CELL} y1={TOP} y2={TOP + 5 * GAP} stroke="var(--line-strong)" />
        ))}
        {start === 1 && <rect x={LEFT - 2} y={TOP - 0.5} width={4} height={5 * GAP + 1} fill="var(--ink)" />}
        {STRINGS.map(s => <line key={s} x1={LEFT} x2={LEFT + FRETS * CELL} y1={y(s)} y2={y(s)} stroke="var(--line-strong)" />)}
        <text x={LEFT + CELL / 2} y={height - 8} textAnchor="middle" fontSize={9} fill="var(--ink-muted)">{start}</text>
        {shape.map((fret, s) => {
          if (fret === null) return <text key={s} x={LEFT / 2} y={y(s)} textAnchor="middle" dominantBaseline="central" fontSize={15} fill="var(--ink-muted)">×</text>;
          if (fret === 0) return <circle key={s} cx={LEFT / 2} cy={y(s)} r={6} fill="none" stroke="var(--ink)" strokeWidth={1.75} />;
          if (fret < start || fret >= start + FRETS) return null;
          return <circle key={s} cx={LEFT + (fret - start + 0.5) * CELL} cy={y(s)} r={8.5} fill="var(--ink)" />;
        })}
      </svg>
      <span className="chord-panel-stepper">
        <button type="button" className="chord-panel-step" aria-label="Lower frets" disabled={start <= 1} onClick={() => setStart(start - 1)}>‹</button>
        <span>Fret {start}</span>
        <button type="button" className="chord-panel-step" aria-label="Higher frets" disabled={start >= HIGHEST_START} onClick={() => setStart(start + 1)}>›</button>
      </span>
    </div>
  );
}

/**
 * Mock (`?chordedit=shapes`, Jeremy 2026-11-07): editing a chord the track has is choosing its shape.
 * Its name is a heading, renamed only by a double-click (Enter renames, Esc leaves it); a shape picked
 * or drawn is its shape at once (undo takes it back); "Another chord's shapes" looks one up and Back
 * returns to its own. Done or Esc closes. It never makes a new chord: +, Copy to new chord do.
 */
export function ChordShapesEditor({ name, shape, clip, taken, renaming, onShape, onRename, onHear, onChangeChord, onClose }: {
  name: string;
  shape: Shape | null;
  clip: Part;
  taken: readonly string[];
  /** Opened by the menu's Rename: the name field is open. */
  renaming?: boolean;
  onShape: (frets: (number | null)[]) => void;
  onRename: (to: string) => void;
  onHear: (shape: Shape) => void;
  /** Change chord: the full chord dialog (name, root, type, shapes, draw your own), with Cancel. */
  onChangeChord: () => void;
  onClose: () => void;
}) {
  const tuning = useMemo(() => lowFirst(clip), [clip]);
  /** The tiles show the chord's own shapes, by its name (or, for a name that isn't a chord, its notes). */
  const [reading] = useState(() => readingOf(clip, { name, shape }));
  const [editingName, setEditingName] = useState(renaming ?? false);
  const [typed, setTyped] = useState(name);
  const nameField = useRef<HTMLInputElement>(null);
  // The name field takes the keys as it opens, its text selected to type over.
  useEffect(() => {
    if (editingName) nameField.current?.select();
  }, [editingName]);
  const chord = useMemo(() => (reading ? chordOf(reading.root, reading.type) : null), [reading]);
  const shapes = useMemo(() => {
    const found = chord ? shapesOf(chord, tuning) : [];
    return shape && !found.some(s => shapeKey(s) === shapeKey(shape)) ? [shape, ...found] : found;
  }, [chord, tuning, shape]);
  const use = (s: Shape) => {
    onShape(toFrets(s));
    onHear(s);
  };
  const rename = () => {
    const to = typed.trim();
    if (to && to !== name && !taken.includes(to)) onRename(to);
    setEditingName(false);
  };
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (editor.current?.querySelector<HTMLElement>('input') ?? editor.current)?.focus();
  }, []);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const target = e.target as Element | null;
      if (target?.closest?.('[role="dialog"], [role="menu"], dialog[open], [data-own-escape]')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close.current();
    };
    window.addEventListener('keydown', onEscape, { capture: true });
    return () => window.removeEventListener('keydown', onEscape, { capture: true });
  }, []);
  const nameTaken = typed.trim() !== name && taken.includes(typed.trim());

  return (
    <div ref={editor} tabIndex={-1} className="chord-editor" role="group" aria-label={`Edit ${name}`}>
      {editingName ? (
        <label className="chord-editor-field">
          <span className="field-label">Rename</span>
          <input
            ref={nameField} className="input" aria-label="Name" value={typed} data-own-escape onChange={e => setTyped(e.target.value)}
            onBlur={rename}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); rename(); }
              if (e.key === 'Escape') { e.preventDefault(); setTyped(name); setEditingName(false); }
            }}
          />
          {nameTaken && <span className="chord-panel-note chord-editor-hint">“{typed.trim()}” is already in the Chord set.</span>}
        </label>
      ) : (
        <button
          type="button" className="chord-editor-title" title="Double-click to rename" aria-label={`${name}: double-click or F2 to rename`}
          onDoubleClick={() => { setTyped(name); setEditingName(true); }}
          onKeyDown={e => { if (e.key === 'F2') { e.preventDefault(); setTyped(name); setEditingName(true); } }}
        >
          {name}
        </button>
      )}
      <div className="chord-panel-row">
        <span className="chord-panel-label">Shapes</span>
        <button type="button" className="chord-editor-link" onClick={onChangeChord}>Change chord</button>
      </div>
      <div className="chord-editor-shapes" role="group" aria-label="Shapes">
        {shapes.slice(0, MAX_SHAPES).map(s => {
          const c = chordToDraw(clip, name, s);
          return (
            <button
              key={shapeKey(s)} type="button" className="chord-panel-shape" aria-label={`Shape ${shapeKey(s)}`}
              aria-pressed={shape !== null && shapeKey(s) === shapeKey(shape)} onClick={() => use(s)}
            >
              {c ? <ChordDiagram chord={c} shape={s} look={PLAIN_LOOK} tuning={tuning} /> : <span className="chord-editor-caption">{shapeKey(s)}</span>}
            </button>
          );
        })}
      </div>
      <p className="chord-panel-note chord-editor-hint">A shape you pick is {name}’s shape at once; Ctrl/⌘+Z takes it back.</p>
      <div className="chord-editor-buttons">
        <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
