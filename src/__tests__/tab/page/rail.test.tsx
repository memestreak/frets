import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { LAYOUT_KEY, parseLayout } from '@/features/tab/TabRail';
import { setUpPage, renderAt, editor, keys, alphaTex } from './helpers';

setUpPage();

const railButton = (name: string) => screen.getByRole('button', { name });
const panel = () => screen.queryByRole('complementary');

describe('the rail of panels (issue #301)', () => {
  it('opens Notes on a first visit, with the note input pencil, Duration and Rhythm', () => {
    renderAt();
    expect(railButton('Notes')).toHaveAttribute('aria-pressed', 'true');
    expect(panel()).toHaveAccessibleName('Notes');
    expect(screen.getByRole('button', { name: 'Note input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Quarter note/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tuplet/ })).toBeInTheDocument();
    // The other panels' tools are not shown.
    expect(screen.queryByRole('button', { name: /^Vibrato/ })).toBeNull();
  });

  it('shows one panel at a time; its rail button again, or the panel’s chevron, closes it', () => {
    renderAt();
    fireEvent.click(railButton('Articulations'));
    expect(panel()).toHaveAccessibleName('Articulations');
    expect(railButton('Notes')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^Vibrato/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Note input' })).toBeNull();
    fireEvent.click(railButton('Articulations'));
    expect(panel()).toBeNull();
    fireEvent.click(railButton('Bars'));
    expect(screen.getByRole('button', { name: 'Double bar line at the end of this bar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close Bars' }));
    expect(panel()).toBeNull();
    expect(railButton('Bars')).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps the open panel, or none, across visits', () => {
    renderAt();
    fireEvent.click(railButton('Bars'));
    expect(JSON.parse(localStorage.getItem(LAYOUT_KEY)!)).toEqual({ panel: 'bars' });
    cleanup();
    renderAt();
    expect(panel()).toHaveAccessibleName('Bars');
    fireEvent.click(railButton('Bars'));
    cleanup();
    renderAt();
    expect(panel()).toBeNull();
  });

  it('keeps the tab’s cursor when a rail button and a tool are pressed', () => {
    renderAt();
    act(() => editor().focus());
    keys('5');
    fireEvent.click(railButton('Articulations'));
    fireEvent.click(screen.getByRole('button', { name: 'Palm mute' }));
    expect(alphaTex()).toContain('5.1{pm}');
  });
});

describe('parseLayout', () => {
  it('reads a panel or none, and opens Notes for anything else', () => {
    expect(parseLayout(JSON.stringify({ panel: 'articulations' }))).toBe('articulations');
    expect(parseLayout(JSON.stringify({ panel: null }))).toBeNull();
    expect(parseLayout(null)).toBe('notes');
    expect(parseLayout('not json')).toBe('notes');
    expect(parseLayout(JSON.stringify({ panel: 'chords' }))).toBe('notes');
    expect(parseLayout(JSON.stringify(['bars']))).toBe('notes');
  });
});
