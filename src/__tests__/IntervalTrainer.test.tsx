import { act, fireEvent, render, screen, within } from '@testing-library/react';
import IntervalTrainer from '@/components/intervals/IntervalTrainer';
import { INTERVAL_STORAGE_KEY } from '@/lib/intervals';
import { intervalClass, midi } from '@/lib/music';
import { seededRng } from './helpers/rng';

/** The asked interval, read back from the board's root and target dots. */
function askedSemis(): number {
  const pos = (id: string) => {
    const el = screen.getByTestId(id);
    return { s: Number(el.dataset.s), f: Number(el.dataset.f) };
  };
  const r = pos('dot-root');
  const t = pos('dot-target');
  return intervalClass(midi(t.s, t.f) - midi(r.s, r.f));
}

const NAMES = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
const KEYS = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

describe('IntervalTrainer', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('marks a wrong answer red and disabled, then accepts the right one', () => {
    render(<IntervalTrainer rng={seededRng(5)} />);
    const semis = askedSemis();
    const wrong = semis === 1 ? 2 : 1;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${NAMES[wrong]}`) }));
    const wrongBtn = screen.getByRole('button', { name: new RegExp(`^${NAMES[wrong]}`) });
    expect(wrongBtn).toBeDisabled();
    expect(wrongBtn).toHaveAttribute('data-state', 'wrong');
    expect(screen.getByTestId('feedback')).toHaveTextContent(`Not ${NAMES[wrong]} — try again`);

    fireEvent.keyDown(window, { key: KEYS[semis] });
    expect(screen.getByTestId('feedback')).toHaveTextContent(/^Correct — .*\(after 1 miss\)$/);
    expect(screen.getByTestId('stats-line')).toHaveTextContent('Streak 0 · best 0 · 0% of 1');
  });

  it('auto-advances 1100 ms after a correct answer', () => {
    render(<IntervalTrainer rng={seededRng(11)} />);
    fireEvent.keyDown(window, { key: KEYS[askedSemis()] });
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1099); });
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('stats-line')).toHaveTextContent('Streak 1 · best 1 · 100% of 1');
  });

  it('with Pause b/w, waits for any key', () => {
    render(<IntervalTrainer rng={seededRng(12)} />);
    fireEvent.click(screen.getByRole('button', { name: /Pause b\/w/ }));
    fireEvent.keyDown(window, { key: KEYS[askedSemis()] });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole('button', { name: /Next/ })).toHaveTextContent('any key');
    fireEvent.keyDown(window, { key: 'x' });
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument();
  });

  it('shows the hint overlay while H is held', () => {
    render(<IntervalTrainer rng={seededRng(3)} />);
    expect(screen.queryAllByTestId('dot-hint')).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getAllByTestId('dot-hint').length).toBeGreaterThan(50);
    expect(screen.getByRole('button', { name: /Intervals from root/ })).toBeInTheDocument();
    fireEvent.keyUp(window, { key: 'h' });
    expect(screen.queryAllByTestId('dot-hint')).toHaveLength(0);
  });

  it('Find it: a wrong cell gets an ✕ and stops accepting taps', () => {
    render(<IntervalTrainer rng={seededRng(8)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Find it' }));
    const root = screen.getByTestId('dot-root');
    // The root's own cell is never a correct answer.
    const cell = screen.getByTestId(`cell-${root.dataset.s}-${root.dataset.f}`);
    fireEvent.click(cell);
    expect(screen.getByTestId('dot-wrong')).toBeInTheDocument();
    expect(cell).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('feedback')).toHaveTextContent('Not that fret — try again');
  });

  it('persists settings and stats to localStorage', () => {
    render(<IntervalTrainer rng={seededRng(4)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desc from high' }));
    fireEvent.keyDown(window, { key: KEYS[askedSemis()] });
    const saved = JSON.parse(localStorage.getItem(INTERVAL_STORAGE_KEY) ?? '{}');
    expect(saved.set.dir).toBe('desc');
    expect(saved.stats.total).toBe(1);
  });

  it('explains when no question fits', () => {
    render(<IntervalTrainer rng={seededRng(4)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    for (let semis = 1; semis <= 12; semis++) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${NAMES[semis]},`) }));
    }
    expect(screen.getByTestId('feedback')).toHaveTextContent('No question fits these settings');
  });

  it('opens settings in a modal dialog and closes it', () => {
    render(<IntervalTrainer rng={seededRng(4)} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByRole('spinbutton', { name: 'Horizontal range' }))
      .toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent(
      screen.getByRole('dialog'), new Event('cancel', { cancelable: true }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies the range settings from the dialog live, without closing', () => {
    render(<IntervalTrainer rng={seededRng(4)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    const saved = () =>
      JSON.parse(localStorage.getItem(INTERVAL_STORAGE_KEY) ?? '{}').set;
    expect(saved()).toMatchObject({ vRange: 5, hRange: 4 });

    // Pool chips are named "m3, minor third", so "3" is the range option.
    fireEvent.click(within(dialog).getByRole('button', { name: '3' }));
    expect(saved().vRange).toBe(3);

    const reach = within(dialog).getByRole('spinbutton', { name: 'Horizontal range' });
    fireEvent.change(reach, { target: { value: '7' } });
    expect(saved().hRange).toBe(7);
    // Out-of-range input is clamped, not stored as typed.
    fireEvent.change(reach, { target: { value: '40' } });
    expect(saved().hRange).toBe(12);

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows session stats and reset on the page, outside settings', () => {
    render(<IntervalTrainer rng={seededRng(11)} />);
    const card = screen.getByRole('region', { name: 'Session stats' });
    expect(within(card).getAllByRole('meter')).toHaveLength(12);

    fireEvent.keyDown(window, { key: KEYS[askedSemis()] });
    expect(within(card).getByTestId('stats-line'))
      .toHaveTextContent('Streak 1 · best 1 · 100% of 1');
    fireEvent.click(within(card).getByRole('button', { name: 'Reset session stats' }));
    expect(within(card).getByTestId('stats-line'))
      .toHaveTextContent('No answers yet this session');

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).queryByRole('meter')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Reset session stats' }))
      .not.toBeInTheDocument();
  });

  it('ignores answer keys while settings are open', () => {
    render(<IntervalTrainer rng={seededRng(11)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.keyDown(window, { key: KEYS[askedSemis()] });
    expect(screen.getByTestId('feedback')).toBeEmptyDOMElement();
    expect(screen.getByTestId('stats-line'))
      .toHaveTextContent('No answers yet this session');
  });

  it('holds auto-advance while settings are open', () => {
    render(<IntervalTrainer rng={seededRng(11)} />);
    fireEvent.keyDown(window, { key: KEYS[askedSemis()] });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    act(() => { vi.advanceTimersByTime(1099); });
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument();
  });

  it('renders no blueprint corner marks', () => {
    const { container } = render(<IntervalTrainer rng={seededRng(2)} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(container.querySelector('.corner')).toBeNull();
    expect(container.querySelector('.blueprint')).toBeNull();
  });
});
