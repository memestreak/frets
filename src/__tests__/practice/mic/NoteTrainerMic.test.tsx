import { act, fireEvent, render, screen } from '@testing-library/react';
import NoteTrainer from '@/features/practice/notes/NoteTrainer';
import {
  defaultNoteSettings, generateNoteQuestion, NOTE_STORAGE_KEY,
  type FindQuestion, type NoteSettings,
} from '@/features/practice/notes/notes';
import type { MicError, MicReading } from '@/components/tuner/listener';
import { TUNER_STORAGE_KEY } from '@/components/tuner/settings';
import { TUNING } from '@/lib/music';
import { seededRng } from '../../helpers/rng';

/** Stands in for the microphone: the test says what it hears. */
const mic = vi.hoisted(() => ({
  granted: false,
  startResult: null as MicError | null,
  listener: null as null | { emit: (r: MicReading) => void },
}));

vi.mock('@/components/tuner/listener', async importOriginal => {
  const real = await importOriginal<typeof import('@/components/tuner/listener')>();
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
  mic.listener!.emit({ level: 0.5, pitch: midi, midi, hold: { midi, since, seen, rms: 0.2 } });
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
    act(() => mic.listener!.emit({ level: 0.4, pitch: 45, midi: 45, hold: null }));
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
    expect(screen.getByText(/Mic blocked/, { selector: '.text-muted' })).toBeInTheDocument();
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

  it('leaves the reference sound out of Settings', () => {
    renderFindIt();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('combobox', { name: /reference/i })).toBeNull();
  });

  describe('tuner', () => {
    const pitch = (p: number | null) => act(() => {
      mic.listener!.emit({ level: 0.5, pitch: p, midi: p == null ? null : Math.round(p), hold: null });
    });
    const dialog = () => screen.getByRole('heading', { name: 'Tuner', hidden: true }).closest('dialog')!;
    const openTuner = async () => {
      await act(async () => fireEvent.keyDown(window, { key: 't' }));
    };

    it('opens on T or its button, listening, and closes on T', async () => {
      renderFindIt();
      await openTuner();
      expect(dialog()).toHaveAttribute('open');
      expect(mic.listener!).toMatchObject({ listening: true });
      await act(async () => fireEvent.keyDown(window, { key: 't' }));
      expect(dialog()).not.toHaveAttribute('open');
      fireEvent.click(screen.getByRole('button', { name: /^Tuner/ }));
      expect(dialog()).toHaveAttribute('open');
    });

    it('reads the nearest string and how far off it is', async () => {
      renderFindIt();
      await openTuner();
      expect(screen.getByTestId('tuner-cents')).toHaveTextContent('Play a string');
      pitch(44.8);
      expect(screen.getByTestId('tuner-note')).toHaveTextContent('A2');
      expect(screen.getByTestId('tuner-cents')).toHaveTextContent('20¢ flat');
      for (let i = 0; i < 5; i++) pitch(64.03);
      expect(screen.getByTestId('tuner-note')).toHaveTextContent('E4');
      expect(screen.getByTestId('tuner-cents')).toHaveTextContent('In tune');
    });

    it('picks the reference sound in the tuner, and remembers it for the Tuner page', async () => {
      renderFindIt();
      await openTuner();
      const select = screen.getByRole('combobox', { name: 'Reference sound', hidden: true });
      expect(select).toHaveValue('acoustic');
      fireEvent.change(select, { target: { value: 'piano' } });
      expect(JSON.parse(localStorage.getItem(TUNER_STORAGE_KEY)!).sound).toBe('piano');
      expect(select).toHaveValue('piano');
    });

    it('lists the strings low E first and lights the one heard', async () => {
      renderFindIt();
      await openTuner();
      const strings = screen.getAllByRole('button', { name: /^Play /, hidden: true });
      expect(strings.map(b => b.textContent)).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
      expect(strings.filter(b => b.dataset.heard === 'true')).toHaveLength(0);
      pitch(50.1);
      expect(strings.filter(b => b.dataset.heard === 'true').map(b => b.textContent))
        .toEqual(['D3']);
    });

    it('keeps the quiz from judging, and leaves the mic as it was', async () => {
      const { midi } = renderFindIt();
      await openTuner();
      hear(midi, 1000, 1300);
      expect(feedback()).toHaveTextContent('');
      await act(async () => fireEvent.keyDown(window, { key: 'Escape' }));
      fireEvent(dialog(), new Event('cancel'));
      expect(mic.listener!).toMatchObject({ listening: false });
      expect(micButton()).toHaveAttribute('aria-pressed', 'false');
      expect(saved().mic).toBe(false);
    });
  });
});
