import { act, fireEvent, render, screen } from '@testing-library/react';
import NoteTrainer from '@/features/practice/notes/NoteTrainer';
import {
  defaultNoteSettings, generateNoteQuestion, NOTE_STORAGE_KEY,
  type FindQuestion, type NoteSettings,
} from '@/features/practice/notes/notes';
import type { MicError, MicReading } from '@/features/practice/mic/listener';
import { TUNING } from '@/lib/music';
import { seededRng } from '../../helpers/rng';

/** Stands in for the microphone: the test says what it hears. */
const mic = vi.hoisted(() => ({
  granted: false,
  startResult: null as MicError | null,
  listener: null as null | { emit: (r: MicReading) => void },
}));

vi.mock('@/features/practice/mic/listener', async importOriginal => {
  const real = await importOriginal<typeof import('@/features/practice/mic/listener')>();
  class FakeListener {
    private reading: MicReading = real.SILENT;
    private readonly subscribers = new Set<() => void>();
    listening = false;
    constructor() {
      mic.listener = this;
    }
    async start() {
      this.listening = mic.startResult == null;
      return mic.startResult;
    }
    stop() {
      this.listening = false;
    }
    subscribe = (fn: () => void) => {
      this.subscribers.add(fn);
      return () => { this.subscribers.delete(fn); };
    };
    getReading = () => this.reading;
    emit(reading: MicReading) {
      this.reading = reading;
      this.subscribers.forEach(fn => fn());
    }
  }
  return { ...real, MicListener: FakeListener, micGranted: async () => mic.granted };
});

/** The mic hears `midi`, plucked at `since` and still sounding at `seen`. */
const hear = (midi: number, since: number, seen: number) => act(() => {
  mic.listener!.emit({ level: 0.5, midi, hold: { midi, since, seen, rms: 0.2 } });
});

function renderFindIt(patch: Partial<NoteSettings> = {}) {
  const set = { ...defaultNoteSettings(), mode: 'find' as const, pause: true, ...patch };
  localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify({ set }));
  render(<NoteTrainer rng={seededRng(3)} />);
  const q = generateNoteQuestion(set, seededRng(3)) as FindQuestion;
  // The asked note within frets 1–12 of its string.
  const f = ((q.pc - TUNING[q.s]) % 12 + 12) % 12 || 12;
  return { q, midi: TUNING[q.s] + f };
}

const micButton = () => screen.getByRole('button', { name: /microphone/i });
const feedback = () => screen.getByTestId('feedback');
const saved = () => JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) ?? '{}').set;

async function turnOn() {
  await act(async () => fireEvent.click(micButton()));
}

describe('NoteTrainer mic', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(mic, { granted: false, startResult: null });
  });

  it('has a Mic button in Find it only', () => {
    renderFindIt();
    expect(micButton()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Name it' }));
    expect(screen.queryByRole('button', { name: /microphone/i })).toBeNull();
  });

  it('turns on, shows what it hears and remembers it', async () => {
    renderFindIt();
    await turnOn();
    expect(micButton()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mic-note')).toHaveTextContent('–');
    expect(saved().mic).toBe(true);
    act(() => mic.listener!.emit({ level: 0.4, midi: 45, hold: null }));
    expect(screen.getByTestId('mic-note')).toHaveTextContent('A₂');
  });

  it('solves once the right note has held', async () => {
    const { midi } = renderFindIt();
    await turnOn();
    hear(midi, 1000, 1100);
    expect(feedback()).toHaveTextContent('');
    hear(midi, 1000, 1160);
    expect(feedback()).toHaveTextContent(/^Correct — /);
  });

  it('scores a held wrong note as a miss, naming it', async () => {
    const { midi } = renderFindIt();
    await turnOn();
    const wrong = midi + 2;
    hear(wrong, 1000, 1200);
    expect(feedback()).toHaveTextContent('');
    hear(wrong, 1000, 1260);
    expect(feedback()).toHaveTextContent(/^That’s .* — try again$/);
  });

  it('leaves wrong notes unscored with the setting off', async () => {
    const { midi } = renderFindIt({ micMisses: false });
    await turnOn();
    hear(midi + 2, 1000, 1300);
    expect(feedback()).toHaveTextContent('');
  });

  it('judges a ringing note once: not again on the next question', async () => {
    const { midi } = renderFindIt();
    await turnOn();
    hear(midi, 1000, 1200);
    expect(feedback()).toHaveTextContent(/^Correct — /);
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    hear(midi, 1000, 1600);
    expect(feedback()).toHaveTextContent('');
    hear(midi + 1, 1700, 2000);
    expect(feedback()).not.toHaveTextContent('');
  });

  it('says why when the browser refuses, and stays off', async () => {
    mic.startResult = 'denied';
    renderFindIt();
    await turnOn();
    expect(micButton()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Mic blocked/)).toBeInTheDocument();
    expect(saved().mic).toBe(false);
  });

  it('starts by itself when left on and still granted', async () => {
    mic.granted = true;
    renderFindIt({ mic: true });
    await act(async () => {});
    expect(micButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves itself off when left on but no longer granted', async () => {
    renderFindIt({ mic: true });
    await act(async () => {});
    expect(micButton()).toHaveAttribute('aria-pressed', 'false');
    expect(saved().mic).toBe(false);
  });
});
