'use client';

/**
 * The Chords panel, the Tab rail's last panel (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issue
 * #251): the track's Chord set, each chord with Edit and, unused, a trash can; + to add one; and Insert
 * for the chord picked. Edit, a double-click on a chord, + and a chord name's Edit or double-click in the
 * tab open the chord editor (`ChordEditor`) where the + was. Picking a chord only picks it; moving the cursor
 * changes nothing here. With its Hear toggle on, picking a chord or a shape sounds it.
 */
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { ShapeMenu, type MenuItem } from '@/components/chords/export/ShapeMenu';
import { menuSpot, useMenuTrigger } from '@/components/chords/export/useMenuTrigger';
import { useMock, type Mock } from '@/components/mocks/useMock';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { chordDefOf, chordSet, withChordShape, withNewChord, withoutChord, withRenamedChord, type ChordEntry } from './chordSet';
import { chordToDraw, lowFirst, PLAIN_LOOK, shapeFor, toFrets, toShape } from './chordShapes';
import { ticks, timeAt, WHOLE, type Column, type Duration, type Part, type Track } from './clip';
import { columnAt, emptyColumn, withColumn, type Cursor } from './editing';
import { ChordEditor, ChordShapesEditor } from './ChordEditor';
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

/** A section of the panel that folds from its heading, each on its own; `extra` sits at the heading's right, folded or not. */
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
        {extra}
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

/** A small plus. */
function PlusIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
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
  /** The chord a name's Edit last asked for (each Edit a new object): its chord editor opens. */
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
  /** Gives the focus back to the tab, when the chord editor closes. */
  onDone: () => void;
}

/** Mock: editing a chord the track has is choosing its shape (Jeremy, 2026-11-07), or today's editor. */
const EDIT_MOCK: Mock = {
  param: 'chordedit',
  label: 'Editing a chord',
  options: [
    { value: 'shapes', label: 'Shapes only, name renamed apart' },
    { value: 'today', label: 'Today’s editor' },
  ],
};

/** The Chord set's tiles a page holds: four to a row, two rows. */
const PAGE = 8;

/** A name the set hasn't got, for a copy of `name`: "C 2", or "C 3" if that's taken. */
export function freeName(name: string, taken: readonly string[]): string {
  for (let n = 2; ; n++) if (!taken.includes(`${name} ${n}`)) return `${name} ${n}`;
}

const PARTS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };

/** Where Insert writes, as a player counts it: "bar 3, beat 2", "bar 1, beat 2½". */
export function cursorPlace(clip: Part, cursor: Cursor): string {
  const bar = clip.bars[cursor.bar];
  if (!bar) return '';
  const before = bar.columns.slice(0, cursor.column).reduce((t, c) => t + (c.grace ? 0 : ticks(c.duration)), 0);
  const beat = before / (WHOLE / timeAt(clip, cursor.bar).value) + 1;
  const whole = Math.floor(beat);
  const part = Math.round((beat - whole) * 100) / 100;
  const label = part === 0 ? `${whole}` : PARTS[String(part)] ? `${whole}${PARTS[String(part)]}` : beat.toFixed(2);
  return `bar ${cursor.bar + 1}, beat ${label}`;
}

/** What the chord editor is open for: a new chord (+), a chord of the set, a copy of one, or nothing (closed). */
type EditorFor = { kind: 'add' } | { kind: 'edit'; name: string; rename?: boolean; change?: boolean } | { kind: 'copy'; name: string; newName: string };

export function ChordPanel({ clip, track, cursor, editing, at, onChange, inputLength, onInsertAtInput, hear, onHear, onDone }: ChordPanelProps) {
  const shapesEditor = useMock(EDIT_MOCK) === 'shapes';
  /** The chord picked in the list: what Insert writes. Moving the cursor doesn't change it (Jeremy, 2026-11-06). */
  const [picked, setPicked] = useState<string | null>(null);
  const [editorFor, setEditorFor] = useState<EditorFor | null>(null);
  const openOn = (n: string) => {
    setPicked(n);
    setEditorFor({ kind: 'edit', name: n });
  };
  const closeEditor = () => {
    setEditorFor(null);
    onDone();
  };
  const [what, setWhat] = useState<InsertWhat>('both');
  const [folded, fold] = useFolded();
  const [menu, setMenu] = useState<{ x: number; y: number; name: string } | null>(null);
  const menuTrigger = useMenuTrigger();
  // A name's Edit picks that chord and opens its chord editor.
  useEffect(() => {
    if (!at?.name) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new `at` is an outside event.
    openOn(at.name);
  }, [at]);

  const column = columnAt(clip, cursor);
  const tuning = useMemo(() => lowFirst(clip), [clip]);
  const set = useMemo(() => chordSet({ ...track, chords: clip.chords }), [track, clip.chords]);
  const name = picked && set.some(e => e.name === picked) ? picked : null;
  const taken = set.map(e => e.name);

  /** The page of the Chord set shown; a chord picked elsewhere (its name's Edit in the tab) brings its page. */
  const [page, setPage] = useState(0);
  const [pageOf, setPageOf] = useState<string | null>(null);
  if (name !== pageOf) {
    setPageOf(name);
    const at = name ? set.findIndex(e => e.name === name) : -1;
    if (at >= 0 && Math.floor(at / PAGE) !== page) setPage(Math.floor(at / PAGE));
  }

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

  const insert = (n: string | null = name) => {
    if (!editing || !n || !column) return;
    const frets = shapeFor(clip, n);
    // A name inserted with no definition yet gets the shape it was inserted with.
    const defined = !chordDefOf(clip.chords, n)?.frets && frets && what !== 'notes' ? withChordShape(clip, n, frets) : clip;
    // In note input, notes go in as a note typed does: a new column of the Input length at the cursor, and on.
    if (inputLength && what !== 'name' && frets) {
      onInsertAtInput(defined, insertedColumn(emptyColumn(inputLength), what, n, frets));
      return;
    }
    onChange(withColumn(defined, cursor, c => insertedColumn(c, what, n, frets)));
  };

  /** The trash can by an unused chord: no column loses its name. */
  const remove = (entry: ChordEntry) => {
    if (entry.uses > 0) return;
    onChange(withoutChord(clip, entry.name));
    if (picked === entry.name) setPicked(null);
  };
  const copy = (n: string) => {
    setPicked(n);
    setEditorFor({ kind: 'copy', name: n, newName: freeName(n, taken) });
  };

  // Presses on the panel's buttons keep the tab's focus, and so its cursor, as the palette's do.
  const keep = (e: MouseEvent) => e.preventDefault();
  /** The chord the editor is open on (or copies), while it is still in the set. */
  const editorOn = editorFor && editorFor.kind !== 'add' && set.some(e => e.name === editorFor.name) ? editorFor.name : null;
  /** Change chord: the chord's full dialog, the one + opens, over its shapes view. */
  const changing = editorFor?.kind === 'edit' && Boolean(editorFor.change);
  const editorOpen = editorFor?.kind === 'add' || editorOn !== null;

  /** A chord's right-click menu (or long press, or Shift+F10). */
  const menuItems = (n: string): MenuItem[] => {
    const entry = set.find(e => e.name === n);
    return [
      { label: editing && column ? `Insert at ${cursorPlace(clip, cursor)}` : 'Insert', onSelect: () => insert(n) },
      { label: 'Edit', onSelect: () => openOn(n) },
      ...(shapesEditor ? [{ label: 'Rename', onSelect: () => { setPicked(n); setEditorFor({ kind: 'edit', name: n, rename: true }); } }] : []),
      { label: 'Copy to new chord', onSelect: () => copy(n) },
      ...(entry && entry.uses === 0 ? [{ label: 'Delete', onSelect: () => remove(entry) }] : []),
    ];
  };
  /** What every chord in the list answers: a press picks, a double-click opens it, a right-click its menu. */
  const chordProps = (n: string) => ({
    onMouseDown: keep,
    onClick: () => pick(n),
    onDoubleClick: () => openOn(n),
    ...menuTrigger.props((trigger, x, y) => {
      setPicked(n);
      setMenu({ ...menuSpot(trigger, x, y), name: n });
    }),
  });
  const thumb = (n: string, def: ChordEntry['def']) => {
    const s = def?.frets ? toShape(def.frets) : null;
    const c = s && chordToDraw(clip, n, s);
    return c && s ? <ChordDiagram chord={c} shape={s} look={PLAIN_LOOK} tuning={tuning} /> : null;
  };
  const usesText = (entry: ChordEntry) => (entry.uses === 0 ? 'Not used' : `Used ${entry.uses} ${entry.uses === 1 ? 'time' : 'times'}`);
  const whatSeg = (
    <div className="seg chord-panel-what" role="group" aria-label="Insert">
      {INSERT_WHAT.map(o => (
        <button key={o.id} type="button" className="seg-opt" aria-pressed={what === o.id} onMouseDown={keep} onClick={() => setWhat(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
  /** Mocks b and c: Insert and the picked chord's Edit and Delete, under the chords. */
  const pickedEntry = set.find(e => e.name === name);
  /** Insert says where it writes (Jeremy, 2026-11-07); off the tab, only "Insert". */
  const insertLabel = editing && column ? `Insert at ${cursorPlace(clip, cursor)}` : 'Insert';
  const actionBar = pickedEntry && (
    <div className="chord-panel-insert">
      {whatSeg}
      <button type="button" className="btn btn-primary" disabled={!editing} onMouseDown={keep} onClick={() => insert()}>{insertLabel}</button>
    </div>
  );

  const addButton = (
    <button
      type="button" className="chord-panel-icon" aria-label="Add a chord" data-tip="Add a chord"
      onMouseDown={keep} onClick={() => setEditorFor({ kind: 'add' })}
    >
      <PlusIcon />
    </button>
  );

  const pages = Math.max(1, Math.ceil(set.length / PAGE));
  const shownPage = Math.min(page, pages - 1);
  const chords = (
    <>
      <div className="chord-panel-tiles" role="group" aria-label="Chords">
        {set.slice(shownPage * PAGE, (shownPage + 1) * PAGE).map(entry => (
          <button
            key={entry.name} type="button" className="chord-panel-tile" aria-pressed={entry.name === name}
            data-unused={entry.uses === 0 || undefined} aria-label={`${entry.name}, ${usesText(entry)}`} title={usesText(entry)}
            {...chordProps(entry.name)}
          >
            <span className="chord-panel-tile-name">{entry.name}</span>
            <span className="chord-panel-thumb" aria-hidden="true">{thumb(entry.name, entry.def)}</span>
          </button>
        ))}
        {/* A short last page keeps a full page's room, so the carets and Insert don't move. */}
        {pages > 1 && Array.from({ length: (pages * PAGE - set.length) * Number(shownPage === pages - 1) }, (_, i) => (
          <span key={`empty${i}`} className="chord-panel-tile-empty" aria-hidden="true" />
        ))}
      </div>
      {pages > 1 && (
        <div className="chord-panel-pager">
          <button type="button" className="chord-panel-step" aria-label="Previous chords" disabled={shownPage === 0} onMouseDown={keep} onClick={() => setPage(shownPage - 1)}>‹</button>
          <span>{shownPage + 1} / {pages}</span>
          <button type="button" className="chord-panel-step" aria-label="More chords" disabled={shownPage === pages - 1} onMouseDown={keep} onClick={() => setPage(shownPage + 1)}>›</button>
        </div>
      )}
      {actionBar}
    </>
  );

  return (
    <div className="chord-panel">
      <Fold id="chords" title="Chord set" folded={folded} onFold={fold} extra={addButton}>
        {set.length === 0 ? <p className="chord-panel-note">None yet. Press + to add one.</p> : chords}
      </Fold>

      {editorOpen && (
        <section className="chord-panel-section" aria-label="Chord editor">
          <h3 className="chord-panel-label">
            {editorFor?.kind === 'edit' ? (changing ? 'Change chord' : shapesEditor ? 'Edit chord' : `Edit ${editorOn}`) : editorFor?.kind === 'copy' ? `New chord from ${editorOn}` : 'New chord'}
          </h3>
          {shapesEditor && editorFor?.kind === 'edit' && !editorFor.change && editorOn ? (
            <ChordShapesEditor
              key={`shapes:${editorOn}`} name={editorOn} shape={shapeOfDef(editorOn)} clip={clip} taken={taken}
              renaming={editorFor.rename}
              onShape={frets => onChange(withChordShape(clip, editorOn, frets))}
              onRename={to => { onChange(withRenamedChord(clip, editorOn, to)); setPicked(to); setEditorFor({ kind: 'edit', name: to }); }}
              onHear={shape => { if (hear) onHear(toFrets(shape)); }}
              onChangeChord={() => setEditorFor({ kind: 'edit', name: editorOn, change: true })}
              onClose={closeEditor}
            />
          ) : (
            <ChordEditor
              key={editorFor?.kind === 'add' ? 'add' : `${editorFor?.kind}:${editorOn}`}
              opened={editorFor?.kind === 'edit' && editorOn ? { name: editorOn, shape: shapeOfDef(editorOn) } : null}
              from={editorFor?.kind === 'copy' && editorOn ? { chord: { name: editorOn, shape: shapeOfDef(editorOn) }, name: editorFor.newName } : null}
              clip={clip} column={column} taken={taken}
              onAdd={(n, frets) => { onChange(withNewChord(clip, n, frets)); setPicked(n); closeEditor(); }}
              onSave={(from, to, frets) => {
                const renamed = withRenamedChord(clip, from, to);
                onChange(frets ? withChordShape(renamed, to, frets) : renamed);
                setPicked(to);
                // Change chord's Save goes back to the chord's shapes; the old editor closes.
                if (changing) setEditorFor({ kind: 'edit', name: to });
                else closeEditor();
              }}
              onHear={shape => { if (hear) onHear(toFrets(shape)); }}
              onClose={changing && editorOn ? () => setEditorFor({ kind: 'edit', name: editorOn }) : closeEditor}
            />
          )}
        </section>
      )}

      {menu && (
        <ShapeMenu
          x={menu.x} y={menu.y} label={menu.name}
          onClose={() => setMenu(null)}
          items={menuItems(menu.name)}
        />
      )}
    </div>
  );
}
