'use client';

import { useMemo, useState } from 'react';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { usePersist } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { voicingDots } from '../chordDots';
import { chordOf, formulaOf } from '../chordTypes';
import { VoicingGroups } from '../VoicingGroups';
import { findVoicings, voicingCaption, voicingKey, type Voicing } from '../voicings';
import { ChordPickers } from './ChordPickers';
import {
  CHORD_LIBRARY_MAX_FRET, CHORD_LIBRARY_STORAGE_KEY, parseChordLibrarySettings,
  type ChordLibrarySettings,
} from './settings';
import { VoicingStepper } from './VoicingStepper';

/** "Open 1 of 3 · root on A · frets 1–2" */
function stepperCaption(voicing: Voicing | undefined, open: Voicing[], moveable: Voicing[]): string {
  if (!voicing) return 'No playable shape';
  const inOpen = open.includes(voicing);
  const list = inOpen ? open : moveable;
  return `${inOpen ? 'Open' : 'Moveable'} ${list.indexOf(voicing) + 1} of ${list.length}`
    + ` · ${voicingCaption(voicing)}`;
}

/**
 * The Chord library page: pick a root and type, see one voicing on the
 * neck and every shape below it. The only component here with state: the
 * chord (saved), the shape on the neck and whether Moveable shows all.
 */
export default function ChordLibrary() {
  const [set, setSet] = useState(
    () => parseChordLibrarySettings(loadJson(CHORD_LIBRARY_STORAGE_KEY)),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  usePersist(CHORD_LIBRARY_STORAGE_KEY, set);

  // A new chord starts again from its first shape and its best few.
  const pick = (patch: Partial<ChordLibrarySettings>) => {
    setSet(s => ({ ...s, ...patch }));
    setSelectedKey(null);
    setShowAll(false);
  };

  const chord = useMemo(() => chordOf(set.root, set.type), [set.root, set.type]);
  const voicings = useMemo(() => findVoicings(chord), [chord]);
  const moveable = showAll ? voicings.allMoveable : voicings.moveable;
  // ‹ › walk the open shapes, then the moveable ones, as listed below.
  const sequence = [...voicings.open, ...moveable];
  const index = Math.max(0, sequence.findIndex(v => voicingKey(v) === selectedKey));
  const voicing = sequence[index];

  const boardLabel = voicing
    ? `${chord.symbol}, ${voicingCaption(voicing)}, on the fretboard`
    : `${chord.symbol} on the fretboard`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <header className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h1 className="m-0" aria-live="polite">
            {chord.symbol}{' '}
            <span className="text-[0.6em] font-normal text-(--ink-muted)" data-testid="chord-formula">
              ({formulaOf(chord)})
            </span>
          </h1>
          <ChordPickers
            root={set.root} typeId={set.type}
            onRoot={root => pick({ root })} onType={type => pick({ type })}
          />
        </div>
        <p className="m-0 text-(--ink-muted)" data-testid="chord-notes">{chord.notes.join(' ')}</p>
      </header>

      <section className="card gap-4" aria-label="On the neck">
        <div className="board-scroll">
          <Fretboard
            minFret={0} maxFret={CHORD_LIBRARY_MAX_FRET}
            dots={voicing ? voicingDots(chord, voicing) : []}
            scrollToFret={voicing ? Math.min(...voicing.filter(f => f !== null)) : null}
            label={boardLabel}
          />
        </div>
        <VoicingStepper
          index={index} total={sequence.length}
          caption={stepperCaption(voicing, voicings.open, moveable)}
          onStep={by => setSelectedKey(voicingKey(sequence[index + by]))}
        />
      </section>

      <VoicingGroups
        chord={chord} voicings={voicings}
        showAll={showAll} onShowAll={setShowAll}
        selectedKey={voicing ? voicingKey(voicing) : null}
        onSelect={v => setSelectedKey(voicingKey(v))}
      />
    </div>
  );
}
