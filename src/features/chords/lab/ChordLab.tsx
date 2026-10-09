'use client';

import { useCallback, useMemo, useState } from 'react';
import { ToggleButton } from '@/components/controls';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { TUNING, type Position } from '@/lib/music';
import { arpeggioDots, voicingDots } from '@/components/chords/chordDots';
import { arpeggioCaption } from '../arpeggioCaption';
import { ChordHeader } from '../ChordHeader';
import { chordFromTones, formulaOf, type ChordInfo } from '@/lib/chords/chordTypes';
import { nameNotes } from '../naming';
import { VoicingGroups } from '../VoicingGroups';
import { findVoicings, voicingKey, type Voicing, type Voicings } from '@/lib/chords/voicings';
import { useSpaceKey } from '../useSpaceKey';
import { NameList } from './NameList';

/** The neck shows the open strings through this fret. */
const MAX_FRET = 15;
/** What the lab opens on: an open C. */
const START: Voicing = [null, 3, 2, 0, 1, 0];
const MUTED: Voicing = [null, null, null, null, null, null];
const NO_VOICINGS: Voicings = { open: [], moveable: [], allMoveable: [] };

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Pitch classes of the sounding strings, low E first. */
const pitchClasses = (frets: Voicing) =>
  frets.flatMap((f, s) => (f === null ? [] : [mod12(TUNING[s] + f)]));

/**
 * The Chord lab page. The frets on the neck are the source of truth: the
 * names and the shapes all come from them. The Arpeggio button (or space)
 * swaps the shape on the neck for every tone of the chord named, and back
 * again: the frets are kept while the arpeggio is on. Playing a note,
 * choosing a shape or Clear turns it off; picking another name keeps it on.
 * The only component here with state: the frets, the chosen name, Show all
 * and the arpeggio.
 */
export default function ChordLab() {
  const [frets, setFrets] = useState<Voicing>(START);
  const [nameIndex, setNameIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [arpeggio, setArpeggio] = useState(false);

  // A new shape starts from its best name and the best few shapes, on the neck.
  const play = (next: Voicing) => {
    setFrets(next);
    setNameIndex(0);
    setShowAll(false);
    setArpeggio(false);
  };

  const pcs = useMemo(() => pitchClasses(frets), [frets]);
  const names = useMemo(() => nameNotes(pcs, pcs[0]), [pcs]);
  const name = names[nameIndex];
  // With no name, the notes are read upward from the lowest one.
  const chord = useMemo<ChordInfo | null>(
    () => name?.chord ?? (pcs.length ? chordFromTones(pcs[0], pcs.map(pc => pc - pcs[0])) : null),
    [name, pcs],
  );
  const voicings = useMemo(() => (chord ? findVoicings(chord) : NO_VOICINGS), [chord]);

  const tap = ({ s, f }: Position) =>
    play(frets.map((fret, string) => (string !== s ? fret : fret === f ? null : f)));

  // With nothing on the neck there is no arpeggio to show.
  const hasChord = chord !== null;
  const toggleArpeggio = useCallback(() => {
    if (hasChord) setArpeggio(on => !on);
  }, [hasChord]);
  useSpaceKey(toggleArpeggio);

  const title = name?.symbol ?? (chord ? 'No name' : 'Tap the neck');
  const dots = !chord ? []
    : arpeggio ? arpeggioDots(chord, MAX_FRET)
    : voicingDots(chord, frets);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <ChordHeader
        title={title}
        formula={chord ? formulaOf(chord) : ''}
        notes={chord ? chord.notes.join(' ') : ''}
      >
        <button type="button" className="btn btn-secondary" onClick={() => play(MUTED)}>
          Clear
        </button>
      </ChordHeader>

      <section className="card gap-4" aria-label="On the neck">
        <div className="board-scroll">
          <Fretboard
            minFret={0} maxFret={MAX_FRET}
            dots={dots}
            onCellClick={tap}
            stringStyle={s => (!arpeggio && frets[s] === null ? { opacity: 0.35 } : {})}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="m-0 text-(--ink-muted)" aria-live="polite" data-testid="neck-caption">
            {arpeggio && chord
              ? arpeggioCaption(chord, MAX_FRET)
              : 'Tap a fret to play it on that string; tap it again to mute the string.'}
          </p>
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
              onSelect={play}
            />
          ) : (
            <p className="m-0 text-(--ink-muted)">Tap a note to see its shapes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
