'use client';

import { Segmented, ToggleButton } from '@/components/controls';
import { Fretboard, type FretDot } from '@/components/fretboard/Fretboard';
import { degreeColor, DOT, type Degree } from '@/components/fretboard/theme';
import {
  AnswerCard, AnswerGrid, FindPrompt, type AnswerButton,
} from '@/features/practice/quiz/AnswerCard';
import { answerState, attemptDots, attemptFeedback } from '@/features/practice/quiz/attempt';
import { BoardFrame } from '@/features/practice/quiz/BoardFrame';
import { SessionStatsCard } from '@/features/practice/quiz/SessionStatsCard';
import { SettingsDialog } from '@/features/practice/quiz/SettingsDialog';
import { Field, FretInput, FretPair } from '@/features/practice/quiz/SettingsParts';
import { TrainerHeader } from '@/features/practice/quiz/TrainerHeader';
import { wasTapped } from '@/features/practice/quiz/trainerState';
import { useTrainer } from '@/features/practice/quiz/useTrainer';
import { setWindowMax, setWindowMin } from '@/lib/fretWindow';
import {
  activePool, correctFrets, generateIntervalQuestion, H_RANGE_MAX,
  INTERVAL_STORAGE_KEY, resetIntervalSettings, V_RANGE_MAX, withHRange, withVRange,
  type Direction, type IntervalMode, type IntervalSettings,
} from '@/features/practice/intervals/intervals';
import {
  INTERVAL_LONG_NAMES, INTERVAL_NAMES, intervalClass, midi,
  samePos, SHARP_NAMES, SIMPLE_INTERVALS, STRINGS, type Rng,
} from '@/lib/music';
import { itemPercent } from '@/features/practice/quiz/stats';
import { initIntervalState, intervalReducer } from './intervalState';

const MODE_OPTS = [['name', 'Name it'], ['fret', 'Find it']] as const;
const DIR_OPTS = [
  ['asc', 'Ascending'], ['desc', 'Descending'],
  ['rand', 'Ascending and Descending'],
] as const;
const V_RANGE_OPTS = Array.from(
  { length: V_RANGE_MAX }, (_, i) => [i + 1, String(i + 1)] as const,
);

const noteName = (s: number, f: number) => SHARP_NAMES[midi(s, f) % 12];
/** Answer keys name the intervals in order, m2 first, when in the pool. */
const answerFor = (index: number, set: IntervalSettings) =>
  set.mode === 'name' && activePool(set).includes(index + 1) ? index + 1 : null;

/** Hint colour for each interval class (`intervalClass`), P1 to P8. */
const INTERVAL_DEGREE: readonly Degree[] = [
  'root', 'second', 'second', 'third', 'third', 'extension', 'extension',
  'fifth', 'sixth', 'sixth', 'seventh', 'seventh', 'root',
];

export default function IntervalTrainer({ rng = Math.random }: { rng?: Rng }) {
  const {
    state, dispatch, hint, toggleHint, settingsOpen, setSettingsOpen,
    next, update, applyDefaults, answerName, answerGridRef,
  } = useTrainer({
    reducer: intervalReducer, init: initIntervalState,
    storageKey: INTERVAL_STORAGE_KEY, generate: generateIntervalQuestion,
    rng, answerFor,
  });
  const { set, stats, q, answered, picked } = state;
  const { mode } = set;
  const pool = activePool(set);

  // Board dots: hint overlay, root, target / answer, wrong taps.
  const dots: FretDot[] = [];
  if (q) {
    const rootMidi = midi(q.root.s, q.root.f);
    if (hint) {
      for (const s of STRINGS) {
        for (let f = set.minFret; f <= set.maxFret; f++) {
          if (s === q.root.s && f === q.root.f) continue;
          const c = intervalClass(midi(s, f) - rootMidi);
          dots.push({
            s, f, kind: 'hint', ...degreeColor(INTERVAL_DEGREE[c]),
            shape: INTERVAL_DEGREE[c] === 'root' ? 'square' : 'circle',
            label: c === 0 ? 'R' : INTERVAL_NAMES[c], fontSize: 10,
          });
        }
      }
    }
    dots.push({
      ...q.root, kind: 'root', ...DOT.root, shape: 'square',
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
            ...p, kind: 'also', ...DOT.correct, opacity: 0.55,
            label: INTERVAL_NAMES[q.semis], fontSize: 10,
          });
        }
      }
      dots.push({
        ...at, kind: 'target', ...(answered ? DOT.correct : DOT.quiz),
        label: answered
          ? INTERVAL_NAMES[q.semis]
          : set.noteNames ? noteName(at.s, at.f) : '?',
        fontSize: answered ? 10 : 12,
      });
    }
    if (mode === 'fret') dots.push(...attemptDots(state, INTERVAL_NAMES[q.semis]));
  }

  const answerButtons: AnswerButton[] = pool.map(semis => ({
    label: INTERVAL_NAMES[semis],
    state: answerState(state, semis, q?.semis),
    onClick: () => answerName(semis),
  }));

  const { feedback, tone } = attemptFeedback(state, {
    none: 'No question fits these settings — widen the ranges or interval pool.',
    correct: q ? `${INTERVAL_NAMES[q.semis]}, ${INTERVAL_LONG_NAMES[q.semis]}` : '',
    far: 'Right interval, but outside your range — find a closer one',
    names: INTERVAL_NAMES,
  });

  const togglePool = (semis: number) => update({
    pool: set.pool.includes(semis)
      ? set.pool.filter(x => x !== semis)
      : [...set.pool, semis].sort((a, b) => a - b),
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <TrainerHeader
        title={mode === 'name' ? 'Name the interval' : 'Find the fret'}
        controls={(
          <Segmented<IntervalMode>
            label="Mode" options={MODE_OPTS} value={mode}
            onChange={v => update({ mode: v })}
          />
        )}
        pause={set.pause}
        onTogglePause={() => dispatch({ type: 'togglePause' })}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDefaults={() => applyDefaults(resetIntervalSettings(set))}
        footnote="Standard tuning · E A D G B E · low E drawn on the bottom"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-7 gap-y-[18px]">
          <Field label="Direction">
            <select
              className="input w-auto" aria-label="Direction" value={set.dir}
              onChange={e => update({ dir: e.target.value as Direction })}
            >
              {DIR_OPTS.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
            </select>
          </Field>
          <Field label="Vertical range" note="Strings, counting the root’s own.">
            <Segmented<number>
              label="Vertical range" options={V_RANGE_OPTS} value={set.vRange}
              onChange={v => update(withVRange(set, v))}
            />
          </Field>
          <Field label="Horizontal range" note="Frets, counting the root’s own.">
            <FretPair>
              <FretInput
                label="Horizontal range" min={1} max={H_RANGE_MAX} value={set.hRange}
                onCommit={v => {
                  // Clamping can land on the current value; keep the question.
                  const ranges = withHRange(set, v);
                  if (ranges.hRange !== set.hRange) update(ranges);
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
        <BoardFrame
          legend={[
            { label: 'Root', color: DOT.root.fill, shape: 'square' },
            {
              label: mode === 'name' ? 'Interval note' : 'Your answer',
              color: mode === 'name' ? DOT.quiz.fill : DOT.correct.fill,
              shape: 'circle',
            },
          ]}
          hint={hint}
          onToggleHint={toggleHint}
        >
          <Fretboard
            minFret={set.minFret}
            maxFret={set.maxFret}
            dots={dots}
            scrollToFret={q?.root.f}
            onCellClick={mode === 'fret' && !answered && q
              ? pos => dispatch({ type: 'answerFret', pos })
              : undefined}
            isCellDisabled={pos => wasTapped(state, pos)}
          />
        </BoardFrame>
        <AnswerCard
          kicker={mode === 'name' ? 'Your answer' : 'Target'}
          hint={mode === 'name' ? undefined : 'Tap a fret on the board'}
          feedback={feedback}
          tone={tone}
          answered={answered}
          pause={set.pause}
          onSkip={next}
          onNext={next}
        >
          {mode === 'name' && <AnswerGrid ref={answerGridRef} buttons={answerButtons} variant="interval" />}
          {mode === 'fret' && q && (
            <FindPrompt label={INTERVAL_NAMES[q.semis]}>
              {INTERVAL_LONG_NAMES[q.semis]}{' '}
              <span className="text-muted">
                {q.up ? 'above the root' : 'of the root, played below it'}
              </span>
            </FindPrompt>
          )}
        </AnswerCard>
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
