'use client';

import { useMemo, useReducer, useState } from 'react';
import { Segmented, ToggleButton } from '@/components/controls';
import { Fretboard, type FretDot } from '@/components/fretboard/Fretboard';
import { MAPLE_THEME as T, STATUS } from '@/components/fretboard/theme';
import {
  AnswerCard, AnswerGrid, FindPrompt, type AnswerButton, type FeedbackTone,
} from '@/components/quiz/AnswerCard';
import { BoardFrame } from '@/components/quiz/BoardFrame';
import { SessionStatsCard } from '@/components/quiz/SessionStatsCard';
import { SettingsDialog } from '@/components/quiz/SettingsDialog';
import { Field, FretInput, FretPair } from '@/components/quiz/SettingsParts';
import { TrainerHeader } from '@/components/quiz/TrainerHeader';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { usePersist } from '@/hooks/usePersist';
import { useQuizKeyboard } from '@/hooks/useQuizKeyboard';
import { setWindowMax, setWindowMin } from '@/lib/fretWindow';
import {
  activePool, clampHRange, correctFrets, generateIntervalQuestion, H_RANGE_MAX,
  inBox, INTERVAL_STORAGE_KEY, V_RANGE_MAX,
  type Direction, type IntervalMode, type IntervalSettings,
} from '@/lib/intervals';
import {
  ANSWER_KEYS, INTERVAL_LONG_NAMES, INTERVAL_NAMES, intervalClass, midi,
  samePos, SHARP_NAMES, SIMPLE_INTERVALS, STRINGS, type Position, type Rng,
} from '@/lib/music';
import { itemPercent } from '@/lib/stats';
import { initIntervalState, intervalReducer } from './intervalState';

const MODE_OPTS = [['name', 'Name it'], ['fret', 'Find it']] as const;
const DIR_OPTS = [
  ['asc', 'Asc from low'], ['desc', 'Desc from high'],
  ['rand', 'Random'], ['same', 'Same string'],
] as const;
const V_RANGE_OPTS = Array.from(
  { length: V_RANGE_MAX }, (_, i) => [i + 1, String(i + 1)] as const,
);
const DIR_DESC: Record<Direction, string> = {
  asc: 'Root on the lower string, interval ascends to the higher string.',
  desc: 'Root on the higher string, interval note below it on the lower string.',
  rand: 'Root on either string; direction changes every question.',
  same: 'Both notes on one string.',
};

const noteName = (s: number, f: number) => SHARP_NAMES[midi(s, f) % 12];
const missSuffix = (n: number) =>
  n ? ` (after ${n} ${n === 1 ? 'miss' : 'misses'})` : '';

export default function IntervalTrainer({ rng = Math.random }: { rng?: Rng }) {
  const [state, dispatch] = useReducer(intervalReducer, rng, initIntervalState);
  const [hint, setHint] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { set, stats, q, answered, wrong, picked } = state;
  const { mode } = set;
  const pool = activePool(set);

  const persisted = useMemo(() => ({ set, stats }), [set, stats]);
  usePersist(INTERVAL_STORAGE_KEY, persisted);

  const next = () => dispatch({ type: 'next', q: generateIntervalQuestion(set, rng, q) });
  const update = (patch: Partial<IntervalSettings>, regen = true) => {
    const s = { ...set, ...patch };
    dispatch({
      type: 'settings', set: s,
      q: regen ? generateIntervalQuestion(s, rng, q) : undefined,
    });
  };
  const answerName = (semis: number) => dispatch({ type: 'answerName', semis });

  // The quiz waits while the settings dialog covers it.
  useAutoAdvance(settingsOpen ? null : state.advanceMs, next);
  useQuizKeyboard({
    enabled: !settingsOpen,
    answered,
    pause: set.pause,
    onNext: next,
    onHint: setHint,
    onAnswerKey: key => {
      if (mode !== 'name') return;
      const semis = ANSWER_KEYS.indexOf(key as (typeof ANSWER_KEYS)[number]) + 1;
      if (semis > 0 && pool.includes(semis)) answerName(semis);
    },
  });

  // The box around the root: what the ranges allow for this question.
  const lit = (pos: Position) => !!q && inBox(q.root, q.up, pos, set);

  // Board dots: hint overlay, root, target / answer, wrong taps.
  const dots: FretDot[] = [];
  if (q) {
    const rootMidi = midi(q.root.s, q.root.f);
    if (hint) {
      for (const s of STRINGS) {
        for (let f = set.minFret; f <= set.maxFret; f++) {
          if (!lit({ s, f })) continue;
          const c = intervalClass(midi(s, f) - rootMidi);
          dots.push({
            s, f, kind: 'hint', fill: T.hintFill, stroke: T.hintStroke, fg: T.hintFg,
            label: c === 0 ? 'R' : INTERVAL_NAMES[c], fontSize: 10,
          });
        }
      }
    }
    dots.push({
      ...q.root, kind: 'root', fill: T.rootFill, stroke: T.rootFill, fg: T.rootFg,
      label: set.noteNames ? noteName(q.root.s, q.root.f) : 'R', fontSize: 12,
    });
    if (mode === 'name' || answered) {
      const at = picked ?? q.tgt;
      if (mode === 'fret' && !hint) {
        // Other fingerings of the interval inside the box. The hint already
        // labels those cells, so the two never overprint.
        for (const p of correctFrets(q, set)) {
          if (samePos(p, at)) continue;
          dots.push({
            ...p, kind: 'also', fill: 'transparent', stroke: STATUS.green,
            fg: STATUS.greenDeep, label: INTERVAL_NAMES[q.semis], fontSize: 10,
          });
        }
      }
      const fill = answered ? STATUS.green : T.tgtFill;
      dots.push({
        ...at, kind: 'target', fill, stroke: fill, fg: T.tgtFg,
        label: answered
          ? INTERVAL_NAMES[q.semis]
          : set.noteNames ? noteName(at.s, at.f) : '?',
        fontSize: answered ? 10 : 12,
      });
    }
    if (mode === 'fret') {
      for (const w of wrong) {
        if (typeof w === 'number') continue;
        dots.push({
          ...w, kind: 'wrong', fill: 'transparent', stroke: STATUS.red, fg: STATUS.red,
          label: '✕', fontSize: 12, opacity: 0.9,
        });
      }
    }
  }

  const answerButtons: AnswerButton[] = pool.map(semis => ({
    label: INTERVAL_NAMES[semis],
    keyLabel: ANSWER_KEYS[semis - 1],
    state: wrong.includes(semis)
      ? 'wrong'
      : answered && q?.semis === semis ? 'correct' : 'idle',
    onClick: () => answerName(semis),
  }));

  let feedback = '';
  let tone: FeedbackTone = 'neutral';
  if (!q) {
    feedback = 'No question fits these settings — widen the ranges or interval pool.';
  } else if (answered) {
    feedback = `Correct — ${INTERVAL_NAMES[q.semis]}, ${INTERVAL_LONG_NAMES[q.semis]}`
      + missSuffix(wrong.length);
    tone = 'success';
  } else if (wrong.length) {
    const last = wrong[wrong.length - 1];
    feedback = `Not ${typeof last === 'number' ? INTERVAL_NAMES[last] : 'that fret'} — try again`;
    tone = 'danger';
  }

  const togglePool = (semis: number) => update({
    pool: set.pool.includes(semis)
      ? set.pool.filter(x => x !== semis)
      : [...set.pool, semis].sort((a, b) => a - b),
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <TrainerHeader
        kicker="Fretboard · Interval trainer"
        title={mode === 'name' ? 'Name the interval' : 'Find the fret'}
        sub={(mode === 'name'
          ? 'What interval of the root is the dot? '
          : 'Tap the fret that lands on the interval. ') + DIR_DESC[set.dir]}
        controls={(
          <>
            <Segmented<IntervalMode>
              label="Mode" options={MODE_OPTS} value={mode}
              onChange={v => update({ mode: v })}
            />
            <Segmented<Direction>
              label="Direction" options={DIR_OPTS} value={set.dir}
              onChange={v => update({ dir: v })}
            />
          </>
        )}
        pause={set.pause}
        onTogglePause={() => dispatch({ type: 'togglePause' })}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        footnote="Standard tuning · E A D G B E · low E drawn on the bottom"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-7 gap-y-[18px]">
          <Field label="Vertical range" note="Same string questions ignore this.">
            <Segmented<number>
              label="Vertical range" options={V_RANGE_OPTS} value={set.vRange}
              onChange={v => update({ vRange: v })}
            />
          </Field>
          <Field label="Horizontal range">
            <FretPair>
              <FretInput
                label="Horizontal range" min={1} max={H_RANGE_MAX} value={set.hRange}
                onCommit={v => {
                  // Clamping can land on the current value; keep the question.
                  const hRange = clampHRange(v);
                  if (hRange !== set.hRange) update({ hRange });
                }}
              />
              <span className="text-muted">frets</span>
            </FretPair>
          </Field>
          <Field label="Fret range">
            <FretPair>
              <FretInput
                label="Lowest fret" min={0} max={23} value={set.minFret}
                onCommit={v => update(setWindowMin(set, v))}
              />
              <span className="text-muted">to</span>
              <FretInput
                label="Highest fret" min={1} max={24} value={set.maxFret}
                onCommit={v => update(setWindowMax(set, v))}
              />
            </FretPair>
          </Field>
          <Field label="Display">
            <div className="flex flex-wrap gap-2">
              <ToggleButton
                pressed={set.noteNames}
                onClick={() => update({ noteNames: !set.noteNames }, false)}
              >
                Note names
              </ToggleButton>
              <ToggleButton
                pressed={set.compound}
                onClick={() => update({ compound: !set.compound })}
              >
                Allow spans over an octave
              </ToggleButton>
            </div>
          </Field>
        </div>
        <Field label="Intervals in the pool">
          <div className="flex flex-wrap gap-1.5">
            {SIMPLE_INTERVALS.map(semis => (
              <ToggleButton
                key={semis}
                className="chip"
                pressed={set.pool.includes(semis)}
                onClick={() => togglePool(semis)}
                aria-label={`${INTERVAL_NAMES[semis]}, ${INTERVAL_LONG_NAMES[semis]}`}
              >
                {INTERVAL_NAMES[semis]}
              </ToggleButton>
            ))}
          </div>
        </Field>
      </SettingsDialog>

      <div className="grid grid-cols-[minmax(0,1fr)] content-start">
        <AnswerCard
          kicker={mode === 'name' ? 'Your answer' : 'Target'}
          keyHint={mode === 'name' ? 'Keys 1–9, 0, −, =' : 'Tap a fret on the board'}
          feedback={feedback}
          tone={tone}
          answered={answered}
          pause={set.pause}
          onSkip={next}
          onNext={next}
        >
          {mode === 'name' && <AnswerGrid buttons={answerButtons} variant="interval" />}
          {mode === 'fret' && q && (
            <FindPrompt label={INTERVAL_NAMES[q.semis]}>
              {INTERVAL_LONG_NAMES[q.semis]}{' '}
              <span className="text-muted">
                {q.up ? 'above the root' : 'of the root, played below it'}
              </span>
            </FindPrompt>
          )}
        </AnswerCard>
        <BoardFrame
          legend={[
            { label: 'Root', color: T.rootFill, shape: 'circle' },
            {
              label: mode === 'name' ? 'Interval note' : 'Your answer',
              color: T.tgtFill, shape: 'circle',
            },
          ]}
          hint={hint}
          onHint={setHint}
          hintActiveLabel="Intervals from root"
        >
          <Fretboard
            minFret={set.minFret}
            maxFret={set.maxFret}
            dots={dots}
            scrollToFret={q?.root.f}
            onCellClick={mode === 'fret' && !answered && q
              ? pos => dispatch({ type: 'answerFret', pos })
              : undefined}
            isCellDisabled={pos => wrong.some(
              w => typeof w !== 'number' && w.s === pos.s && w.f === pos.f,
            )}
            isCellDimmed={mode === 'fret' && q ? pos => !lit(pos) : undefined}
          />
        </BoardFrame>
        <SessionStatsCard
          stats={stats}
          itemLabel="Per interval"
          labelWidth={34}
          rows={pool.map(semis => ({
            label: INTERVAL_NAMES[semis], pct: itemPercent(stats, semis),
          }))}
          onReset={() => dispatch({ type: 'resetStats' })}
        />
      </div>
    </div>
  );
}
