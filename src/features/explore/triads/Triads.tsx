'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { arpeggioDots, voicingDots } from '@/components/chords/chordDots';
import { ToggleButton } from '@/components/controls';
import { DotLabelsPicker } from '@/components/DotLabels';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { KeyPicker } from '@/components/KeyPicker';
import { usePersist } from '@/hooks/usePersist';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { chordOf, chordRootOf } from '@/lib/chords/chordTypes';
import { loadJson } from '@/lib/storage';
import {
  parseTriadsSettings, TRIADS_STORAGE_KEY, type TriadsSettings,
} from './settings';
import {
  gripAt, gripCaption, INVERSION_NAMES, setLabel, setStrings, STRING_SETS,
  TRIAD_TYPES, TRIADS_MAX_FRET, triadGrips, type StringSet, type TriadType,
} from './triads';

/** How far the grips other than the picked one, and the strings off the set, fade. */
const FADED = 0.25;
const OFF_SET_STRING = 0.35;

export default function Triads() {
  const [set, setSet] = useState(() => parseTriadsSettings(loadJson(TRIADS_STORAGE_KEY)));
  // The picked grip, by index into `grips`; not saved.
  const [picked, setPicked] = useState<number | null>(null);
  // Every tone of the triad over the whole neck, as on the Chords page; not saved.
  const [arpeggio, setArpeggio] = useState(false);
  const toggleArpeggio = useCallback(() => setArpeggio(on => !on), []);
  useSpaceKey(toggleArpeggio);
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

  const dots = arpeggio
    ? arpeggioDots(chord, TRIADS_MAX_FRET, set.labels)
    : grips.flatMap((g, i) =>
      voicingDots(chord, g.voicing, set.labels).map(d => ({ ...d, opacity: opacityOf(i) })));
  const links = grips.map((g, i) => ({
    points: g.points, label: INVERSION_NAMES[g.inversion], opacity: opacityOf(i),
  }));
  // "D♭ augmented"
  const name = `${chord.notes[0]} ${chord.type!.name}`;
  const setName = setLabel(set.strings, '-');

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      {/* As on the Chords page: the pickers on the right, labelled from the
          top, their labels level with the title and their tops level. */}
      <header className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
        <h1 className="m-0">Triads</h1>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <label className="block">
            <span className="field-label">Triad</span>
            <select
              className="input w-auto" value={set.triad}
              onChange={e => update({ triad: e.target.value as TriadType })}
            >
              {TRIAD_TYPES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Strings</span>
            <select
              className="input w-auto" value={set.strings}
              onChange={e => update({ strings: Number(e.target.value) as StringSet })}
            >
              {[...STRING_SETS].reverse().map(n => <option key={n} value={n}>{setLabel(n)}</option>)}
            </select>
          </label>
          <div>
            {/* The picker names itself (aria-label "Root"); this is the visible label. */}
            <span className="field-label" aria-hidden>Root</span>
            <KeyPicker
              value={set.root} resolve={chordRootOf}
              onPick={n => update({ root: chordRootOf(n) })}
            />
          </div>
        </div>
      </header>

      <section className="card gap-4" aria-label="On the neck">
        <div className="board-scroll">
          <Fretboard
            minFret={0}
            maxFret={TRIADS_MAX_FRET}
            dots={dots}
            links={links}
            stringStyle={s => ({ opacity: arpeggio || strings.includes(s) ? 1 : OFF_SET_STRING })}
            onCellClick={pos => setPicked(gripAt(grips, pos, picked))}
            scrollToFret={grip ? grip.points[1].f : null}
            label={`${name} triads on the ${setName} strings`}
          />
        </div>
        {/* Under the neck, as on the Chords page: the caption, then the labels and Arpeggio. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="m-0" aria-live="polite" data-testid="triad-caption">
            {grip
              ? <span className="font-semibold">{gripCaption(chord, grip)}</span>
              : (
                <span className="text-(--ink-muted)">
                  {name} on the {setName} strings. Tap a grip to name it.
                </span>
              )}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <DotLabelsPicker value={set.labels} onChange={labels => update({ labels })} />
            <ToggleButton pressed={arpeggio} onClick={toggleArpeggio}>
              Arpeggio
            </ToggleButton>
          </div>
        </div>
      </section>
    </div>
  );
}
