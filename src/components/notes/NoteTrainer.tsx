'use client';

import { useMemo, useReducer, useState } from 'react';
import { Segmented, ToggleButton } from '@/components/controls';
import { Fretboard, type FretDot } from '@/components/fretboard/Fretboard';
import { MAPLE_THEME as T, STATUS } from '@/components/fretboard/theme';
import {
  AnswerCard, AnswerGrid, FindPrompt, type AnswerButton, type FeedbackTone,
} from '@/components/quiz/AnswerCard';
import { BoardFrame, type LegendItem } from '@/components/quiz/BoardFrame';
import {
  Field, FretInput, FretPair, PerItemStats, SettingsDrawer,
} from '@/components/quiz/SettingsParts';
import { TrainerHeader } from '@/components/quiz/TrainerHeader';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { usePersist } from '@/hooks/usePersist';
import { useQuizKeyboard } from '@/hooks/useQuizKeyboard';
import { clampFret, setWindowMax, setWindowMin } from '@/lib/fretWindow';
import {
  ANSWER_KEYS, NOTE_LABELS, pitchClass, SHARP_NAMES, STRING_NAMES, STRINGS,
  type Rng,
} from '@/lib/music';
import {
  generateNoteQuestion, NOTE_STORAGE_KEY, targetRange,
  type NoteMode, type NoteSettings,
} from '@/lib/notes';
import { itemPercent, statsLine } from '@/lib/stats';
import { initNoteState, noteReducer } from './noteState';

const MODE_OPTS = [
  ['name', 'Name it'], ['string', 'Find on string'], ['range', 'Find in range'],
] as const;
const TITLES: Record<NoteMode, string> = {
  name: 'Name the note',
  string: 'Find it on the string',
  range: 'Find every one in range',
};
const DRAWER_ID = 'note-settings';
const BAND_FILL = 'color-mix(in srgb, var(--color-success) 50%, transparent)';

const missSuffix = (n: number) =>
  n ? ` (after ${n} ${n === 1 ? 'miss' : 'misses'})` : '';

export default function NoteTrainer({ rng = Math.random }: { rng?: Rng }) {
  const [state, dispatch] = useReducer(noteReducer, rng, initNoteState);
  const [hint, setHint] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const { set, stats, q, answered, wrong, found } = state;
  const { mode } = set;
  const [rA, rB] = targetRange(set);
  const rangeTxt = `frets ${rA}–${rB}`;
  const inScope = (s: number) => set.strings[s];

  const persisted = useMemo(() => ({ set, stats }), [set, stats]);
  usePersist(NOTE_STORAGE_KEY, persisted);

  const next = () => dispatch({
    type: 'next', q: generateNoteQuestion(set, q?.pc ?? null, rng),
  });
  const update = (patch: Partial<NoteSettings>, regen = true) => {
    const s = { ...set, ...patch };
    dispatch({
      type: 'settings', set: s,
      q: regen ? generateNoteQuestion(s, q?.pc ?? null, rng) : undefined,
    });
  };
  const answerName = (pc: number) => dispatch({ type: 'answerName', pc });

  useAutoAdvance(state.advanceMs, next);
  useQuizKeyboard({
    answered,
    pause: set.pause,
    onNext: next,
    onHint: setHint,
    onAnswerKey: key => {
      if (mode !== 'name') return;
      const pc = ANSWER_KEYS.indexOf(key as (typeof ANSWER_KEYS)[number]);
      if (pc >= 0) answerName(pc);
    },
  });

  const dots: FretDot[] = [];
  if (q) {
    if (hint) {
      for (const s of STRINGS) {
        for (let f = set.minFret; f <= set.maxFret; f++) {
          if (q.mode === 'name' && s === q.s && f === q.f) continue;
          dots.push({
            s, f, kind: 'hint', fill: T.hintFill, stroke: T.hintStroke, fg: T.hintFg,
            label: SHARP_NAMES[pitchClass(s, f)], fontSize: 10,
            opacity: inScope(s) ? 1 : 0.5,
          });
        }
      }
    }
    if (q.mode === 'name') {
      const fill = answered ? STATUS.green : T.tgtFill;
      dots.push({
        s: q.s, f: q.f, kind: 'target', fill, stroke: fill, fg: T.tgtFg,
        label: answered ? SHARP_NAMES[q.pc] : '?', fontSize: 12,
      });
    }
    for (const p of found) {
      dots.push({
        ...p, kind: 'found', fill: STATUS.green, stroke: STATUS.green, fg: T.tgtFg,
        label: SHARP_NAMES[q.pc], fontSize: 11,
      });
    }
    if (q.mode !== 'name') {
      for (const w of wrong) {
        if (typeof w === 'number') continue;
        dots.push({
          ...w, kind: 'wrong', fill: 'transparent', stroke: STATUS.red, fg: STATUS.red,
          label: '✕', fontSize: 12, opacity: 0.9,
        });
      }
    }
  }

  const answerButtons: AnswerButton[] = NOTE_LABELS.map((label, pc) => ({
    label,
    keyLabel: ANSWER_KEYS[pc],
    state: wrong.includes(pc)
      ? 'wrong'
      : answered && q?.pc === pc ? 'correct' : 'idle',
    onClick: () => answerName(pc),
  }));

  const noteName = q ? NOTE_LABELS[q.pc].replace('/', ' / ') : '';
  let feedback = '';
  let tone: FeedbackTone = 'neutral';
  if (!q) {
    feedback = 'No question fits these settings — check strings in scope and the ranges.';
  } else if (answered) {
    feedback = `Correct — ${noteName}${missSuffix(wrong.length)}`;
    tone = 'success';
  } else if (q.mode === 'range' && found.length) {
    feedback = `${found.length} of ${q.targets.length} found`;
    tone = 'success';
  } else if (wrong.length) {
    const last = wrong[wrong.length - 1];
    feedback = `Not ${typeof last === 'number' ? NOTE_LABELS[last] : 'that fret'} — try again`;
    tone = 'danger';
  }

  const legend: LegendItem[] = mode === 'name'
    ? [{ label: 'Note to name', color: T.tgtFill, shape: 'circle' }]
    : mode === 'string'
      ? [{ label: 'Target string', color: STATUS.green, shape: 'square' }]
      : [{ label: `Target range · ${rangeTxt}`, color: BAND_FILL, shape: 'square' }];

  const sub = mode === 'name'
    ? `Which note is the dot? Dots land on strings in scope within ${rangeTxt}.`
    : mode === 'string'
      ? 'Tap the note on the green string — any octave in the board window counts.'
      : `Tap every occurrence of the note inside the green band (${rangeTxt}) on the strings in scope.`;

  let findSub = '';
  if (q?.mode === 'string') findSub = `on the ${STRING_NAMES[q.s]} string`;
  if (q?.mode === 'range') {
    const n = q.targets.length;
    findSub = `${n} ${n === 1 ? 'occurrence' : 'occurrences'} in ${rangeTxt}`;
  }

  const toggleString = (s: number) => {
    const strings = [...set.strings];
    strings[s] = !strings[s];
    update({ strings });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <TrainerHeader
        kicker="Fretboard · Note trainer"
        title={TITLES[mode]}
        sub={sub}
        controls={(
          <Segmented<NoteMode>
            label="Mode" options={MODE_OPTS} value={mode}
            onChange={v => update({ mode: v })}
          />
        )}
        pause={set.pause}
        onTogglePause={() => dispatch({ type: 'togglePause' })}
        drawerOpen={drawer}
        onToggleDrawer={() => setDrawer(d => !d)}
        drawerId={DRAWER_ID}
      />

      {drawer && (
        <SettingsDrawer
          id={DRAWER_ID}
          footnote="Standard tuning · E A D G B E · low E drawn on the bottom · sharps and flats both accepted"
          onReset={() => dispatch({ type: 'resetStats' })}
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-7 gap-y-[18px]">
            <Field label="Strings in scope" note="Low E on the left.">
              <div className="flex flex-wrap gap-1.5">
                {STRINGS.map(s => (
                  <ToggleButton
                    key={s}
                    className="chip min-w-11!"
                    pressed={set.strings[s]}
                    onClick={() => toggleString(s)}
                    aria-label={`${STRING_NAMES[s]} string`}
                  >
                    {STRING_NAMES[s]}
                  </ToggleButton>
                ))}
              </div>
            </Field>
            <Field label="Board window">
              <FretPair>
                <FretInput
                  label="Lowest fret shown" min={0} max={23} value={set.minFret}
                  onCommit={v => update(setWindowMin(set, v))}
                />
                <span className="text-muted">to</span>
                <FretInput
                  label="Highest fret shown" min={1} max={24} value={set.maxFret}
                  onCommit={v => update(setWindowMax(set, v))}
                />
              </FretPair>
            </Field>
            <Field label="Target range" note="Used by “Name it” and “Find in range”.">
              <FretPair>
                <FretInput
                  label="Range start fret" min={0} max={24} value={set.rFrom}
                  onCommit={v => update({ rFrom: clampFret(v) })}
                />
                <span className="text-muted">to</span>
                <FretInput
                  label="Range end fret" min={0} max={24} value={set.rTo}
                  onCommit={v => update({ rTo: clampFret(v) })}
                />
              </FretPair>
            </Field>
          </div>
          <Field label="Session · per note">
            <PerItemStats
              labelWidth={52}
              rows={NOTE_LABELS.map((label, pc) => ({ label, pct: itemPercent(stats, pc) }))}
            />
          </Field>
        </SettingsDrawer>
      )}

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
          {mode === 'name' && <AnswerGrid buttons={answerButtons} variant="note" />}
          {mode !== 'name' && q && <FindPrompt label={noteName}>{findSub}</FindPrompt>}
        </AnswerCard>
        <BoardFrame legend={legend} hint={hint} onHint={setHint} hintActiveLabel="Note names">
          <Fretboard
            minFret={set.minFret}
            maxFret={set.maxFret}
            dots={dots}
            scrollToFret={q?.mode === 'name' ? q.f : q?.mode === 'range' ? rA : null}
            band={mode === 'range' ? { from: rA, to: rB, color: STATUS.green } : null}
            stringStyle={s => {
              const target = q?.mode === 'string' && q.s === s;
              return {
                color: target ? STATUS.green : undefined,
                width: target ? 3.5 : undefined,
                opacity: inScope(s) ? 1 : 0.3,
              };
            }}
            onCellClick={mode !== 'name' && !answered && q
              ? pos => dispatch({ type: 'answerFret', pos })
              : undefined}
            isCellDisabled={pos => found.some(p => p.s === pos.s && p.f === pos.f)
              || wrong.some(w => typeof w !== 'number' && w.s === pos.s && w.f === pos.f)}
          />
        </BoardFrame>
        <p className="text-muted m-0 px-1 text-[12px]" data-testid="stats-line">
          {statsLine(stats)} · per-note breakdown in Settings
        </p>
      </div>
    </div>
  );
}
