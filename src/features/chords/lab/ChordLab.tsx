'use client';

import { useMemo, useState } from 'react';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { TUNING, type Position } from '@/lib/music';
import { voicingDots } from '@/components/chords/chordDots';
import { ChordHeader } from '../ChordHeader';
import { chordFromTones, formulaOf, type ChordInfo } from '@/lib/chords/chordTypes';
import { nameNotes } from '../naming';
import { VoicingGroups } from '../VoicingGroups';
import { findVoicings, voicingKey, type Voicing, type Voicings } from '@/lib/chords/voicings';
import { NameList } from './NameList';
import { ToneChips } from './ToneChips';

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
 * names, the chips and the shapes all come from them. The only component
 * here with state: the frets, the chosen name, Show all and a notice.
 */
export default function ChordLab() {
  const [frets, setFrets] = useState<Voicing>(START);
  const [nameIndex, setNameIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  /** Says why a chip did nothing. */
  const [notice, setNotice] = useState<string | null>(null);

  // A new shape starts from its best name and the best few shapes.
  const play = (next: Voicing) => {
    setFrets(next);
    setNameIndex(0);
    setShowAll(false);
    setNotice(null);
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

  /** Adds or removes a tone, then puts the new chord's first shape on the neck. */
  const toggleTone = (current: ChordInfo, semis: number) => {
    const tones = current.tones.map(t => t.semis);
    const nextTones = tones.includes(semis) ? tones.filter(t => t !== semis) : [...tones, semis];
    if (nextTones.length < 2) {
      setNotice('A chord needs two or more tones.');
      return;
    }
    const next = chordFromTones(current.rootPc, nextTones);
    const found = findVoicings(next);
    const first = found.open[0] ?? found.moveable[0];
    if (first) play(first);
    else setNotice(`No shape plays ${formulaOf(next)} within four frets.`);
  };

  const title = name?.symbol ?? (chord ? 'No name' : 'Tap the neck');

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

      <section className="card gap-3" aria-label="On the neck">
        <p className="m-0 text-(--ink-muted)">
          Tap a fret to play it on that string; tap it again to mute the string.
        </p>
        <div className="board-scroll">
          <Fretboard
            minFret={0} maxFret={MAX_FRET}
            dots={chord ? voicingDots(chord, frets) : []}
            onCellClick={tap}
            stringStyle={s => (frets[s] === null ? { opacity: 0.35 } : {})}
          />
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

        <section className="grid content-start gap-5 md:col-start-1 md:row-start-1" aria-label="Build it">
          <div className="grid gap-2">
            <h2 className="m-0 text-[17px] leading-6">Build it</h2>
            {chord ? (
              <ToneChips chord={chord} onToggle={semis => toggleTone(chord, semis)} />
            ) : (
              <p className="m-0 text-(--ink-muted)">Tap a note to start a chord.</p>
            )}
            {notice && <p className="m-0 text-(--danger)" role="status">{notice}</p>}
          </div>
          {chord && (
            <VoicingGroups
              chord={chord} voicings={voicings} showKey={false}
              showAll={showAll} onShowAll={setShowAll}
              selectedKey={voicingKey(frets)}
              onSelect={play}
            />
          )}
        </section>
      </div>
    </div>
  );
}
