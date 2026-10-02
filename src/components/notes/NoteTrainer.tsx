'use client';

import { Segmented, ToggleButton } from '@/components/controls';
import { Fretboard, type FretDot } from '@/components/fretboard/Fretboard';
import { MAPLE_THEME as T, STATUS } from '@/components/fretboard/theme';
import {
  AnswerCard, AnswerGrid, FindPrompt, type AnswerButton,
} from '@/components/quiz/AnswerCard';
import { answerState, attemptDots, attemptFeedback } from '@/components/quiz/attempt';
import { BoardFrame, type LegendItem } from '@/components/quiz/BoardFrame';
import { SessionStatsCard } from '@/components/quiz/SessionStatsCard';
import { SettingsDialog } from '@/components/quiz/SettingsDialog';
import { Field, FretInput, FretPair } from '@/components/quiz/SettingsParts';
import { TrainerHeader } from '@/components/quiz/TrainerHeader';
import { wasTapped } from '@/components/quiz/trainerState';
import { useTrainer } from '@/hooks/useTrainer';
import {
  NOTE_LABELS, pitchClass, SHARP_NAMES, STRING_NAMES, STRINGS, type Rng,
} from '@/lib/music';
import {
  clampNoteFret, generateNoteQuestion, NOTE_MAX_FRET, NOTE_STORAGE_KEY,
  resetNoteSettings, targetRange,
  type NoteMode, type NoteSettings,
} from '@/lib/notes';
import { itemPercent } from '@/lib/stats';
import { initNoteState, noteReducer } from './noteState';

const MODE_OPTS = [['name', 'Name it'], ['find', 'Find it']] as const;
const TITLES: Record<NoteMode, string> = {
  name: 'Name the note',
  find: 'Find the note',
};

/** Answer keys name the notes in order, C first. */
const answerFor = (index: number, set: NoteSettings) =>
  set.mode === 'name' && index >= 0 ? index : null;

export default function NoteTrainer({ rng = Math.random }: { rng?: Rng }) {
  const {
    state, dispatch, hint, setHint, settingsOpen, setSettingsOpen,
    next, update, applyDefaults, answerName,
  } = useTrainer({
    reducer: noteReducer, init: initNoteState,
    storageKey: NOTE_STORAGE_KEY, generate: generateNoteQuestion,
    rng, answerFor,
  });
  const { set, stats, q, answered, picked } = state;
  const { mode } = set;
  const [rA, rB] = targetRange(set);
  // The board does not draw the range, so the out-of-range message names it.
  const rangeHint = rA === rB ? `look at fret ${rA}` : `look in frets ${rA}–${rB}`;
  const inScope = (s: number) => set.strings[s];

  const dots: FretDot[] = [];
  if (q) {
    if (hint) {
      for (const s of STRINGS) {
        for (let f = 0; f <= NOTE_MAX_FRET; f++) {
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
    if (picked) {
      dots.push({
        ...picked, kind: 'found', fill: STATUS.green, stroke: STATUS.green,
        fg: T.tgtFg, label: SHARP_NAMES[q.pc], fontSize: 11,
      });
    }
    if (q.mode === 'find') dots.push(...attemptDots(state, SHARP_NAMES[q.pc]));
  }

  const answerButtons: AnswerButton[] = NOTE_LABELS.map((label, pc) => ({
    label,
    state: answerState(state, pc, q?.pc),
    onClick: () => answerName(pc),
  }));

  const noteName = q ? NOTE_LABELS[q.pc].replace('/', ' / ') : '';
  const { feedback, tone } = attemptFeedback(state, {
    none: 'No question fits these settings — put a string in scope.',
    correct: noteName,
    far: `Right note, but outside your range — ${rangeHint}`,
    names: NOTE_LABELS,
  });

  const legend: LegendItem[] = mode === 'name'
    ? [{ label: 'Note to name', color: T.tgtFill, shape: 'circle' }]
    : [{ label: 'Target string', color: STATUS.green, shape: 'square' }];

  const findSub = q?.mode === 'find' ? `on the ${STRING_NAMES[q.s]} string` : '';

  const toggleString = (s: number) => {
    const strings = [...set.strings];
    strings[s] = !strings[s];
    update({ strings });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
      <TrainerHeader
        title={TITLES[mode]}
        controls={(
          <Segmented<NoteMode>
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
        onDefaults={() => applyDefaults(resetNoteSettings(set))}
        footnote="Standard tuning · E A D G B E · low E drawn on the bottom · sharps and flats both accepted"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-7 gap-y-[18px]">
          <Field label="Strings in scope">
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
          <Field label="Fret range">
            <FretPair>
              <FretInput
                label="Range start fret" min={0} max={NOTE_MAX_FRET} value={set.rFrom}
                onCommit={v => update({ rFrom: clampNoteFret(v) })}
              />
              <span className="text-muted">to</span>
              <FretInput
                label="Range end fret" min={0} max={NOTE_MAX_FRET} value={set.rTo}
                onCommit={v => update({ rTo: clampNoteFret(v) })}
              />
            </FretPair>
          </Field>
        </div>
      </SettingsDialog>

      <div className="grid grid-cols-[minmax(0,1fr)] content-start">
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
          {mode === 'name' && <AnswerGrid buttons={answerButtons} variant="note" />}
          {mode !== 'name' && q && <FindPrompt label={noteName}>{findSub}</FindPrompt>}
        </AnswerCard>
        <BoardFrame legend={legend} hint={hint} onHint={setHint} hintActiveLabel="Note names">
          <Fretboard
            minFret={0}
            maxFret={NOTE_MAX_FRET}
            dots={dots}
            scrollToFret={q?.mode === 'name' ? q.f : q ? rA : null}
            stringStyle={s => {
              const target = q?.mode === 'find' && q.s === s;
              return {
                color: target ? STATUS.green : undefined,
                width: target ? 3.5 : undefined,
                opacity: inScope(s) ? 1 : 0.3,
              };
            }}
            onCellClick={mode === 'find' && !answered && q
              ? pos => dispatch({ type: 'answerFret', pos })
              : undefined}
            isCellDisabled={pos => wasTapped(state, pos)}
          />
        </BoardFrame>
        <SessionStatsCard
          stats={stats}
          itemLabel="Per note"
          labelWidth={52}
          rows={NOTE_LABELS.map((label, pc) => ({ label, pct: itemPercent(stats, pc) }))}
          onReset={() => dispatch({ type: 'resetStats' })}
        />
      </div>
    </div>
  );
}
