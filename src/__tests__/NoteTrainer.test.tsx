import { fireEvent, render, screen } from '@testing-library/react';
import NoteTrainer from '@/components/notes/NoteTrainer';
import { pitchClass } from '@/lib/music';
import { NOTE_STORAGE_KEY } from '@/lib/notes';
import { seededRng } from './helpers/rng';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

describe('NoteTrainer', () => {
  beforeEach(() => localStorage.clear());

  it('Name it: the answer key for the dot is correct', () => {
    render(<NoteTrainer rng={seededRng(2)} />);
    const dot = screen.getByTestId('dot-target');
    const pc = pitchClass(Number(dot.dataset.s), Number(dot.dataset.f));
    fireEvent.keyDown(window, { key: KEYS[pc] });
    expect(screen.getByTestId('feedback')).toHaveTextContent(/^Correct — /);
  });

  it('Find in range: counts found targets until all are found', () => {
    localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify({ set: { mode: 'range', pause: true } }));
    render(<NoteTrainer rng={seededRng(6)} />);
    expect(screen.getByTestId('range-band')).toBeInTheDocument();
    const label = screen.getByTestId('find-label').textContent ?? '';
    const pc = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
      .indexOf(label.split(' / ')[0]);
    const targets = [];
    for (let s = 0; s < 6; s++) {
      for (let f = 3; f <= 7; f++) if (pitchClass(s, f) === pc) targets.push({ s, f });
    }
    fireEvent.click(screen.getByTestId(`cell-${targets[0].s}-${targets[0].f}`));
    if (targets.length > 1) {
      expect(screen.getByTestId('feedback')).toHaveTextContent(`1 of ${targets.length} found`);
      for (const t of targets.slice(1)) fireEvent.click(screen.getByTestId(`cell-${t.s}-${t.f}`));
    }
    expect(screen.getByTestId('feedback')).toHaveTextContent(/^Correct — /);
    expect(screen.getAllByTestId('dot-found')).toHaveLength(targets.length);
  });

  it('Find on string: highlights the target string', () => {
    localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify({ set: { mode: 'string' } }));
    render(<NoteTrainer rng={seededRng(1)} />);
    const sub = screen.getByTestId('find-label').nextSibling?.textContent ?? '';
    const name = /on the (\w) string/.exec(sub)?.[1];
    const s = ['E', 'A', 'D', 'G', 'B', 'e'].indexOf(name ?? '');
    expect(screen.getByTestId(`string-${s}`)).toHaveAttribute('stroke-width', '3.5');
  });

  it('renders no blueprint corner marks', () => {
    const { container } = render(<NoteTrainer rng={seededRng(2)} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(container.querySelector('.corner')).toBeNull();
    expect(container.querySelector('.blueprint')).toBeNull();
  });
});
