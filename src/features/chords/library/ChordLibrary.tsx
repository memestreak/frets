'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ToggleButton } from '@/components/controls';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { arpeggioDots, voicingDots } from '../chordDots';
import { ChordHeader } from '../ChordHeader';
import { chordOf, formulaOf } from '../chordTypes';
import { VoicingGroups } from '../VoicingGroups';
import { findVoicings, voicingCaption, voicingKey, type Voicing } from '../voicings';
import { ChordPickers } from './ChordPickers';
import {
  CHORD_PARAM, chordFromSlug, chordHref, chordSlug, type ChordChoice,
} from './chordUrls';
import { VoicingStepper } from './VoicingStepper';

/** The neck shows the open strings through this fret. */
const MAX_FRET = 15;

/** "Open 1 of 3 · root on A · frets 1–2" */
function stepperCaption(voicing: Voicing | undefined, open: Voicing[], moveable: Voicing[]): string {
  if (!voicing) return 'No playable shape';
  const inOpen = open.includes(voicing);
  const list = inOpen ? open : moveable;
  return `${inOpen ? 'Open' : 'Moveable'} ${list.indexOf(voicing) + 1} of ${list.length}`
    + ` · ${voicingCaption(voicing)}`;
}

/** "A, C, E and G" */
function listNotes(notes: string[]): string {
  return notes.length < 2 ? notes.join('') : `${notes.slice(0, -1).join(', ')} and ${notes.at(-1)}`;
}

/**
 * The Chord library page. The chord comes from the URL
 * (/chords/library?chord=am7b5), and picking another goes to its URL, so
 * links and Back work. A key per chord starts each one again from its
 * first shape and its best few; the Arpeggio switch lives here, so it
 * stays on from one chord to the next.
 */
export default function ChordLibraryPage() {
  const choice = chordFromSlug(useSearchParams().get(CHORD_PARAM));
  const slug = chordSlug(choice);
  const [arpeggio, setArpeggio] = useState(false);
  return (
    <ChordLibrary key={slug} choice={choice} arpeggio={arpeggio} onArpeggio={setArpeggio} />
  );
}

interface ChordLibraryProps {
  choice: ChordChoice;
  /** Whether the neck shows every chord tone instead of a shape. */
  arpeggio: boolean;
  onArpeggio: (on: boolean) => void;
}

/**
 * One chord: one voicing or the whole arpeggio on the neck, and every
 * shape below it. The Arpeggio button is picked like one more shape:
 * pressing it clears the chosen shape, and choosing a shape (tap, ‹ ›,
 * arrow keys) clears it. Its own state: the last shape chosen and
 * whether Moveable shows all.
 */
function ChordLibrary({ choice, arpeggio, onArpeggio }: ChordLibraryProps) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const pick = (patch: Partial<ChordChoice>) =>
    router.push(chordHref({ ...choice, ...patch }), { scroll: false });

  const chord = useMemo(() => chordOf(choice.root, choice.type), [choice.root, choice.type]);
  const voicings = useMemo(() => findVoicings(chord), [chord]);
  const moveable = showAll ? voicings.allMoveable : voicings.moveable;
  // ‹ › walk the open shapes, then the moveable ones, as listed below.
  const sequence = [...voicings.open, ...moveable];
  // With the arpeggio picked no shape is chosen, so › and → go to the first.
  const index = arpeggio
    ? -1
    : Math.max(0, sequence.findIndex(v => voicingKey(v) === selectedKey));
  const voicing: Voicing | undefined = sequence[index];
  const select = (v: Voicing) => {
    setSelectedKey(voicingKey(v));
    onArpeggio(false);
  };

  const onBoard = arpeggio ? `${chord.symbol} arpeggio`
    : voicing ? `${chord.symbol}, ${voicingCaption(voicing)}`
    : chord.symbol;
  const dots = arpeggio
    ? arpeggioDots(chord, MAX_FRET)
    : voicing ? voicingDots(chord, voicing) : [];
  const caption = arpeggio
    ? `Arpeggio · every ${listNotes(chord.notes)} up to fret ${MAX_FRET}`
    : stepperCaption(voicing, voicings.open, moveable);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <ChordHeader title={chord.symbol} formula={formulaOf(chord)} notes={chord.notes.join(' ')}>
        <ChordPickers
          root={choice.root} typeId={choice.type}
          onRoot={root => pick({ root })} onType={type => pick({ type })}
        />
      </ChordHeader>

      <section className="card gap-4" aria-label="On the neck">
        <div className="board-scroll">
          <Fretboard
            minFret={0} maxFret={MAX_FRET}
            dots={dots}
            scrollToFret={voicing ? Math.min(...voicing.filter(f => f !== null)) : null}
            label={`${onBoard} on the fretboard`}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <VoicingStepper
            index={index} total={sequence.length}
            caption={caption}
            onStep={by => select(sequence[index + by])}
          />
          <ToggleButton pressed={arpeggio} onClick={() => onArpeggio(true)}>
            Arpeggio
          </ToggleButton>
        </div>
      </section>

      <VoicingGroups
        chord={chord} voicings={voicings} showKey
        showAll={showAll} onShowAll={setShowAll}
        selectedKey={voicing ? voicingKey(voicing) : null}
        onSelect={select}
      />
    </div>
  );
}
