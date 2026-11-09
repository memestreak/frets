'use client';

/**
 * The Chords palette, one of the Tab page's palettes (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issues
 * #251 and #400): the track's Chord set as diagram tiles, as many to a row as the panel's width holds (four at its first
 * width), two rows to a page; + to add a chord; and one Insert
 * under the tiles for the chord picked. A right-click on a tile opens its menu (Insert, Edit, Rename, Copy to
 * new chord, Delete when unused). Edit, a double-click on a tile, and a chord name's Edit or double-click in
 * the tab open Edit chord (`ChordShapesEditor`): the chord's shapes, a pick applying at once. Its Change chord,
 * + and Copy to new chord open the chord dialog (`ChordEditor`). Picking a chord only picks it; moving the
 * cursor changes nothing here. With its Hear toggle on, picking a chord or a shape sounds it.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ShapeMenu, type MenuItem } from '@/components/chords/export/ShapeMenu';
import { menuSpot, useMenuTrigger } from '@/components/chords/export/useMenuTrigger';
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

/** A tile's badge: how many times its chord is used, 99+ past 99; none for an unused chord. */
export function countBadge(uses: number): string | null {
  if (uses <= 0) return null;
  return uses > 99 ? '99+' : String(uses);
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
  tabFocused: boolean;
  /** The chord a name's Edit last asked for (each Edit a new object): its chord editor opens. */
  at: { name: string | null } | null;
  /** A chord picked in the tab or the Chord chart (each pick a new object): an open Edit chord or Change chord moves to it. */
  follow?: { name: string } | null;
  onChange: (next: Part) => void;
  /** Note input mode's length while note input mode is on, else null: Insert then writes a new column of it and moves on. */
  inputLength: Duration | null;
  /** Insert in note input mode: `part` (the clip with any definition added) with `column` written at the cursor, the cursor moved on. */
  onInsertAtInput: (part: Part, column: Column) => void;
  /** Whether a chord or shape picked sounds: `HearChordsToggle`, in the panel's head (a Playback preference). */
  hear: boolean;
  /** Sounds a shape, high e first. */
  onHear: (frets: readonly (number | null)[]) => void;
  /** Gives the focus back to the tab, when the chord editor closes. */
  onDone: () => void;
}

/** A tile's room in px, with the gap after it: four to a row at the panel's first width (17rem). */
const TILE_ROOM = 60;
/** The rows of tiles a page holds. */
const ROWS = 2;
/** Tiles to a row at the panel's first width, and wherever the width isn't known (tests). */
const FIRST_COLUMNS = 4;

/**
 * How many tiles fit in a row of the Chord set, kept up to date as the panel's width changes (issue #431),
 * so a wider panel puts more chords on each row rather than spacing four apart.
 */
function useTileColumns() {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(FIRST_COLUMNS);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The gap after the last tile isn't there, so the row has one gap's room more than its width.
    const measure = () => {
      if (el.clientWidth) setColumns(Math.max(1, Math.floor((el.clientWidth + 4) / TILE_ROOM)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, columns] as const;
}

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

export function ChordPanel({ clip, track, cursor, tabFocused, at, follow, onChange, inputLength, onInsertAtInput, hear, onHear, onDone }: ChordPanelProps) {
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

  /** The tiles to a row, which the panel's width sets, and so to a page. */
  const [panelRef, columns] = useTileColumns();
  const perPage = columns * ROWS;
  /**
   * The page of the Chord set shown; a chord picked elsewhere (its name's Edit in the tab) brings its page,
   * and so does a change of the page's size, so the chord picked stays in view.
   */
  const [page, setPage] = useState(0);
  const [pageOf, setPageOf] = useState<{ name: string | null; perPage: number }>({ name: null, perPage });
  if (name !== pageOf.name || perPage !== pageOf.perPage) {
    setPageOf({ name, perPage });
    const at = name ? set.findIndex(e => e.name === name) : -1;
    if (at >= 0 && Math.floor(at / perPage) !== page) setPage(Math.floor(at / perPage));
  }

  /** A chord's own shape (low string first), from its definition; null for none. */
  const shapeOfDef = (n: string) => {
    const frets = chordDefOf(clip.chords, n)?.frets;
    return frets ? toShape(frets) : null;
  };

  /**
   * Edit chord and Change chord follow the chord picked, in the set or on the page (Jeremy, 2026-11-07):
   * Change chord's unsaved changes go, as Cancel's do. A new chord (+, a copy) stays where it is.
   */
  const followTo = (n: string) => {
    if (editorFor?.kind !== 'edit' || editorFor.name === n || !set.some(e => e.name === n)) return;
    setPicked(n);
    setEditorFor({ kind: 'edit', name: n, change: editorFor.change });
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new `follow` is an outside event.
    if (follow) followTo(follow.name);
    // Only a new pick counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow]);
  const pick = (n: string) => {
    followTo(n);
    setPicked(n);
    const frets = shapeFor(clip, n);
    if (hear && frets) onHear(frets);
  };

  const insert = (n: string | null = name) => {
    if (!tabFocused || !n || !column) return;
    const frets = shapeFor(clip, n);
    // A name inserted with no definition yet gets the shape it was inserted with.
    const defined = !chordDefOf(clip.chords, n)?.frets && frets && what !== 'notes' ? withChordShape(clip, n, frets) : clip;
    // In note input mode, notes go in as a note typed does: a new column of the Input length at the cursor, and on.
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
      { label: tabFocused && column ? `Insert at ${cursorPlace(clip, cursor)}` : 'Insert', onSelect: () => insert(n) },
      { label: 'Edit', onSelect: () => openOn(n) },
      { label: 'Rename', onSelect: () => { setPicked(n); setEditorFor({ kind: 'edit', name: n, rename: true }); } },
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
  /** Insert for the picked chord, and what it writes, under the tiles. */
  const pickedEntry = set.find(e => e.name === name);
  /** Insert says where it writes (Jeremy, 2026-11-07); off the tab, only "Insert". */
  const insertLabel = tabFocused && column ? `Insert at ${cursorPlace(clip, cursor)}` : 'Insert';
  const actionBar = pickedEntry && (
    <div className="chord-panel-insert">
      {whatSeg}
      <button type="button" className="btn btn-primary" disabled={!tabFocused} onMouseDown={keep} onClick={() => insert()}>{insertLabel}</button>
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

  const pages = Math.max(1, Math.ceil(set.length / perPage));
  const shownPage = Math.min(page, pages - 1);
  const chords = (
    <>
      <div className="chord-panel-tiles" role="group" aria-label="Chords" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {set.slice(shownPage * perPage, (shownPage + 1) * perPage).map(entry => (
          <button
            key={entry.name} type="button" className="chord-panel-tile" aria-pressed={entry.name === name}
            aria-label={`${entry.name}, ${usesText(entry)}`} title={usesText(entry)}
            {...chordProps(entry.name)}
          >
            <span className="chord-panel-tile-name">{entry.name}</span>
            <span className="chord-panel-thumb" aria-hidden="true">
              {thumb(entry.name, entry.def)}
              {countBadge(entry.uses) && <span className="chord-panel-count">{countBadge(entry.uses)}</span>}
            </span>
          </button>
        ))}
        {/* A short last page keeps a full page's room, so the carets and Insert don't move. */}
        {pages > 1 && Array.from({ length: (pages * perPage - set.length) * Number(shownPage === pages - 1) }, (_, i) => (
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
    <div className="chord-panel" ref={panelRef}>
      <Fold id="chords" title="Chord set" folded={folded} onFold={fold} extra={addButton}>
        {set.length === 0 ? <p className="chord-panel-note">None yet. Press + to add one.</p> : chords}
      </Fold>

      {editorOpen && (
        <section className="chord-panel-section" aria-label="Chord editor">
          <h3 className="chord-panel-label">
            {editorFor?.kind === 'edit' ? (changing ? 'Change chord' : 'Edit chord') : editorFor?.kind === 'copy' ? `New chord from ${editorOn}` : 'New chord'}
          </h3>
          {editorFor?.kind === 'edit' && !editorFor.change && editorOn ? (
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
