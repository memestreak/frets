/**
 * The Tab page's keys for the `?` overlay (issue #180). The palette's come from its own table
 * (`tools.ts`), so a tool's key here is the one its tip names; the rest mirror `editorKeys.ts`,
 * `TabPage.tsx` and `useSpaceKey`, and change with them.
 */
import type { Shortcut, ShortcutGroup } from '@/lib/shortcuts';
import { TOOL_GROUPS } from './tools';

const PAGE: ShortcutGroup = {
  title: 'Page',
  shortcuts: [
    { keys: ['Space'], does: 'Play or stop' },
    { keys: ['N'], does: 'Note input on or off' },
    { keys: ['Mod+Z'], does: 'Undo' },
    { keys: ['Mod+Shift+Z', 'Ctrl+Y'], does: 'Redo' },
    { keys: ['Mod+C', 'Mod+X', 'Mod+V'], does: 'Copy, cut (leaving rests), paste over' },
    { keys: ['Mod+Shift+V'], does: 'Insert paste' },
    { keys: ['Delete'], does: 'Make rests of the notes' },
    { keys: ['Mod+Delete'], does: 'Take the time away' },
    { keys: ['Mod+S'], does: 'Save' },
    { keys: ['Mod+Shift+S'], does: 'Save as…' },
    { keys: ['Mod+O'], does: 'Arrangements…' },
  ],
};

const MOVING: ShortcutGroup = {
  title: 'Moving on the tab',
  shortcuts: [
    { keys: ['Left', 'Right'], does: 'Last or next column' },
    { keys: ['Up', 'Down'], does: 'String above or below' },
    { keys: ['Mod+Left', 'Mod+Right'], does: 'Last or next bar' },
    { keys: ['Mod+Home', 'Mod+End'], does: 'Start or end of the clip' },
    { keys: ['Shift+Left', 'Shift+Right'], does: 'Select columns' },
    { keys: ['Shift+Home', 'Shift+End'], does: 'Select to the start or end of the line' },
    { keys: ['Mod+A'], does: 'Select everything' },
    { keys: ['Esc'], does: 'Leave the tab' },
  ],
};

const INPUT: ShortcutGroup = {
  title: 'Note input',
  shortcuts: [
    { keys: ['0–9'], does: 'Fret (two digits quickly for 10 and up)' },
    { keys: ['+', '−', 'W', 'Q'], does: 'Longer or shorter next note' },
    { keys: ['Shift+1–7'], does: 'Next note’s length (Shift+5 a quarter)' },
    { keys: ['Insert'], does: 'Insert a column' },
    { keys: ['Esc'], does: 'Leave note input' },
  ],
};

const NORMAL: ShortcutGroup = {
  title: 'Selected notes and rests',
  shortcuts: [
    { keys: ['Up', 'Down'], does: 'Fret up or down one' },
    { keys: ['Mod+Up', 'Mod+Down'], does: 'Same pitch on the next string' },
    { keys: ['Alt+Up', 'Alt+Down'], does: 'Next note up or down the chord' },
    { keys: ['Left', 'Right'], does: 'Select the last or next column' },
    { keys: ['+', '−', 'W', 'Q'], does: 'Longer or shorter (a rest keeps its bar full)' },
    { keys: ['Shift+1–7'], does: 'Length (Shift+5 a quarter)' },
    { keys: ['1–7'], does: 'Length of a picked rest, stem or staff note (5 a quarter)' },
  ],
};

const PICKED: ShortcutGroup = {
  title: 'A picked word, bar line or mark',
  shortcuts: [
    { keys: ['Enter'], does: 'Edit it (a word or a repeat’s count)' },
    { keys: ['Delete', 'Backspace'], does: 'Take it away' },
    { keys: ['Shift+F10'], does: 'Its menu (a right-click too)' },
    { keys: ['Esc'], does: 'Let it go' },
  ],
};

const STAFF: ShortcutGroup = {
  title: 'On the staff',
  shortcuts: [
    { keys: ['Up', 'Down'], does: 'Line or space up or down' },
    { keys: ['Shift+Up', 'Shift+Down', '#', 'b'], does: 'A semitone up or down' },
    { keys: ['Enter'], does: 'Add or take away the note' },
    { keys: ['Alt+Up', 'Alt+Down'], does: 'Move the note a line or space' },
    { keys: ['Alt+Shift+Up', 'Alt+Shift+Down'], does: 'Move the note a semitone' },
    { keys: ['Alt+Mod+Up', 'Alt+Mod+Down'], does: 'Move the whole chord' },
    { keys: ['1–7'], does: 'Length (5 a quarter)' },
  ],
};

const LINE: ShortcutGroup = {
  title: 'Off the tab',
  shortcuts: [
    { keys: ['Left', 'Right'], does: 'Move the playback line' },
    { keys: ['Shift+Left', 'Shift+Right'], does: 'Select from the line' },
    { keys: ['Delete', 'Backspace'], does: 'Make a rest of the column before the line' },
    { keys: ['Mod+Delete'], does: 'Take that column away' },
    { keys: ['Esc'], does: 'Drop the selection, then the line' },
  ],
};

const CHOOSER: ShortcutGroup = {
  title: 'In Arrangements…',
  shortcuts: [
    { keys: ['Delete', 'Backspace'], does: 'Delete the picked arrangements' },
    { keys: ['Esc'], does: 'Let the picked files go, then close' },
  ],
};

const HEAD: ShortcutGroup = {
  title: 'Picked title, credits or tuning',
  shortcuts: [
    { keys: ['Enter'], does: 'Edit what is picked' },
    { keys: ['Esc'], does: 'Let it go' },
  ],
};

/**
 * The palette's keyed tools, one row per key: tools sharing a key are the steps it goes through
 * ("Accent, then heavy accent"). The note lengths are under Note input already.
 */
export function paletteShortcuts(): ShortcutGroup {
  const rows = new Map<string, string[]>();
  for (const group of TOOL_GROUPS) {
    if (group.label === 'Duration') continue;
    for (const tool of group.tools) {
      if (!tool.key) continue;
      rows.set(tool.key, [...(rows.get(tool.key) ?? []), tool.label]);
    }
  }
  const shortcuts: Shortcut[] = [...rows].map(([key, labels]) => ({
    keys: [key.replace(/^Ctrl\+/, 'Mod+')],
    does: labels.map((label, i) => (i === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1))).join(', then '),
  }));
  // The Duration group's own keys: the dot and the rest.
  const duration = TOOL_GROUPS.find(g => g.label === 'Duration')!.tools.filter(t => t.key.length === 1);
  return { title: 'Palette', shortcuts: [...duration.map(t => ({ keys: [t.key], does: t.label })), ...shortcuts] };
}

export const TAB_SHORTCUTS: readonly ShortcutGroup[] = [PAGE, MOVING, INPUT, NORMAL, PICKED, STAFF, paletteShortcuts(), LINE, HEAD, CHOOSER];
