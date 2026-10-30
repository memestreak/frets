import { vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { METRONOME_KEY, PLAYBACK_KEY } from '@/features/tab/PlaybackFooter';
import { EDITING_KEY } from '@/features/tab/editingPrefs';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { APPEARANCE_KEY } from '@/lib/theme';

// The built-in arrangements, served as the route serves them; nothing else is fetched.
const BUILTIN_FILES = await readBuiltinFiles();
vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
  if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
  return new Response(JSON.stringify(BUILTIN_FILES));
}));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  window.history.replaceState(null, '', '/tab');
});

afterEach(() => vi.restoreAllMocks());

const dialog = () => screen.getByRole('dialog', { name: 'Settings' });
const inDialog = () => within(dialog());
const openSettings = () => fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
const button = (name: string) => inDialog().getByRole('button', { name });
const pane = () => inDialog().getByRole('heading', { level: 4 });
const footerKnob = () => within(screen.getByRole('group', { name: 'Playback' })).getByRole('slider', { name: 'Volume' });
const label = (name: string) => inDialog().getByText(name, { selector: '.settings-label' });
const section = (name: string) => inDialog().getByRole('treeitem', { name });
const saved = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null');

describe('Settings', () => {
  it('opens from the gear after Export at Tab › Playback, with Tab open and General shut', () => {
    render(<TabPage />);
    const actions = screen.getByRole('button', { name: 'Export' }).parentElement!;
    expect([...actions.querySelectorAll('button')].at(-1)).toHaveAccessibleName('Settings');
    openSettings();
    expect(pane()).toHaveTextContent('Tab › Playback');
    expect(section('Playback')).toHaveAttribute('aria-selected', 'true');
    expect(inDialog().getByRole('treeitem', { name: /^General/ })).toHaveAttribute('aria-expanded', 'false');
    expect(inDialog().queryByRole('treeitem', { name: 'Appearance' })).toBeNull();
    // Most used first (G3).
    const tab = inDialog().getByRole('treeitem', { name: /^Tab/ });
    expect(within(tab).getAllByRole('treeitem').map(i => i.textContent))
      .toEqual(['Playback', 'Metronome', 'Notation', 'Colours', 'ASCII Tab', 'AlphaTex', 'Editing', 'Export']);
  });

  it('stages changes: Apply saves and stays, Cancel drops them, and Apply is enabled only while something differs', () => {
    render(<TabPage />);
    openSettings();
    expect(button('Apply')).toBeDisabled();
    const knob = inDialog().getByRole('slider', { name: 'Volume' });
    fireEvent.keyDown(knob, { key: 'ArrowDown' });
    expect(knob).toHaveAttribute('aria-valuenow', '95');
    // Not on the page yet.
    expect(footerKnob()).toHaveAttribute('aria-valuenow', '100');
    expect(button('Apply')).toBeEnabled();
    fireEvent.click(button('Apply'));
    expect(footerKnob()).toHaveAttribute('aria-valuenow', '95');
    expect(saved(PLAYBACK_KEY).volume).toBe(0.95);
    expect(button('Apply')).toBeDisabled();
    // Staged back to where it was saved, Apply goes off again.
    fireEvent.keyDown(knob, { key: 'ArrowDown' });
    expect(button('Apply')).toBeEnabled();
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    expect(button('Apply')).toBeDisabled();
    fireEvent.keyDown(knob, { key: 'Home' });
    fireEvent.click(button('Cancel'));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    expect(footerKnob()).toHaveAttribute('aria-valuenow', '95');
    openSettings();
    expect(inDialog().getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuenow', '95');
  });

  it('shows what the page set, and moves the page with OK: the same saved values', () => {
    render(<TabPage />);
    fireEvent.keyDown(footerKnob(), { key: 'Home' });
    fireEvent.click(screen.getByRole('button', { name: 'Hear notes as you enter them' }));
    openSettings();
    expect(inDialog().getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuenow', '0');
    expect(inDialog().getByRole('checkbox', { name: 'Hear notes as you enter them' })).toBeChecked();
    fireEvent.click(section('Notation'));
    expect(pane()).toHaveTextContent('Tab › Notation');
    fireEvent.click(within(inDialog().getByRole('group', { name: 'Show' })).getByRole('button', { name: 'Both' }));
    fireEvent.click(button('OK'));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
    expect(saved('frets.tab.notation')).toMatchObject({ show: 'both' });
  });

  it('keeps the metronome in its own section and key', () => {
    render(<TabPage />);
    openSettings();
    fireEvent.click(section('Metronome'));
    fireEvent.click(inDialog().getByRole('checkbox', { name: 'Metronome' }));
    fireEvent.click(button('OK'));
    expect(screen.getByRole('button', { name: 'Metronome' })).toHaveAttribute('aria-pressed', 'true');
    expect(saved(METRONOME_KEY)).toEqual({ on: true, countIn: false, countInBars: 1, clickVolume: 0.8 });
    expect(saved(PLAYBACK_KEY)).not.toHaveProperty('metronome');
  });

  it('turns on filling short bars with rests under Tab › Editing, off by default', () => {
    render(<TabPage />);
    openSettings();
    fireEvent.click(section('Editing'));
    const fill = inDialog().getByRole('checkbox', { name: 'Fill short bars with rests' });
    expect(fill).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(fill);
    fireEvent.click(button('OK'));
    expect(saved(EDITING_KEY)).toEqual({ fillBars: true });
  });

  it('resets a field to its default on a double-click on its label, staged, but never on its control', () => {
    render(<TabPage />);
    const transpose = () => inDialog().getByRole('spinbutton', { name: 'Transpose' });
    openSettings();
    fireEvent.keyDown(transpose(), { key: 'ArrowUp' });
    fireEvent.keyDown(transpose(), { key: 'ArrowUp' });
    fireEvent.click(button('Apply'));
    expect(transpose()).toHaveAttribute('aria-valuenow', '2');
    fireEvent.doubleClick(transpose());
    expect(transpose()).toHaveAttribute('aria-valuenow', '2');
    expect(label('Transpose')).toHaveAttribute('title', 'Double-click to reset');
    fireEvent.doubleClick(label('Transpose'));
    expect(transpose()).toHaveAttribute('aria-valuenow', '0');
    // Staged: the page still plays it 2 up until OK.
    expect(saved(PLAYBACK_KEY).transpose).toBe(2);
    fireEvent.click(button('OK'));
    expect(saved(PLAYBACK_KEY).transpose).toBe(0);
  });

  it('resets on a long-press on the label on a touch screen', async () => {
    render(<TabPage />);
    openSettings();
    const hear = () => inDialog().getByRole('checkbox', { name: 'Hear notes as you enter them' });
    fireEvent.click(hear());
    expect(hear()).toBeChecked();
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(label('Hear notes as you enter them'), { pointerType: 'touch' });
      act(() => { vi.advanceTimersByTime(600); });
    } finally {
      vi.useRealTimers();
    }
    expect(hear()).not.toBeChecked();
    // A double-click on the label of a check box never ticks it.
    fireEvent.doubleClick(label('Hear notes as you enter them'));
    expect(hear()).not.toBeChecked();
  });

  it('shows a field that needs another one on, disabled until that one is', () => {
    render(<TabPage />);
    openSettings();
    const pause = () => inDialog().getByRole('spinbutton', { name: 'Pause length' });
    expect(pause()).toBeDisabled();
    fireEvent.click(inDialog().getByRole('checkbox', { name: 'Pause between loops' }));
    expect(pause()).toBeEnabled();
    fireEvent.click(section('Colours'));
    const text = () => inDialog().getByLabelText('Text');
    expect(text()).toBeDisabled();
    fireEvent.click(within(inDialog().getByRole('group', { name: 'Colours' })).getByRole('button', { name: 'Sepia' }));
    fireEvent.click(within(inDialog().getByRole('group', { name: 'Colours' })).getByRole('button', { name: 'Custom' }));
    // Custom starts from the colours shown.
    expect(text()).toBeEnabled();
    expect(text()).toHaveValue('#3b2a1a');
    fireEvent.click(button('OK'));
    expect(saved('frets.tab.colours')).toEqual({ scheme: 'custom', text: '#3b2a1a', background: '#f4ecd8' });
  });

  it('takes Enter as OK, except on a button and the first Enter in a number being typed', () => {
    render(<TabPage />);
    openSettings();
    const transpose = inDialog().getByRole('spinbutton', { name: 'Transpose' });
    transpose.focus();
    fireEvent.change(transpose, { target: { value: '-3' } });
    fireEvent.keyDown(transpose, { key: 'Enter' });
    expect(dialog()).toBeInTheDocument();
    expect(transpose).toHaveAttribute('aria-valuenow', '-3');
    // Enter on a check box ticks it (a button's own Enter), and the dialog stays.
    const hear = inDialog().getByRole('checkbox', { name: 'Hear notes as you enter them' });
    fireEvent.keyDown(hear, { key: 'Enter' });
    expect(dialog()).toBeInTheDocument();
    fireEvent.keyDown(section('Playback'), { key: 'Enter' });
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    expect(saved(PLAYBACK_KEY).transpose).toBe(-3);
  });

  it('moves through the tree with the arrow keys, the pane following', () => {
    render(<TabPage />);
    openSettings();
    const tree = inDialog().getByRole('tree');
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(pane()).toHaveTextContent('Tab › Metronome');
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(inDialog().getByRole('treeitem', { name: /^Tab/ })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(tree, { key: 'ArrowUp' });
    fireEvent.keyDown(tree, { key: 'ArrowRight' });
    expect(inDialog().getByRole('treeitem', { name: /^General/ })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(tree, { key: 'ArrowRight' });
    expect(pane()).toHaveTextContent('General › Appearance');
  });

  it('sets the theme from General › Appearance', () => {
    render(<TabPage />);
    openSettings();
    fireEvent.click(inDialog().getByRole('treeitem', { name: /^General/ }));
    fireEvent.click(section('Appearance'));
    fireEvent.click(within(inDialog().getByRole('group', { name: 'Theme' })).getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    fireEvent.click(button('OK'));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(saved(APPEARANCE_KEY)).toEqual({ theme: 'dark' });
  });

  it('shows a ⚠ after the gear while settings can\'t be saved, still closes, and drops it once a save works', () => {
    render(<TabPage />);
    const setItem = vi.spyOn(Object.getPrototypeOf(localStorage) as Storage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    openSettings();
    fireEvent.click(inDialog().getByRole('checkbox', { name: 'Hear notes as you enter them' }));
    fireEvent.click(button('OK'));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    const warning = screen.getByRole('img', { name: "Settings couldn't be saved: storage is full" });
    expect(warning.previousElementSibling).toHaveAccessibleName('Settings');
    // The page still has the change.
    expect(screen.getByRole('button', { name: 'Hear notes as you enter them' })).toHaveAttribute('aria-pressed', 'true');
    setItem.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Hear notes as you enter them' }));
    expect(screen.queryByRole('img', { name: /couldn't be saved/ })).toBeNull();
    expect(saved(PLAYBACK_KEY).hearNotes).toBe(false);
  });
});
