import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ShortcutsOverlay } from '@/components/shortcuts/ShortcutsOverlay';
import { useShortcuts } from '@/components/shortcuts/useShortcuts';
import { isHelpKey, keyCaps, type ShortcutGroup } from '@/lib/shortcuts';
import { paletteShortcuts, TAB_SHORTCUTS } from '@/features/tab/shortcuts';

const PAGE: readonly ShortcutGroup[] = [
  { title: 'Chords', shortcuts: [{ keys: ['Space'], does: 'Arpeggio on or off' }, { keys: ['Mod+Shift+Z'], does: 'Redo' }] },
];

function Page({ groups = PAGE }: { groups?: readonly ShortcutGroup[] }) {
  useShortcuts(groups);
  return <input aria-label="Name" />;
}

const press = (key: string, target: Element = document.body) => act(() => {
  fireEvent.keyDown(target, { key });
});
const overlay = () => screen.queryByRole('dialog', { name: 'Keyboard shortcuts' });

function setMock(mock: string | null) {
  window.history.replaceState(null, '', mock ? `/?mock=${mock}` : '/');
}

afterEach(() => setMock(null));

describe('keyCaps', () => {
  it('draws Mod as ⌘ and the modifiers as symbols on a Mac', () => {
    expect(keyCaps('Mod+Shift+Z', true)).toEqual(['⌘', '⇧', 'Z']);
    expect(keyCaps('Alt+Up', true)).toEqual(['⌥', '↑']);
  });

  it('draws Mod as Ctrl elsewhere and keeps the other names', () => {
    expect(keyCaps('Mod+Shift+Z', false)).toEqual(['Ctrl', 'Shift', 'Z']);
    expect(keyCaps('Ctrl+Y', false)).toEqual(['Ctrl', 'Y']);
  });

  it('reads a lone + as the key itself', () => {
    expect(keyCaps('+', false)).toEqual(['+']);
    expect(keyCaps('Shift+=', false)).toEqual(['Shift', '=']);
  });
});

describe('isHelpKey', () => {
  const key = (target: Element, more: Partial<KeyboardEvent> = {}) =>
    isHelpKey({ key: '?', ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, target, ...more });

  it('takes ? on the page but not in a field', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    expect(key(document.body)).toBe(true);
    expect(key(input)).toBe(false);
    expect(key(textarea)).toBe(false);
  });

  it('leaves ? with ⌘, Ctrl or Alt, and one the page already used', () => {
    expect(key(document.body, { metaKey: true })).toBe(false);
    expect(key(document.body, { ctrlKey: true })).toBe(false);
    expect(key(document.body, { altKey: true })).toBe(false);
    expect(key(document.body, { defaultPrevented: true })).toBe(false);
  });
});

describe('ShortcutsOverlay', () => {
  it('opens on ? with the page’s shortcuts and the keys every page has', () => {
    render(<><Page /><ShortcutsOverlay /></>);
    expect(overlay()).toBeNull();
    press('?');
    const dialog = overlay()!;
    expect(within(dialog).getByText('Arpeggio on or off')).toBeTruthy();
    expect(within(dialog).getByText('Show or hide this list')).toBeTruthy();
  });

  it('does not open on ? typed in a field', () => {
    render(<><Page /><ShortcutsOverlay /></>);
    press('?', screen.getByRole('textbox', { name: 'Name' }));
    expect(overlay()).toBeNull();
  });

  it('closes on ? again and on the close button', () => {
    render(<><Page /><ShortcutsOverlay /></>);
    press('?');
    press('?', overlay()!);
    expect(overlay()).toBeNull();
    press('?');
    fireEvent.click(screen.getByRole('button', { name: 'Close keyboard shortcuts' }));
    expect(overlay()).toBeNull();
  });

  it('gives the keys back to what had them before it opened', () => {
    render(<><Page /><ShortcutsOverlay /></>);
    const editor = document.createElement('div');
    editor.tabIndex = 0;
    document.body.append(editor);
    editor.focus();
    press('?', editor);
    press('?', overlay()!);
    expect(document.activeElement).toBe(editor);
    editor.remove();
  });

  it('lists only the keys every page has once the page is gone', () => {
    const { rerender } = render(<><Page /><ShortcutsOverlay /></>);
    rerender(<ShortcutsOverlay />);
    press('?');
    expect(within(overlay()!).queryByText('Arpeggio on or off')).toBeNull();
    expect(within(overlay()!).getByText('Show or hide this list')).toBeTruthy();
  });

  it('shows one group at a time in mock c', () => {
    setMock('c');
    render(<><Page /><ShortcutsOverlay /></>);
    press('?');
    const dialog = overlay()!;
    expect(within(dialog).getByText('Arpeggio on or off')).toBeTruthy();
    expect(within(dialog).queryByText('Show or hide this list')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Everywhere' }));
    expect(within(dialog).getByText('Show or hide this list')).toBeTruthy();
  });

  it('closes the side sheet of mock b on Esc and on a press outside it', () => {
    setMock('b');
    render(<><Page /><ShortcutsOverlay /></>);
    press('?');
    expect(overlay()).not.toBeNull();
    press('Escape');
    expect(overlay()).toBeNull();
    press('?');
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(overlay()).toBeNull();
  });
});

describe('the Tab page’s shortcuts', () => {
  it('take the palette’s keys from its table, one row per key', () => {
    const rows = paletteShortcuts().shortcuts;
    expect(rows.find(r => r.keys[0] === 'Shift+G')?.does).toBe('Grace note, just before the beat');
    expect(rows.find(r => r.keys[0] === 'A')?.does).toBe('Accent, then heavy accent');
    expect(rows.find(r => r.keys[0] === 'Mod+Enter')?.does).toBe('Insert a bar of rests after this bar');
    // A tool with no key has no row, and the note lengths are under Note input.
    expect(rows.some(r => r.does.startsWith('Mordent'))).toBe(false);
    expect(rows.some(r => r.does === 'Whole note')).toBe(false);
  });

  it('never list one key twice in a group', () => {
    for (const group of TAB_SHORTCUTS) {
      const keys = group.shortcuts.flatMap(s => s.keys);
      expect(new Set(keys).size, group.title).toBe(keys.length);
    }
  });
});
