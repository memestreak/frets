'use client';

import { useMemo, useState } from 'react';
import { Segmented } from '@/components/controls';
import { Fretboard, type FretDot } from '@/components/fretboard/Fretboard';
import { degreeColor } from '@/components/fretboard/theme';
import { usePersist } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { ChordStrip } from './ChordStrip';
import { ChordLadder } from './ChordLadder';
import { DEGREES, ScalePickers } from './ScalePanel';
import {
  parseScaleLabSettings, SCALE_LAB_MAX_FRET, SCALE_LAB_STORAGE_KEY,
  type DotLabels, type ScaleLabSettings,
} from './settings';
import {
  diatonicChords, modeFamily, neckNotes, prettyNote, rotateMode, scaleDef, scaleOf,
  type NeckNote, type Root, type ScaleDef,
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

export default function ScaleLab() {
  const [set, setSet] = useState(
    () => parseScaleLabSettings(loadJson(SCALE_LAB_STORAGE_KEY)),
  );
  const [chordIndex, setChordIndex] = useState<number | null>(null);
  usePersist(SCALE_LAB_STORAGE_KEY, set);

  const update = (patch: Partial<ScaleLabSettings>) => setSet(s => ({ ...s, ...patch }));

  const picked = scaleDef(set.scale)!;
  const shown = rotateMode(set.root, picked, set.mode);
  const scale = useMemo(() => {
    const { root, type } = rotateMode(set.root, scaleDef(set.scale)!, set.mode);
    return scaleOf(root, type);
  }, [set.root, set.scale, set.mode]);

  // A dropdown starts again from what it shows: the strip begins at the root.
  // A chord belongs to one scale; the size and numerals keep it.
  const pick = (root: Root, type: ScaleDef) => {
    update({ root, scale: type.id, mode: 0 });
    setChordIndex(null);
  };
  // Rotating keeps the same seven chords, so the selected one stays, one
  // place along.
  const rotate = (dir: 1 | -1) => {
    update({ mode: (set.mode + dir + 7) % 7 });
    setChordIndex(i => (i === null ? null : (i - dir + 7) % 7));
  };
  // Where the picked root sits above the shown one: the diagrams start there.
  const from = (12 - shown.shift) % 12;
  const modeTitle = (step: number) => {
    const m = rotateMode(set.root, picked, (step + 7) % 7);
    return `${prettyNote(m.root)} ${m.type.title}`;
  };
  const modes = modeFamily(picked)
    ? { prev: modeTitle(set.mode - 1), next: modeTitle(set.mode + 1) }
    : null;
  const chords = useMemo(
    () => diatonicChords(scale, set.chordSize, set.numerals),
    [scale, set.chordSize, set.numerals],
  );
  const chord = chordIndex === null ? null : chords[chordIndex] ?? null;

  // The title stays the scale's; a selected chord shows on the board and the diagram.
  const title = `${prettyNote(scale.root)} ${scale.type.title}`;
  const boardLabel = chord ? `${chord.symbol} in ${title}` : title;
  const dots = neckNotes(scale, SCALE_LAB_MAX_FRET, chord).map(n => toDot(n, set.labels));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h1 className="m-0" aria-live="polite">
            {title}{' '}
            <span
              className="text-[0.6em] font-normal text-(--ink-muted)"
              data-testid="scale-formula"
            >
              ({scale.degrees.map(d => d.label).join(' ')})
            </span>
          </h1>
          <ScalePickers
            scale={scale}
            onRoot={root => pick(root, shown.type)}
            onScale={id => pick(shown.root, scaleDef(id)!)}
            modes={modes}
            onRotate={rotate}
          />
        </div>
        <ChordLadder scale={scale} chord={null} intervals="root" octaves={1} from={from} />
      </header>

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
            label={`${boardLabel} on the fretboard`}
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
        mode={set.mode}
        from={from}
      />
    </div>
  );
}
