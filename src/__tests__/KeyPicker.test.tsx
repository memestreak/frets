import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { KEY_PICKER_NOTES, KeyPicker } from '@/components/KeyPicker';
import { ROOTS } from '@/lib/theory/scales';

const FLATS: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'G#': 'Ab', 'A#': 'Bb' };

function Harness({ start = 'A', flats = false }: { start?: string; flats?: boolean }) {
  const [value, setValue] = useState(start);
  return (
    <KeyPicker
      value={value} onPick={setValue}
      resolve={flats ? n => FLATS[n] ?? n : undefined}
    />
  );
}

const radios = () => within(screen.getByRole('radiogroup', { name: 'Root' })).getAllByRole('radio');
const picked = () => radios().filter(r => r.getAttribute('aria-checked') === 'true');

describe('KeyPicker', () => {
  it('has a tile for every Scale lab root, in its order', () => {
    expect(KEY_PICKER_NOTES).toEqual([...ROOTS]);
    render(<Harness />);
    expect(radios().map(r => r.textContent)).toEqual([
      'C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'G♯', 'A♭',
      'A', 'A♯', 'B♭', 'B',
    ]);
  });

  it('stacks each sharp over its flat, between the naturals', () => {
    render(<Harness />);
    const cols = [...document.querySelectorAll('.key-col')];
    expect(cols).toHaveLength(12);
    expect(cols.map(c => c.textContent)).toEqual([
      'C', 'C♯D♭', 'D', 'D♯E♭', 'E', 'F', 'F♯G♭', 'G', 'G♯A♭', 'A', 'A♯B♭', 'B',
    ]);
  });

  it('marks the picked tile, and picks a tapped one', () => {
    render(<Harness />);
    expect(picked().map(r => r.textContent)).toEqual(['A']);
    fireEvent.click(screen.getByRole('radio', { name: 'G♭' }));
    expect(picked().map(r => r.textContent)).toEqual(['G♭']);
  });

  it('takes one tab stop, on the picked tile', () => {
    render(<Harness start="Eb" />);
    expect(radios().filter(r => r.tabIndex === 0).map(r => r.textContent)).toEqual(['E♭']);
  });

  it('moves through the tiles with the arrow keys, picking as it goes, and wraps', () => {
    render(<Harness start="B" />);
    const b = screen.getByRole('radio', { name: 'B' });
    b.focus();
    fireEvent.keyDown(b, { key: 'ArrowRight' });
    expect(picked().map(r => r.textContent)).toEqual(['C']);
    expect(document.activeElement).toHaveTextContent('C');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(picked().map(r => r.textContent)).toEqual(['C♯']);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(picked().map(r => r.textContent)).toEqual(['B']);
  });

  it('picks a resolved note, and the arrow keys skip a tile that picks the same', () => {
    render(<Harness start="D" flats />);
    fireEvent.click(screen.getByRole('radio', { name: 'C♯' }));
    expect(picked().map(r => r.textContent)).toEqual(['D♭']);
    const db = screen.getByRole('radio', { name: 'D♭' });
    db.focus();
    fireEvent.keyDown(db, { key: 'ArrowRight' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(picked().map(r => r.textContent)).toEqual(['E♭']);
    expect(document.activeElement).toHaveTextContent('E♭');
    // Left from E♭ passes D♯, which would pick E♭ again.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(picked().map(r => r.textContent)).toEqual(['D']);
  });
});
