'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ToggleButton } from '@/components/controls';
import { DotLabelsPicker, type DotLabels } from '@/components/DotLabels';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { arpeggioDots, mutedStrings, shapeDots } from '@/components/chords/chordDots';
import { usePersist } from '@/hooks/usePersist';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { useShortcuts } from '@/components/shortcuts/useShortcuts';
import type { ShortcutGroup } from '@/lib/shortcuts';
import { TUNING, type Spot } from '@/lib/music';
import { loadJson } from '@/lib/storage';
import {
  CHORD_ROOTS, chordFromTones, chordOf, formulaOf, type ChordInfo, type ChordRoot,
} from '@/lib/theory/chords';
import {
  CHORD_PARAM, chordFromSlug, chordHref, DEFAULT_CHORD, SHAPE_PARAM, shapeFromKey,
} from '@/lib/chords/chordUrls';
import {
  findShapes, moveShape, shapeKey, type Shape, type Shapes,
} from '@/lib/chords/shapes';
import { ChordHeader } from './ChordHeader';
import { ChordPickers } from './ChordPickers';
import { nameNotes } from '@/lib/theory/chordNames';
import { mod12 } from '@/lib/theory/notes';
import { NECK_STORAGE_KEY, parseNeckSettings } from './neckSettings';
import { NameList } from './NameList';
import { useShapeExport } from '@/components/chords/export/useShapeExport';
import { ShapeGroups } from './ShapeGroups';
import { ShapeMover } from './ShapeMover';

/** The neck shows the open strings through this fret. */
const MAX_FRET = 15;
const MUTED: Shape = [null, null, null, null, null, null];
const NO_SHAPES: Shapes = { open: [], moveable: [], allMoveable: [] };

/** Pitch classes of the sounding strings, low E first. */
const pitchClasses = (frets: Shape) =>
  frets.flatMap((f, s) => (f === null ? [] : [mod12(TUNING[s] + f)]));

const isMuted = (frets: Shape) => frets.every(f => f === null);

const lowestFret = (frets: Shape): number | null =>
  (isMuted(frets) ? null : Math.min(...frets.filter(f => f !== null)));

/** A chord's first shape: open, else moveable. */
const firstShape = (shapes: Shapes): Shape =>
  shapes.open[0] ?? shapes.moveable[0] ?? MUTED;

interface Start {
  frets: Shape;
  kept: ChordInfo | null;
  /** Moveable lists every shape, for a linked shape outside the best few. */
  showAll: boolean;
}

/**
 * The page's state from its URL (see "URL" in
 * docs/specs/2026-10-15-one-chords-page-design.md): the shape named,
 * keeping the chord named; a chord alone opens on its first shape.
 */
function startFromUrl(): Start {
  const params = new URLSearchParams(window.location.search);
  const shape = shapeFromKey(params.get(SHAPE_PARAM), MAX_FRET);
  const choice = chordFromSlug(params.get(CHORD_PARAM));
  if (shape && !choice) return { frets: shape, kept: null, showAll: false };
  const { root, type } = choice ?? DEFAULT_CHORD;
  const kept = chordOf(root, type);
  const shapes = findShapes(kept);
  if (!shape) return { frets: firstShape(shapes), kept, showAll: false };
  const isShape = (v: Shape) => shapeKey(v) === shapeKey(shape);
  const showAll = !shapes.open.some(isShape) && !shapes.moveable.some(isShape)
    && shapes.allMoveable.some(isShape);
  return { frets: shape, kept, showAll };
}

/**
 * The Chords page. Back and Forward start the page again from the URL;
 * the Arpeggio switch and the saved neck settings live here, so they stay
 * through them.
 */
/** The page's keys, for the `?` overlay: `useSpaceKey` below, `ShapeGroups` and `ChordPickers`. */
const SHORTCUTS: readonly ShortcutGroup[] = [{
  title: 'Chords',
  shortcuts: [
    { keys: ['/'], does: 'Find a chord by name' },
    { keys: ['Left', 'Right'], does: 'Last or next shape' },
    { keys: ['Space'], does: 'Arpeggio on or off' },
  ],
}];

export default function ChordsPage() {
  const [entry, setEntry] = useState(0);
  const [arpeggio, setArpeggio] = useState(false);
  const [neck, setNeck] = useState(() => parseNeckSettings(loadJson(NECK_STORAGE_KEY)));
  usePersist(NECK_STORAGE_KEY, neck);
  useEffect(() => {
    const onPop = () => setEntry(n => n + 1);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return (
    <Chords
      key={entry} arpeggio={arpeggio} onArpeggio={setArpeggio}
      labels={neck.labels} onLabels={labels => setNeck(n => ({ ...n, labels }))}
    />
  );
}

interface ChordsProps {
  /** Whether the neck shows every chord tone instead of the frets played. */
  arpeggio: boolean;
  onArpeggio: (on: boolean) => void;
  /** What the dots on the neck say. */
  labels: DotLabels;
  onLabels: (labels: DotLabels) => void;
}

/**
 * One neck that is both looked up and played. The frets on it are the
 * source of truth: the names and shapes come from them. Picking a chord in
 * the menus puts its first shape on the neck and keeps that chord
 * (`kept`), as choosing one of its shapes does, even when the shape leaves
 * out a tone and its notes alone would spell another chord; tapping the
 * neck names the notes afresh. The URL follows: a pick adds a history
 * entry, everything else replaces it. Right-click (a long press,
 * Shift+F10) on the neck exports the frets played under the chosen name;
 * on a shape, that shape. Its own state: the frets, the kept chord, the
 * chosen name and Show all.
 */
function Chords({ arpeggio, onArpeggio, labels, onLabels }: ChordsProps) {
  const [start] = useState(startFromUrl);
  const [frets, setFrets] = useState<Shape>(start.frets);
  const [kept, setKept] = useState<ChordInfo | null>(start.kept);
  const [nameIndex, setNameIndex] = useState(0);
  const [showAll, setShowAll] = useState(start.showAll);
  // Only a new shape moves the neck: a tap leaves it where it is.
  const [scrollTo, setScrollTo] = useState(() => lowestFret(start.frets));

  const pcs = useMemo(() => pitchClasses(frets), [frets]);
  const names = useMemo(() => nameNotes(pcs, pcs[0], kept), [pcs, kept]);
  const name = names[nameIndex];
  // With no name, the notes are read upward from the lowest one.
  const chord = useMemo<ChordInfo | null>(
    () => name?.chord ?? (pcs.length ? chordFromTones(pcs[0], pcs.map(pc => pc - pcs[0])) : null),
    [name, pcs],
  );
  const shapes = useMemo(() => (chord ? findShapes(chord) : NO_SHAPES), [chord]);

  const href = (named: ChordInfo | null, on: Shape) => chordHref(
    named?.type ? { root: named.root, type: named.type.id } : null,
    isMuted(on) ? undefined : on,
  );
  // The URL names what is on the neck.
  const here = href(chord, frets);
  useEffect(() => {
    if (window.location.pathname + window.location.search !== here) {
      window.history.replaceState(null, '', here);
    }
  }, [here]);

  // New notes start from their best name and the best few shapes.
  const play = (next: Shape) => {
    setFrets(next);
    setKept(null);
    setNameIndex(0);
    setShowAll(false);
    // With every string muted there is no chord, so no arpeggio.
    if (isMuted(next)) onArpeggio(false);
  };
  // Frets that are a shape of a chord: the chord stays.
  const keepShape = (next: Shape, of: ChordInfo | null) => {
    setFrets(next);
    setKept(of);
    setNameIndex(0);
    setScrollTo(lowestFret(next));
  };
  // One of the shapes listed: the neck shows it, not the arpeggio.
  const chooseShape = (next: Shape) => {
    keepShape(next, chord);
    onArpeggio(false);
  };
  // A chord from the menus: its first shape, and a history entry for Back.
  // The arpeggio stays on, for the new chord.
  const pickChord = (root: ChordRoot, type: string) => {
    const picked = chordOf(root, type);
    const shape = firstShape(findShapes(picked));
    window.history.pushState(null, '', href(picked, shape));
    setShowAll(false);
    keepShape(shape, picked);
  };

  // ‹ › slide the frets along the neck, and the chord with them: Am7 a
  // fret up is B♭m7. Unnamed notes are named afresh. The arpeggio stays as
  // it is, so with it on ‹ › walk the chord through the keys.
  const moveDown = moveShape(frets, -1, MAX_FRET);
  const moveUp = moveShape(frets, 1, MAX_FRET);
  const move = (by: 1 | -1) => {
    const next = by < 0 ? moveDown : moveUp;
    if (!next) return;
    const moved = chord?.type
      ? chordOf(CHORD_ROOTS[mod12(chord.rootPc + by)], chord.type.id)
      : null;
    keepShape(next, moved);
  };

  const tap = ({ s, f }: Spot) =>
    play(frets.map((fret, string) => (string !== s ? fret : fret === f ? null : f)));

  // With nothing on the neck there is no arpeggio to show.
  const hasChord = chord !== null;
  const toggleArpeggio = useCallback(() => {
    if (hasChord) onArpeggio(!arpeggio);
  }, [hasChord, arpeggio, onArpeggio]);
  useSpaceKey(toggleArpeggio);
  useShortcuts(SHORTCUTS);
  const shapeExport = useShapeExport();
  // The neck exports what is played, whether or not the arpeggio is showing.
  const neckExport = chord && !isMuted(frets)
    ? shapeExport.triggerProps({ chord, shape: frets, name: name?.symbol ?? '' })
    : {};

  const title = name?.symbol ?? (chord ? 'No name' : 'Tap the neck');
  const dots = !chord ? []
    : arpeggio ? arpeggioDots(chord, MAX_FRET, labels)
    : shapeDots(chord, frets, labels);
  // Only the tapping hint: the shapes below mark the one on the neck,
  // and the Arpeggio button says when the arpeggio is showing.
  const caption = chord ? '' : 'Tap a fret to play it on that string; tap it again to mute the string.';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <ChordHeader
        title={title}
        formula={chord ? formulaOf(chord) : ''}
        notes={chord ? chord.notes.join(' ') : ''}
      >
        <ChordPickers
          root={chord?.root ?? DEFAULT_CHORD.root} typeId={chord?.type?.id ?? ''}
          onRoot={root => pickChord(root, chord?.type?.id ?? 'M')}
          onType={type => pickChord(chord?.root ?? DEFAULT_CHORD.root, type)}
          onChord={pickChord}
          after={
            <button type="button" className="btn btn-secondary" onClick={() => play(MUTED)}>
              Clear
            </button>
          }
        />
      </ChordHeader>

      <section className="card gap-4" aria-label="On the neck">
        <div className="board-scroll export-trigger" {...neckExport}>
          <Fretboard
            minFret={0} maxFret={MAX_FRET}
            dots={dots}
            onCellClick={tap}
            mutedStrings={arpeggio ? [] : mutedStrings(frets)}
            scrollToFret={scrollTo}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <ShapeMover
            canMoveDown={moveDown !== null} canMoveUp={moveUp !== null}
            caption={caption} onMove={move}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <DotLabelsPicker value={labels} onChange={onLabels} />
            <ToggleButton pressed={arpeggio} disabled={!hasChord} onClick={toggleArpeggio}>
              Arpeggio
            </ToggleButton>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
        <section className="grid content-start gap-2 md:col-start-2 md:row-start-1" aria-label="Name it">
          <h2 className="m-0 text-[17px] leading-6">Name it</h2>
          <NameList
            names={names} selected={nameIndex} onSelect={setNameIndex}
            emptyText={new Set(pcs).size < 2
              ? 'Tap two or more notes to name them.'
              : 'No chord name fits these notes.'}
          />
        </section>

        <div className="md:col-start-1 md:row-start-1">
          {chord ? (
            <ShapeGroups
              chord={chord} shapes={shapes}
              showAll={showAll} onShowAll={setShowAll}
              selectedKey={arpeggio ? null : shapeKey(frets)}
              onSelect={chooseShape}
              exportProps={v => shapeExport.triggerProps(
                { chord, shape: v, name: chord.symbol }, { drag: true },
              )}
            />
          ) : (
            <p className="m-0 text-(--ink-muted)">Tap a note to see its shapes.</p>
          )}
        </div>
      </div>
      {shapeExport.ui}
    </div>
  );
}
