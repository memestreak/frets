'use client';

import { useMemo, useState } from 'react';
import { Segmented } from '@/components/controls';
import { Fretboard, type FretDot } from '@/components/fretboard/Fretboard';
import { degreeColor, DEGREES } from '@/components/fretboard/theme';
import { usePersist } from '@/hooks/usePersist';
import { prettyNote } from '@/lib/notation';
import { loadJson } from '@/lib/storage';
import { ChordStrip } from './ChordStrip';
import { ChordLadder } from './ChordLadder';
import { ScalePickers } from './ScalePanel';
import { StripTip } from './StripTip';
import {
  parseScaleLabSettings, SCALE_LAB_MAX_FRET, SCALE_LAB_STORAGE_KEY,
  type DotLabels, type ScaleLabSettings,
} from './settings';
import {
  diatonicChords, modeFamily, neckNotes, rotateMode, scaleDef, scaleOf,
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
  // A chord belongs to one scale; the size keeps it.
  const pick = (root: Root, type: ScaleDef) => {
    update({ root, scale: type.id, mode: 0 });
    setChordIndex(null);
  };
  // Rotating keeps the same seven chords, so the selected one stays, as
  // many places along as the root moved.
  const goToMode = (mode: number) => {
    const by = mode - set.mode;
    update({ mode });
    setChordIndex(i => (i === null ? null : (i - by + 7) % 7));
  };
  // Where the picked root sits above the shown one: the diagrams start there.
  const from = (12 - shown.shift) % 12;
  const modeTitle = (step: number) => {
    const m = rotateMode(set.root, picked, (step + 7) % 7);
    return `${prettyNote(m.root)} ${m.type.title}`;
  };
  // Tapping a note in the strip rotates to it; the strip starts on the
  // picked root, so a cell is that many semitones above it.
  const pickedDegrees = scaleOf(set.root, picked).degrees;
  const modeAtCell = (cell: number) => pickedDegrees.findIndex(d => d.semis === cell % 12);
  const stripTap = modeFamily(picked) ? {
    label: (cell: number) => {
      const mode = modeAtCell(cell);
      if (mode < 0 || mode === set.mode) return null;
      const { root } = rotateMode(set.root, picked, mode);
      return `Make ${prettyNote(root)} the root: ${modeTitle(mode)}`;
    },
    onTap: (cell: number) => goToMode(modeAtCell(cell)),
  } : null;
  const chords = useMemo(
    () => diatonicChords(scale, set.chordSize),
    [scale, set.chordSize],
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
          <div aria-live="polite">
            <h1 className="m-0">{title}</h1>
            <p className="m-0 mt-1 text-[17px] leading-6 [word-spacing:0.25em] text-(--ink-muted)" data-testid="scale-formula">
              {scale.degrees.map(d => d.label).join(' ')}
            </p>
          </div>
          <ScalePickers
            scale={scale}
            onRoot={root => pick(root, shown.type)}
            onScale={id => pick(shown.root, scaleDef(id)!)}
            home={set.mode ? modeTitle(0) : null}
            onReset={() => goToMode(0)}
          />
        </div>
        <StripTip enabled={!!stripTap} shown={title}>
          <ChordLadder
            scale={scale} chord={null} intervals="root" octaves={1} from={from}
            tap={stripTap ?? undefined}
          />
        </StripTip>
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
