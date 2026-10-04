'use client';

import { useMemo, useState } from 'react';
import { Segmented } from '@/components/controls';
import { Fretboard, type FretDot } from '@/components/fretboard/Fretboard';
import { degreeColor } from '@/components/fretboard/theme';
import { usePersist } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { ChordStrip } from './ChordStrip';
import { DEGREES, ScalePanel } from './ScalePanel';
import {
  parseScaleLabSettings, SCALE_LAB_MAX_FRET, SCALE_LAB_STORAGE_KEY,
  type DotLabels, type ScaleLabSettings,
} from './settings';
import {
  diatonicChords, neckNotes, prettyNote, scaleDef, scaleOf, type NeckNote,
} from './theory';

const LABEL_OPTS = [['interval', 'Interval'], ['note', 'Note'], ['none', 'None']] as const;

function dotLabel(n: NeckNote, labels: DotLabels): string {
  if (labels === 'note') return prettyNote(n.note);
  if (labels === 'interval') return n.label === '1' ? 'R' : n.label;
  return '';
}

function toDot(n: NeckNote, labels: DotLabels): FretDot {
  const label = dotLabel(n, labels);
  return {
    s: n.s, f: n.f, kind: n.degree === 1 ? 'root' : 'note',
    ...degreeColor(DEGREES[n.degree - 1]),
    shape: n.degree === 1 ? 'square' : 'circle',
    label, fontSize: label.length > 2 ? 9 : 11,
  };
}

function Fact({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-[12px] leading-4 font-medium text-(--ink-muted)">{name}</dt>
      <dd className="m-0 font-(family-name:--font-mono) text-[14px] font-medium">{value}</dd>
    </div>
  );
}

export default function ScaleLab() {
  const [set, setSet] = useState(
    () => parseScaleLabSettings(loadJson(SCALE_LAB_STORAGE_KEY)),
  );
  const [chordIndex, setChordIndex] = useState<number | null>(null);
  usePersist(SCALE_LAB_STORAGE_KEY, set);

  const update = (patch: Partial<ScaleLabSettings>) => {
    setSet(s => ({ ...s, ...patch }));
    // A chord belongs to one scale; the size and numerals keep it.
    if (patch.root || patch.scale) setChordIndex(null);
  };

  const scale = useMemo(
    () => scaleOf(set.root, scaleDef(set.scale)!), [set.root, set.scale],
  );
  const chords = useMemo(
    () => diatonicChords(scale, set.chordSize, set.numerals),
    [scale, set.chordSize, set.numerals],
  );
  const chord = chordIndex === null ? null : chords[chordIndex] ?? null;

  const scaleName = `${prettyNote(scale.root)} ${scale.type.title}`;
  const title = chord ? `${chord.symbol} in ${scaleName}` : scaleName;
  const shownNotes = chord ? chord.tones : scale.degrees.map(d => d.note);
  const formula = chord ? chord.labels : scale.degrees.map(d => d.label);
  const dots = neckNotes(scale, SCALE_LAB_MAX_FRET, chord).map(n => toDot(n, set.labels));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <header className="grid gap-1.5" aria-live="polite">
        <h1 className="m-0">{title}</h1>
        <dl className="m-0 flex flex-wrap gap-x-5 gap-y-1.5">
          <Fact name="Notes" value={shownNotes.map(prettyNote).join(' ')} />
          <Fact name="Formula" value={formula.join(' ')} />
          {!chord && <Fact name="Steps" value={scale.steps.join(' ')} />}
        </dl>
      </header>

      <ScalePanel
        scale={scale}
        onRoot={root => update({ root })}
        onScale={id => update({ scale: id })}
      />

      <section className="card gap-4" aria-labelledby="neck-h">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <h2 id="neck-h" className="m-0 mr-auto text-[17px] leading-6">On the neck</h2>
          <Segmented<DotLabels>
            label="Dot labels" options={LABEL_OPTS} value={set.labels}
            onChange={labels => update({ labels })}
          />
        </div>
        <div className="board-scroll">
          <Fretboard
            minFret={0}
            maxFret={SCALE_LAB_MAX_FRET}
            dots={dots}
            label={`${title} on the fretboard`}
          />
        </div>
      </section>

      <ChordStrip
        scale={scale}
        chords={chords}
        selected={chord}
        onSelect={c => setChordIndex(c?.index ?? null)}
        size={set.chordSize}
        onSize={chordSize => update({ chordSize })}
        numerals={set.numerals}
        onNumerals={numerals => update({ numerals })}
        view={set.chordView}
        onView={chordView => update({ chordView })}
        intervals={set.chordIntervals}
        onIntervals={chordIntervals => update({ chordIntervals })}
      />
    </div>
  );
}
