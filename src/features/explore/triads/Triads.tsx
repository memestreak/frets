'use client';

import { useEffect, useMemo, useState } from 'react';
import { voicingDots } from '@/components/chords/chordDots';
import { Segmented } from '@/components/controls';
import { DotLabelsPicker } from '@/components/DotLabels';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { KeyPicker } from '@/components/KeyPicker';
import { usePersist } from '@/hooks/usePersist';
import { chordOf, chordRootOf } from '@/lib/chords/chordTypes';
import { loadJson } from '@/lib/storage';
import {
  parseTriadsSettings, TRIADS_STORAGE_KEY, type TriadsSettings,
} from './settings';
import {
  gripAt, gripCaption, INVERSION_NAMES, setLabel, setStrings, STRING_SETS,
  TRIAD_TYPES, TRIADS_MAX_FRET, triadGrips,
} from './triads';

/** How far the grips other than the picked one, and the strings off the set, fade. */
const FADED = 0.25;
const OFF_SET_STRING = 0.35;

export default function Triads() {
  const [set, setSet] = useState(() => parseTriadsSettings(loadJson(TRIADS_STORAGE_KEY)));
  // The picked grip, by index into `grips`; not saved.
  const [picked, setPicked] = useState<number | null>(null);
  usePersist(TRIADS_STORAGE_KEY, set);

  // Anything that changes the grips clears the pick.
  const update = (patch: Partial<TriadsSettings>) => {
    if (!('labels' in patch)) setPicked(null);
    setSet(s => ({ ...s, ...patch }));
  };

  const chord = useMemo(() => chordOf(set.root, set.triad), [set.root, set.triad]);
  const grips = useMemo(() => triadGrips(chord, set.strings), [chord, set.strings]);
  const grip = picked === null ? null : grips[picked];
  const strings = setStrings(set.strings);
  const opacityOf = (i: number) => (picked === null || i === picked ? 1 : FADED);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setPicked(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const dots = grips.flatMap((g, i) =>
    voicingDots(chord, g.voicing, set.labels).map(d => ({ ...d, opacity: opacityOf(i) })));
  const links = grips.map((g, i) => ({
    points: g.points, label: INVERSION_NAMES[g.inversion], opacity: opacityOf(i),
  }));
  // "D♭ augmented"
  const name = `${chord.notes[0]} ${chord.type!.name}`;
  const setName = setLabel(set.strings, '-');

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <header className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
        <div>
          <h1 className="m-0">Triads</h1>
          <p className="m-0 mt-1 text-(--ink-muted)">
            Every inversion of a triad on three neighbouring strings.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-x-10 gap-y-5" role="group" aria-label="Choose a triad">
          <div>
            <span className="field-label">Root</span>
            <KeyPicker
              value={set.root} resolve={chordRootOf}
              onPick={n => update({ root: chordRootOf(n) })}
            />
          </div>
          <div className="flex gap-x-10">
            <div>
              <span className="field-label">Triad</span>
              <Segmented
                label="Triad" options={TRIAD_TYPES} value={set.triad} vertical
                onChange={triad => update({ triad })}
              />
            </div>
            <div>
              <span className="field-label">Strings</span>
              <Segmented
                label="Strings" options={[...STRING_SETS].reverse().map(n => [n, setLabel(n)] as const)}
                value={set.strings} onChange={strings => update({ strings })} vertical
              />
            </div>
          </div>
        </div>
      </header>

      <section className="card gap-4" aria-labelledby="neck-h">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <h2 id="neck-h" className="m-0 mr-auto text-[17px] leading-6">On the neck</h2>
          <DotLabelsPicker value={set.labels} onChange={labels => update({ labels })} />
        </div>
        <p className="m-0 min-h-6" aria-live="polite" data-testid="triad-caption">
          {grip
            ? <span className="font-semibold">{gripCaption(chord, grip)}</span>
            : (
              <span className="text-(--ink-muted)">
                {name} on the {setName} strings. Tap a grip to name it.
              </span>
            )}
        </p>
        <div className="board-scroll">
          <Fretboard
            minFret={0}
            maxFret={TRIADS_MAX_FRET}
            dots={dots}
            links={links}
            stringStyle={s => ({ opacity: strings.includes(s) ? 1 : OFF_SET_STRING })}
            onCellClick={pos => setPicked(gripAt(grips, pos, picked))}
            scrollToFret={grip ? grip.points[1].f : null}
            label={`${name} triads on the ${setName} strings`}
          />
        </div>
      </section>
    </div>
  );
}
