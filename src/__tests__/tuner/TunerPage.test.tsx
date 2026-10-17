import { act, fireEvent, render, screen } from '@testing-library/react';
import type { MicError, MicReading } from '@/components/tuner/listener';
import { TUNER_STORAGE_KEY } from '@/components/tuner/settings';
import TunerPage from '@/features/tuner/TunerPage';

/** Stands in for the microphone: the test says what it hears. */
const mic = vi.hoisted(() => ({
  startResult: null as MicError | null,
  listener: null as null | { listening: boolean; emit: (r: MicReading) => void },
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
  return { ...real, MicListener: FakeListener };
});

const hearPitch = (p: number) => act(() => {
  mic.listener!.emit({ level: 0.5, pitch: p, midi: Math.round(p), hold: null });
});
const saved = () => JSON.parse(localStorage.getItem(TUNER_STORAGE_KEY) ?? '{}');

async function renderPage() {
  const view = render(<TunerPage />);
  await act(async () => {});
  return view;
}

describe('TunerPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mic.startResult = null;
  });

  it('listens from the start, and stops when left', async () => {
    const { unmount } = await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Tuner' })).toBeInTheDocument();
    expect(mic.listener!.listening).toBe(true);
    expect(screen.getByTestId('tuner-cents')).toHaveTextContent('Play a string');
    unmount();
    expect(mic.listener!.listening).toBe(false);
  });

  it('says why when the mic will not start', async () => {
    mic.startResult = 'denied';
    await renderPage();
    expect(screen.getByTestId('tuner-cents')).toHaveTextContent(/Mic blocked/);
  });

  it('reads the nearest string, lights it, and says how far off', async () => {
    await renderPage();
    hearPitch(55.12);
    expect(screen.getByTestId('tuner-note')).toHaveTextContent('G3');
    expect(screen.getByTestId('tuner-cents')).toHaveTextContent('12¢ sharp');
    const lit = screen.getAllByRole('button', { name: /^Play / })
      .filter(b => b.dataset.heard === 'true');
    expect(lit.map(b => b.getAttribute('aria-label'))).toEqual(['Play G₃']);
  });

  it('switches between the dial and the strobe, and remembers the choice', async () => {
    const { container, unmount } = await renderPage();
    expect(container.querySelector('.dial')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Strobe' }));
    expect(container.querySelector('.strobe')).not.toBeNull();
    expect(container.querySelector('.dial')).toBeNull();
    expect(saved().meter).toBe('strobe');
    unmount();
    await renderPage();
    expect(screen.getByRole('button', { name: 'Strobe' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('remembers the reference sound', async () => {
    await renderPage();
    fireEvent.change(screen.getByRole('combobox', { name: 'Reference sound' }), {
      target: { value: 'nylon' },
    });
    expect(saved().sound).toBe('nylon');
  });
});
