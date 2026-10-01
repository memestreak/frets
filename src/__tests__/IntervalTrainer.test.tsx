import { act, fireEvent, render, screen, within } from '@testing-library/react';
import IntervalTrainer from '@/components/intervals/IntervalTrainer';
import {
  correctFrets, defaultIntervalSettings, generateIntervalQuestion, inBox,
  INTERVAL_STORAGE_KEY, isCorrectFret, type IntervalSettings,
} from '@/lib/intervals';
import { intervalClass, midi, samePos, STRINGS, type Position } from '@/lib/music';
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

/**
 * Render in Find it with stored settings. The trainer draws its first
 * question from the seeded rng, so the same seed reproduces it here.
 */
function renderFindIt(seed: number, patch: Partial<IntervalSettings> = {}) {
  const set = { ...defaultIntervalSettings(), mode: 'fret' as const, ...patch };
  localStorage.setItem(INTERVAL_STORAGE_KEY, JSON.stringify({ set }));
  render(<IntervalTrainer rng={seededRng(seed)} />);
  const q = generateIntervalQuestion(set, seededRng(seed));
  if (!q) throw new Error('no question for these settings');
  return { set, q };
}

/** Every cell of the fret window. */
const cells = (set: IntervalSettings): Position[] => STRINGS.flatMap(s =>
  Array.from({ length: set.maxFret - set.minFret + 1 }, (_, i) => ({ s, f: set.minFret + i })));

const cellEl = (p: Position) => screen.getByTestId(`cell-${p.s}-${p.f}`);

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

  it('shows the hint overlay, limited to the box, while H is held', () => {
    render(<IntervalTrainer rng={seededRng(3)} />);
    expect(screen.queryAllByTestId('dot-hint')).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'h' });

    const rootEl = screen.getByTestId('dot-root');
    const root = { s: Number(rootEl.dataset.s), f: Number(rootEl.dataset.f) };
    const set = defaultIntervalSettings();
    // The default direction is ascending.
    const expected = cells(set).filter(p => inBox(root, true, p, set));
    const hints = screen.getAllByTestId('dot-hint');
    expect(hints).toHaveLength(expected.length);
    for (const h of hints) {
      const p = { s: Number(h.dataset.s), f: Number(h.dataset.f) };
      expect(inBox(root, true, p, set)).toBe(true);
    }

    expect(screen.getByRole('button', { name: /Intervals from root/ })).toBeInTheDocument();
    fireEvent.keyUp(window, { key: 'h' });
    expect(screen.queryAllByTestId('dot-hint')).toHaveLength(0);
  });

  it('Find it: a wrong cell in the box gets an ✕ and stops accepting taps', () => {
    const { set, q } = renderFindIt(8);
    const miss = cells(set).find(
      p => inBox(q.root, q.up, p, set) && !isCorrectFret(q, p, set),
    );
    if (!miss) throw new Error('no wrong cell in the box');
    fireEvent.click(cellEl(miss));
    expect(screen.getByTestId('dot-wrong')).toBeInTheDocument();
    expect(cellEl(miss)).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('feedback')).toHaveTextContent('Not that fret — try again');
  });

  it('Find it: cells outside the box are dimmed and ignore taps', () => {
    const { set, q } = renderFindIt(8, { vRange: 1, hRange: 2 });
    const outside = cells(set).filter(p => !inBox(q.root, q.up, p, set));
    const inside = cells(set).filter(p => inBox(q.root, q.up, p, set));
    expect(outside).toContainEqual(q.root);

    for (const p of outside) {
      expect(cellEl(p)).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(cellEl(p));
    }
    for (const p of inside) expect(cellEl(p)).not.toHaveAttribute('aria-disabled');
    // Open-string cells have no overlay; every other outside cell has one.
    expect(screen.getAllByTestId(/^dim-/)).toHaveLength(outside.filter(p => p.f > 0).length);

    expect(screen.queryByTestId('dot-wrong')).not.toBeInTheDocument();
    expect(screen.getByTestId('feedback')).toBeEmptyDOMElement();
    expect(screen.getByTestId('stats-line')).toHaveTextContent('No answers yet this session');
  });

  it('Name it: the board is not dimmed', () => {
    render(<IntervalTrainer rng={seededRng(8)} />);
    expect(screen.queryAllByTestId(/^dim-/)).toHaveLength(0);
  });

  it('Find it: solving reveals the other correct frets and keeps the box', () => {
    const { set, q } = renderFindIt(8, { pause: true });
    const all = correctFrets(q, set);
    fireEvent.click(cellEl(q.tgt));

    const target = screen.getByTestId('dot-target');
    expect({ s: Number(target.dataset.s), f: Number(target.dataset.f) }).toEqual(q.tgt);
    const also = screen.queryAllByTestId('dot-also')
      .map(el => ({ s: Number(el.dataset.s), f: Number(el.dataset.f) }));
    expect(also).toHaveLength(all.length - 1);
    for (const p of also) {
      expect(samePos(p, q.tgt)).toBe(false);
      expect(isCorrectFret(q, p, set)).toBe(true);
    }
    expect(screen.getAllByTestId(/^dim-/).length).toBeGreaterThan(0);
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
    expect(screen.getByTestId('feedback')).toHaveTextContent(
      'No question fits these settings — widen the ranges or interval pool.',
    );
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

  it('does not repeat the same question when another exists', () => {
    // P5 up on adjacent strings within two frets: several fingerings.
    renderFindIt(21, { mode: 'name', pool: [7], vRange: 1, hRange: 2 });
    const where = () => ['dot-root', 'dot-target'].map(id => {
      const el = screen.getByTestId(id);
      return `${el.dataset.s}:${el.dataset.f}`;
    }).join(' ');
    let prev = where();
    for (let i = 0; i < 40; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
      expect(where()).not.toBe(prev);
      prev = where();
    }
  });
});
