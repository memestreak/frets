'use client';

import { useMemo, useState } from 'react';
import { DotLabelsPicker, type DotLabels } from '@/components/DotLabels';
import { Fretboard, type FretDot } from '@/components/fretboard/Fretboard';
import { degreeColor, DEGREES } from '@/components/fretboard/theme';
import { useDeselect } from '@/hooks/useDeselect';
import { usePersist } from '@/hooks/usePersist';
import { useShortcuts } from '@/components/shortcuts/useShortcuts';
import type { ShortcutGroup } from '@/lib/shortcuts';
import { prettyNote } from '@/lib/theory/notes';
import { loadJson } from '@/lib/storage';
import { ChordLadder } from './ChordLadder';
import { DiatonicChords } from './DiatonicChords';
import { chordsInPosition, clampPosition, positionEnd } from './positions';
import { ScalePickers } from './ScalePanel';
import { StripTip } from './StripTip';
import {
  parseScaleLabSettings, SCALE_LAB_MAX_FRET, SCALE_LAB_STORAGE_KEY,
  type ScaleLabSettings,
} from './settings';
import { diatonicChords, type DiatonicChord } from '@/lib/theory/diatonic';
import {
  modeFamily, rotateMode, scaleDef, scaleOf, type Root, type ScaleDef,
} from '@/lib/theory/scales';
import { neckNotes, type NeckNote } from './neckNotes';

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

/** The page's keys, for the `?` overlay: `DiatonicChords`, `PositionShapes` and the Esc below. */
const SHORTCUTS: readonly ShortcutGroup[] = [{
  title: 'Scale lab',
  shortcuts: [
    { keys: ['Left', 'Right'], does: 'Last or next chord of the scale' },
    { keys: ['Up', 'Down'], does: 'Last or next shape of the chord' },
    { keys: ['Esc'], does: 'Let the chord go' },
  ],
}];

export default function ScaleLab() {
  useShortcuts(SHORTCUTS);
  const [set, setSet] = useState(
    () => parseScaleLabSettings(loadJson(SCALE_LAB_STORAGE_KEY)),
  );
  const [chordIndex, setChordIndex] = useState<number | null>(null);
  // The neck shows every chord tone around the shape; not saved.
  const [arpeggio, setArpeggio] = useState(false);
  // Which shape each chord shows in the position, by chord index. Kept for
  // one scale, chord size and position (`for`); anything else starts again.
  const [shapePicks, setShapePicks] = useState({ for: '', byChord: {} as Record<number, number> });
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
    setArpeggio(false);
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
  const selectChord = (c: DiatonicChord | null) => {
    setChordIndex(c?.index ?? null);
    if (!c) setArpeggio(false);
  };

  const inPosition = useMemo(
    () => chordsInPosition(chords, set.position),
    [chords, set.position],
  );
  const picksFor = `${scale.root} ${scale.type.id} ${set.chordSize} ${set.position}`;
  const shapeIndexOf = (index: number) =>
    shapePicks.for === picksFor ? shapePicks.byChord[index] ?? 0 : 0;
  const shapeIndex = chord ? shapeIndexOf(chord.index) : 0;
  const shape = chord ? inPosition[chord.index]?.shapes[shapeIndex] ?? null : null;
  const pickShape = (chordAt: number, index: number) => {
    setShapePicks(p => ({
      for: picksFor,
      byChord: { ...(p.for === picksFor ? p.byChord : {}), [chordAt]: index },
    }));
  };

  // With a chord selected, a press on anything but a control, or Esc, goes back to the scale.
  useDeselect(chordIndex !== null, () => selectChord(null));

  // The title stays the scale's; a selected chord shows on the board and the diagram.
  const title = `${prettyNote(scale.root)} ${scale.type.title}`;
  const boardLabel = chord ? `${chord.symbol} in ${title}` : title;
  // A selected chord shows its shape; with the arpeggio on, every chord
  // tone too, labelled as the shape is. A chord with no shape here shows
  // every tone.
  const onShape = (n: NeckNote) => shape?.[n.s] === n.f;
  const notes = neckNotes(scale, SCALE_LAB_MAX_FRET, chord);
  const dots = (shape && !arpeggio ? notes.filter(onShape) : notes)
    .map(n => toDot(n, set.labels));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <header className="scale-head">
        <div className="scale-head-title" aria-live="polite">
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
        <div className="scale-head-strip">
          <StripTip enabled={!!stripTap} shown={title}>
            <ChordLadder
              scale={scale} chord={null} intervals="root" octaves={1} from={from}
              tap={stripTap ?? undefined}
            />
          </StripTip>
        </div>
      </header>

      <section className="card gap-4" aria-labelledby="neck-h">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <h2 id="neck-h" className="m-0 mr-auto text-[17px] leading-6">On the neck</h2>
          <DotLabelsPicker value={set.labels} onChange={labels => update({ labels })} />
        </div>
        <div className="board-scroll">
          <Fretboard
            minFret={0}
            maxFret={SCALE_LAB_MAX_FRET}
            dots={dots}
            // The position is outlined only while a chord is selected.
            box={chord
              ? { from: set.position === 1 ? 0 : set.position, to: positionEnd(set.position) }
              : null}
            scrollToFret={chord ? set.position + 2 : null}
            label={`${boardLabel} on the fretboard`}
          />
        </div>
      </section>

      <DiatonicChords
        scale={scale}
        chords={chords}
        inPosition={inPosition}
        selected={chord}
        onSelect={selectChord}
        size={set.chordSize}
        onSize={chordSize => update({ chordSize })}
        position={set.position}
        onPosition={first => update({ position: clampPosition(first) })}
        shapeIndexOf={shapeIndexOf}
        onShapeIndex={pickShape}
        arpeggio={arpeggio}
        onArpeggio={setArpeggio}
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
