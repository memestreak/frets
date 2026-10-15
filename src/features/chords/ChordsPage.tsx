'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ToggleButton } from '@/components/controls';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { arpeggioDots, mutedStrings, voicingDots } from '@/components/chords/chordDots';
import { TUNING, type Position } from '@/lib/music';
import {
  chordFromTones, chordOf, formulaOf, type ChordInfo, type ChordRoot,
} from '@/lib/chords/chordTypes';
import {
  CHORD_PARAM, chordFromSlug, chordHref, DEFAULT_CHORD, SHAPE_PARAM, shapeFromKey,
} from '@/lib/chords/chordUrls';
import {
  findVoicings, voicingCaption, voicingKey, type Voicing, type Voicings,
} from '@/lib/chords/voicings';
import { arpeggioCaption } from './arpeggioCaption';
import { ChordHeader } from './ChordHeader';
import { ChordPickers } from './ChordPickers';
import { nameNotes } from './naming';
import { NameList } from './NameList';
import { useShapeExport } from './export/useShapeExport';
import { useSpaceKey } from './useSpaceKey';
import { VoicingGroups } from './VoicingGroups';
import { VoicingStepper } from './VoicingStepper';

/** The neck shows the open strings through this fret. */
const MAX_FRET = 15;
const MUTED: Voicing = [null, null, null, null, null, null];
const NO_VOICINGS: Voicings = { open: [], moveable: [], allMoveable: [] };

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Pitch classes of the sounding strings, low E first. */
const pitchClasses = (frets: Voicing) =>
  frets.flatMap((f, s) => (f === null ? [] : [mod12(TUNING[s] + f)]));

const isMuted = (frets: Voicing) => frets.every(f => f === null);

const lowestFret = (frets: Voicing): number | null =>
  (isMuted(frets) ? null : Math.min(...frets.filter(f => f !== null)));

/** A chord's first shape: open, else moveable. */
const firstShape = (voicings: Voicings): Voicing =>
  voicings.open[0] ?? voicings.moveable[0] ?? MUTED;

interface Start {
  frets: Voicing;
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
  const voicings = findVoicings(kept);
  if (!shape) return { frets: firstShape(voicings), kept, showAll: false };
  const isShape = (v: Voicing) => voicingKey(v) === voicingKey(shape);
  const showAll = !voicings.open.some(isShape) && !voicings.moveable.some(isShape)
    && voicings.allMoveable.some(isShape);
  return { frets: shape, kept, showAll };
}

/** "Open 1 of 3 · root on A · frets 1–2", or "Your shape · …" for one not listed. */
function stepperCaption(frets: Voicing, open: Voicing[], moveable: Voicing[]): string {
  const key = voicingKey(frets);
  const at = (list: Voicing[]) => list.findIndex(v => voicingKey(v) === key);
  const inOpen = at(open);
  const inMoveable = at(moveable);
  const place = inOpen >= 0 ? `Open ${inOpen + 1} of ${open.length}`
    : inMoveable >= 0 ? `Moveable ${inMoveable + 1} of ${moveable.length}`
    : 'Your shape';
  return `${place} · ${voicingCaption(frets)}`;
}

/**
 * The Chords page. Back and Forward start the page again from the URL;
 * the Arpeggio switch lives here, so it stays on through them.
 */
export default function ChordsPage() {
  const [entry, setEntry] = useState(0);
  const [arpeggio, setArpeggio] = useState(false);
  useEffect(() => {
    const onPop = () => setEntry(n => n + 1);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return <Chords key={entry} arpeggio={arpeggio} onArpeggio={setArpeggio} />;
}

interface ChordsProps {
  /** Whether the neck shows every chord tone instead of the frets played. */
  arpeggio: boolean;
  onArpeggio: (on: boolean) => void;
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
function Chords({ arpeggio, onArpeggio }: ChordsProps) {
  const [start] = useState(startFromUrl);
  const [frets, setFrets] = useState<Voicing>(start.frets);
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
  const voicings = useMemo(() => (chord ? findVoicings(chord) : NO_VOICINGS), [chord]);
  const moveable = showAll ? voicings.allMoveable : voicings.moveable;
  // ‹ › walk the open shapes, then the moveable ones, as listed below.
  const sequence = [...voicings.open, ...moveable];
  // With the arpeggio on, or frets not among the shapes, › goes to the first.
  const index = arpeggio ? -1 : sequence.findIndex(v => voicingKey(v) === voicingKey(frets));

  const href = (named: ChordInfo | null, on: Voicing) => chordHref(
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
  const play = (next: Voicing) => {
    setFrets(next);
    setKept(null);
    setNameIndex(0);
    setShowAll(false);
    // With every string muted there is no chord, so no arpeggio.
    if (isMuted(next)) onArpeggio(false);
  };
  // Frets that are a shape of a chord: the chord stays.
  const keepShape = (next: Voicing, of: ChordInfo | null) => {
    setFrets(next);
    setKept(of);
    setNameIndex(0);
    setScrollTo(lowestFret(next));
  };
  // One of the shapes listed: the neck shows it, not the arpeggio.
  const chooseShape = (next: Voicing) => {
    keepShape(next, chord);
    onArpeggio(false);
  };
  // A chord from the menus: its first shape, and a history entry for Back.
  // The arpeggio stays on, for the new chord.
  const pickChord = (root: ChordRoot, type: string) => {
    const picked = chordOf(root, type);
    const shape = firstShape(findVoicings(picked));
    window.history.pushState(null, '', href(picked, shape));
    setShowAll(false);
    keepShape(shape, picked);
  };

  const tap = ({ s, f }: Position) =>
    play(frets.map((fret, string) => (string !== s ? fret : fret === f ? null : f)));

  // With nothing on the neck there is no arpeggio to show.
  const hasChord = chord !== null;
  const toggleArpeggio = useCallback(() => {
    if (hasChord) onArpeggio(!arpeggio);
  }, [hasChord, arpeggio, onArpeggio]);
  useSpaceKey(toggleArpeggio);
  const shapeExport = useShapeExport();
  // The neck exports what is played, whether or not the arpeggio is showing.
  const neckExport = chord && !isMuted(frets)
    ? shapeExport.triggerProps({ chord, voicing: frets, name: name?.symbol ?? '' })
    : {};

  const title = name?.symbol ?? (chord ? 'No name' : 'Tap the neck');
  const dots = !chord ? []
    : arpeggio ? arpeggioDots(chord, MAX_FRET, frets)
    : voicingDots(chord, frets);
  const caption = !chord ? 'Tap a fret to play it on that string; tap it again to mute the string.'
    : arpeggio ? arpeggioCaption(chord, MAX_FRET)
    : stepperCaption(frets, voicings.open, moveable);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <ChordHeader
        title={title}
        formula={chord ? formulaOf(chord) : ''}
        notes={chord ? chord.notes.join(' ') : ''}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <ChordPickers
            root={chord?.root ?? DEFAULT_CHORD.root} typeId={chord?.type?.id ?? ''}
            onRoot={root => pickChord(root, chord?.type?.id ?? 'M')}
            onType={type => pickChord(chord?.root ?? DEFAULT_CHORD.root, type)}
          />
          <button type="button" className="btn btn-secondary" onClick={() => play(MUTED)}>
            Clear
          </button>
        </div>
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
          <VoicingStepper
            index={index} total={sequence.length} caption={caption}
            onStep={by => chooseShape(sequence[Math.max(0, index + by)])}
          />
          <ToggleButton pressed={arpeggio} disabled={!hasChord} onClick={toggleArpeggio}>
            Arpeggio
          </ToggleButton>
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
            <VoicingGroups
              chord={chord} voicings={voicings}
              showAll={showAll} onShowAll={setShowAll}
              selectedKey={arpeggio ? null : voicingKey(frets)}
              onSelect={chooseShape}
              exportProps={v => shapeExport.triggerProps({ chord, voicing: v, name: chord.symbol })}
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
