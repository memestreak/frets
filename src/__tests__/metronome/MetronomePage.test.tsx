import { act, fireEvent, render, screen, within } from '@testing-library/react';
import MetronomePage from '@/features/metronome/MetronomePage';
import { DISPLAY_KEY, RHYTHM_KEY } from '@/features/metronome/storage';

/** Enough of Web Audio for the page: every click it schedules is counted. */
let started = 0;
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  createGain() { return { gain: { value: 1 }, connect: (n: unknown) => n }; }
  createBuffer(_c: number, length: number) { return { length, copyToChannel() {} }; }
  createBufferSource() { return { buffer: null, connect: (n: unknown) => n, start: () => { started += 1; } }; }
}

beforeEach(() => {
  started = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const beats = () => screen.getAllByRole('spinbutton', { name: 'Beats' })[0] as HTMLInputElement;

describe('MetronomePage', () => {
  it('shows the Readout at first, with 4 pads', () => {
    const { container } = render(<MetronomePage />);
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveTextContent('120');
    expect(container.querySelectorAll('.metronome-pad')).toHaveLength(4);
  });

  it('shows the view saved in Settings', () => {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify({ view: 'bar' }));
    render(<MetronomePage />);
    expect(screen.getAllByRole('button', { name: /^Beat \d step 1/ })).toHaveLength(4);
  });

  it('changes the view from Settings › Metronome › Display, and saves it', () => {
    const { container } = render(<MetronomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pendulum' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(container.querySelector('.metronome-pyramid')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(DISPLAY_KEY)!)).toEqual({ view: 'pendulum' });
  });

  it('Start turns into Stop, and Space does the same', () => {
    vi.useFakeTimers();
    render(<MetronomePage />);
    const start = screen.getByRole('button', { name: 'Start' });
    expect(start).toHaveAttribute('data-tip', 'Start (Space)');
    fireEvent.click(start);
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveAttribute('data-tip', 'Stop (Space)');
    expect(started).toBeGreaterThan(0);
    act(() => { fireEvent.keyDown(window, { key: ' ' }); });
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('a double-click on Beats puts back 4', () => {
    render(<MetronomePage />);
    fireEvent.change(beats(), { target: { value: '12' } });
    fireEvent.keyDown(beats(), { key: 'Enter' });
    expect(beats().value).toBe('12');
    fireEvent.doubleClick(screen.getAllByText('Beats')[0]);
    expect(beats().value).toBe('4');
  });

  it('T taps the tempo, but not while typing', () => {
    const now = vi.spyOn(performance, 'now');
    render(<MetronomePage />);
    for (const t of [0, 600, 1200]) {
      now.mockReturnValue(t);
      fireEvent.keyDown(window, { key: 't' });
    }
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveTextContent('100');
    now.mockReturnValue(1500);
    fireEvent.keyDown(beats(), { key: 't' });
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveTextContent('100');
    now.mockRestore();
  });

  it('saves the rhythm, and opens with it', () => {
    const first = render(<MetronomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eighths' }));
    first.unmount();
    expect(JSON.parse(localStorage.getItem(RHYTHM_KEY)!).bpm).toBe(121);
    render(<MetronomePage />);
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveTextContent('121');
    expect(screen.getByRole('button', { name: 'Eighths' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps Advanced closed until it is opened', () => {
    render(<MetronomePage />);
    expect(screen.queryByRole('combobox', { name: 'Preset' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Preset' }), { target: { value: '2:3' } });
    expect(beats().value).toBe('7');
    expect(screen.getByRole('textbox', { name: 'Groups' })).toHaveValue('2+2+3');
  });
});
