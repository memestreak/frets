import { fireEvent, render, screen, within } from '@testing-library/react';
import NoteTrainer from '@/features/practice/notes/NoteTrainer';
import { pitchClass } from '@/lib/music';
import {
  defaultNoteSettings, generateNoteQuestion, NOTE_STORAGE_KEY,
  type NoteSettings,
} from '@/features/practice/notes/notes';
import { seededRng } from '../helpers/rng';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

/**
 * Render in Find it with stored settings. The trainer draws its first
 * question from the seeded rng, so the same seed reproduces it here. Pause
 * is on so a solved question stays on screen.
 */
function renderFindIt(seed: number, patch: Partial<NoteSettings> = {}) {
  const set = {
    ...defaultNoteSettings(), mode: 'find' as const, pause: true, ...patch,
  };
  localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify({ set }));
  render(<NoteTrainer rng={seededRng(seed)} />);
  const q = generateNoteQuestion(set, seededRng(seed));
  if (q?.mode !== 'find') throw new Error('expected a find question');
  return { set, q };
}

const cell = (s: number, f: number) => screen.getByTestId(`cell-${s}-${f}`);
const savedStats = () =>
  JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) ?? '{}').stats;

describe('NoteTrainer', () => {
  beforeEach(() => localStorage.clear());

  it('Name it: the answer key for the dot is correct', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    const dot = screen.getByTestId('dot-target');
    const pc = pitchClass(Number(dot.dataset.s), Number(dot.dataset.f));
    fireEvent.keyDown(window, { key: KEYS[pc] });
    expect(screen.getByTestId('feedback')).toHaveTextContent(/^Correct — /);
  });

  it('offers two modes', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    const mode = screen.getByRole('group', { name: 'Mode' });
    expect(within(mode).getAllByRole('button').map(b => b.textContent))
      .toEqual(['Name it', 'Find it']);
    fireEvent.click(within(mode).getByRole('button', { name: 'Find it' }));
    expect(screen.getByRole('heading', { name: 'Find the note' })).toBeInTheDocument();
    expect(screen.getByTestId('find-label')).toBeInTheDocument();
  });

  it('Find it: names and highlights the target string, with no range band', () => {
    const { q } = renderFindIt(1);
    const name = ['E', 'A', 'D', 'G', 'B', 'e'][q.s];
    expect(screen.getByTestId('find-label').nextSibling)
      .toHaveTextContent(`on the ${name} string`);
    expect(screen.getByTestId(`string-${q.s}`)).toHaveAttribute('stroke-width', '3.5');
    expect(screen.queryByTestId('range-band')).not.toBeInTheDocument();
    expect(screen.getByText('Target string')).toBeInTheDocument();
  });

  it('Find it: one in-range tap solves the question', () => {
    const { q } = renderFindIt(4, { rFrom: 12, rTo: 15 });
    const f = [12, 13, 14, 15].find(x => pitchClass(q.s, x) === q.pc) ?? -1;
    fireEvent.click(cell(q.s, f));
    expect(screen.getByTestId('feedback')).toHaveTextContent(/^Correct — /);
    expect(screen.getAllByTestId('dot-found')).toHaveLength(1);
    expect(savedStats()).toMatchObject({ correct: 1, total: 1 });
  });

  it('Find it: explains the right note outside the range without scoring', () => {
    const { q } = renderFindIt(4, { rFrom: 12, rTo: 15 });
    const f = [12, 13, 14, 15].find(x => pitchClass(q.s, x) === q.pc) ?? -1;
    // The same note an octave lower is below the range.
    fireEvent.click(cell(q.s, f - 12));
    expect(screen.getByTestId('feedback')).toHaveTextContent(
      'Right note, but outside your range — look in frets 12–15',
    );
    expect(screen.getAllByTestId('dot-far')).toHaveLength(1);
    expect(cell(q.s, f - 12)).toHaveAttribute('aria-disabled', 'true');
    expect(savedStats()).toMatchObject({ correct: 0, total: 0 });

    // A wrong note replaces the message and is scored.
    const miss = f === 12 ? 13 : f - 1;
    fireEvent.click(cell(q.s, miss));
    expect(screen.getByTestId('feedback')).toHaveTextContent('Not that fret — try again');
    expect(screen.getAllByTestId('dot-wrong')).toHaveLength(1);
  });

  it('Find it: a single-fret range reads "look at fret N"', () => {
    const { q } = renderFindIt(4, { rFrom: 14, rTo: 14 });
    // The only in-range fret is 14, so fret 2 holds the same note.
    fireEvent.click(cell(q.s, 2));
    expect(screen.getByTestId('feedback')).toHaveTextContent(
      'Right note, but outside your range — look at fret 14',
    );
  });

  it('opens settings in a modal dialog and closes it', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByRole('group', { name: 'Strings in scope' }))
      .toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Fret range' }))
      .toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close settings' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies a setting from the dialog live, without closing', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'B string' }));
    const saved = JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) ?? '{}');
    expect(saved.set.strings).toEqual([true, true, true, true, false, true]);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('Defaults resets the dialog fields, keeping mode and pause', () => {
    localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify({
      set: {
        mode: 'find', pause: true, rFrom: 5, rTo: 9,
        strings: [true, false, true, false, true, false],
      },
    }));
    render(<NoteTrainer rng={seededRng(2)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Defaults' }));

    const saved = JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) ?? '{}');
    expect(saved.set).toEqual({ ...defaultNoteSettings(), mode: 'find', pause: true });
    expect(within(dialog).getByRole('button', { name: 'A string' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('spinbutton', { name: 'Range start fret' }))
      .toHaveValue(1);
    expect(within(dialog).getByRole('spinbutton', { name: 'Range end fret' }))
      .toHaveValue(12);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('has no Board window setting and always draws frets 0 to 15', () => {
    localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify({
      set: { mode: 'find', minFret: 5, maxFret: 20 },
    }));
    render(<NoteTrainer rng={seededRng(2)} />);
    expect(screen.getByTestId('cell-0-0')).toBeInTheDocument();
    expect(screen.getByTestId('cell-0-15')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-0-16')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).queryByRole('group', { name: 'Board window' }))
      .not.toBeInTheDocument();
    // The range cannot leave the board.
    const end = within(dialog).getByRole('spinbutton', { name: 'Range end fret' });
    fireEvent.change(end, { target: { value: '22' } });
    const saved = JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) ?? '{}');
    expect(saved.set.rTo).toBe(15);
    expect(saved.set).not.toHaveProperty('maxFret');
  });

  it('shows session stats and reset on the page, outside settings', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    const card = screen.getByRole('region', { name: 'Session stats' });
    expect(within(card).getAllByRole('meter')).toHaveLength(12);
    expect(within(card).getByRole('button', { name: 'Reset session stats' }))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).queryByRole('meter')).not.toBeInTheDocument();
  });

  it('ignores answer keys while settings are open', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    const dot = screen.getByTestId('dot-target');
    const pc = pitchClass(Number(dot.dataset.s), Number(dot.dataset.f));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.keyDown(window, { key: KEYS[pc] });
    expect(screen.getByTestId('feedback')).toBeEmptyDOMElement();
  });

  it('renders no blueprint corner marks', () => {
    const { container } = render(<NoteTrainer rng={seededRng(2)} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(container.querySelector('.corner')).toBeNull();
    expect(container.querySelector('.blueprint')).toBeNull();
  });
});
