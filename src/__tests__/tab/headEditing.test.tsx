/**
 * The artist, credits and tuning set from the score's head on the Tab page (issues #202, #203).
 * See docs/specs/2026-10-29-tab-credits-tuning-design.md.
 */
import { vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';

const BUILTIN_FILES = await readBuiltinFiles();
vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
  if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
  return new Response(JSON.stringify(BUILTIN_FILES));
}));

function renderAt(hash = '') {
  window.history.replaceState(null, '', `/tab${hash}`);
  return render(<TabPage />);
}
const head = () => screen.getByTestId('score-head');
const undo = () => fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
const SLOW = { timeout: 5000 };

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("the score head's credits", () => {
  it('are added from the space under the title, shown as typed, and kept as one undo step', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add artist and credits' }));
    const panel = screen.getByRole('dialog', { name: 'Artist and credits' });
    fireEvent.change(within(panel).getByLabelText('Artist (optional)'), { target: { value: 'Band' } });
    expect(head()).toHaveTextContent('Band');
    // One set of people wrote both until said otherwise: one field, one line.
    fireEvent.change(within(panel).getByLabelText('Words & Music (optional)'), { target: { value: 'Ann' } });
    expect(head()).toHaveTextContent('Words & Music by Ann');
    fireEvent.keyDown(within(panel).getByLabelText('Artist (optional)'), { key: 'Enter' });
    expect(screen.queryByRole('dialog', { name: 'Artist and credits' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add artist and credits' })).toBeNull();

    undo();
    expect(head()).not.toHaveTextContent('Band');
    expect(head()).not.toHaveTextContent('Ann');
  });

  it('go back as they were on Esc', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add artist and credits' }));
    const panel = screen.getByRole('dialog', { name: 'Artist and credits' });
    const artist = within(panel).getByLabelText('Artist (optional)');
    fireEvent.change(artist, { target: { value: 'Band' } });
    fireEvent.keyDown(artist, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(head()).not.toHaveTextContent('Band');
    expect(screen.getByRole('button', { name: 'Add artist and credits' })).toBeInTheDocument();
  });

  it('open from the drawn credits, and words and music part when different people wrote them', async () => {
    renderAt('#example=tuned-down');
    await waitFor(() => expect(head()).toHaveTextContent("Guns N' Roses"), SLOW);
    fireEvent.click(within(head()).getByRole('button', { name: /Guns N' Roses/ }));
    const panel = screen.getByRole('dialog', { name: 'Artist and credits' });
    expect(within(panel).getByLabelText('Artist (optional)')).toHaveValue("Guns N' Roses");
    fireEvent.click(within(panel).getByRole('switch', { name: 'Same people wrote both' }));
    const music = within(panel).getByLabelText('Music (optional)');
    expect(music).toHaveValue(within(panel).getByLabelText('Words (optional)').getAttribute('value'));
    fireEvent.change(music, { target: { value: 'Slash' } });
    fireEvent.keyDown(music, { key: 'Enter' });
    expect(head()).toHaveTextContent('Words by Axl Rose');
    expect(head()).toHaveTextContent('Music by Slash');
  });
});

describe("the score head's tuning", () => {
  it('is set from the space where it would go, a preset or a string at a time, each one undo step', () => {
    renderAt();
    expect(screen.queryByRole('group', { name: 'Tuning' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add tuning' }));
    const panel = screen.getByRole('dialog', { name: 'Tuning' });
    expect(within(panel).getByRole('button', { name: 'Standard' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(panel).getByRole('button', { name: 'Drop D' }));
    expect(within(head()).getByLabelText('string 6').parentElement).toHaveTextContent('6 = D');
    expect(within(panel).getByRole('button', { name: 'Drop D' })).toHaveAttribute('aria-pressed', 'true');

    // The high e down to D on the piano: Drop D is now a tuning of its own.
    fireEvent.click(within(panel).getByRole('button', { name: 'String 1: E' }));
    fireEvent.click(within(within(panel).getByRole('radiogroup', { name: 'String 1' })).getByRole('radio', { name: 'D' }));
    expect(within(head()).getByLabelText('string 1').parentElement).toHaveTextContent('1 = D');
    expect(within(panel).getByText('Tuning: Custom')).toBeInTheDocument();

    undo();
    expect(within(head()).queryByLabelText('string 1')).toBeNull();
    undo();
    expect(screen.queryByRole('group', { name: 'Tuning' })).toBeNull();
  });

  it('opens from the drawn tuning, and Standard takes the tag away', async () => {
    renderAt('#example=tuned-down');
    await waitFor(() => expect(screen.getByRole('group', { name: 'Tuning' })).toBeInTheDocument(), SLOW);
    fireEvent.click(within(screen.getByRole('group', { name: 'Tuning' })).getByRole('button'));
    const panel = screen.getByRole('dialog', { name: 'Tuning' });
    expect(within(panel).getByRole('button', { name: 'E♭' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(panel).getByRole('button', { name: 'Standard' }));
    expect(screen.queryByRole('group', { name: 'Tuning' })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect((screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement).value).not.toContain('\\tuning');
  });
});
