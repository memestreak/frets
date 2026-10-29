/**
 * The tempo in the score's head and its panel, with tap tempo (Jeremy, 2026-10-29).
 * See docs/specs/2026-10-29-tab-tempo-button-design.md.
 */
import * as alphaTab from '@coderline/alphatab';
import { vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { emptyClip } from '@/features/tab/clip';
import { parseTabExportStyle, tabSvg } from '@/features/tab/exportTab';
import { ScoreHead } from '@/features/tab/ScoreHead';
import { TabClip } from '@/features/tab/TabClip';
import { addTap, tapBpm, TAP_RESET_MS } from '@/features/tab/tapTempo';
import { tempoFrom } from '@/features/tab/TempoPanel';

const BUILTIN_FILES = await readBuiltinFiles();
vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
  if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
  return new Response(JSON.stringify(BUILTIN_FILES));
}));

const clipOf = (tex: string) => {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
};
function renderAt(hash = '') {
  window.history.replaceState(null, '', `/tab${hash}`);
  return render(<TabPage />);
}
const tempoButton = () => within(screen.getByTestId('score-head')).getByRole('button', { name: /^Tempo:/ });
const panel = () => screen.getByRole('dialog', { name: 'Tempo' });
const bpmField = () => within(panel()).getByRole('spinbutton', { name: 'Tempo (bpm)' });
const alphaTexText = () => {
  fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
  return (screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement).value;
};
const undo = () => fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('tap tempo', () => {
  it('takes the tempo from the gaps between taps, once there are two', () => {
    let taps = addTap([], 1000);
    expect(tapBpm(taps)).toBeNull();
    taps = addTap(taps, 1500);
    expect(tapBpm(taps)).toBe(120);
    taps = addTap(addTap(taps, 2100), 2700);
    // Gaps of 500, 600 and 600 ms: an average of 566.7 ms is 106 bpm.
    expect(tapBpm(taps)).toBe(106);
  });

  it('starts over after a long pause, and follows the latest eight taps', () => {
    const taps = addTap(addTap([0], 500), 500 + TAP_RESET_MS + 1);
    expect(taps).toEqual([500 + TAP_RESET_MS + 1]);
    let run: number[] = [];
    for (let t = 0; t < 10; t++) run = addTap(run, t < 5 ? t * 1000 : 4000 + (t - 4) * 500);
    expect(run).toHaveLength(8);
    expect(tapBpm(addTap(addTap([], 0), 1500))).toBe(40);
  });

  it('keeps the tempo within what Frets offers', () => {
    expect(tapBpm([0, 10])).toBe(400);
    expect(tapBpm([0, 1999])).toBe(30);
  });
});

describe('tempoFrom', () => {
  it('is the last tempo set at or before a bar, else 120', () => {
    const clip = clipOf('0.6.4 | \\tempo 90 0.6.4 | 0.6.4 |');
    expect(tempoFrom(clip, 0)).toEqual({ bpm: 120 });
    expect(tempoFrom(clip, 2)).toEqual({ bpm: 90 });
  });
});

describe("the score head's tempo", () => {
  it('reads "= 120" when the clip names none, and the label and bpm when it does', () => {
    const onEdit = vi.fn();
    const { rerender } = render(<ScoreHead clip={emptyClip()} onRename={() => {}} onEditTempo={onEdit} />);
    expect(tempoButton()).toHaveAccessibleName('Tempo: 120 bpm');
    expect(tempoButton()).toHaveTextContent(/^= 120$/);
    fireEvent.click(tempoButton());
    expect(onEdit).toHaveBeenCalledTimes(1);
    rerender(<ScoreHead clip={clipOf('\\tempo (92 "Slowly") 0.6.4 |')} onRename={() => {}} onEditTempo={onEdit} />);
    expect(tempoButton()).toHaveTextContent(/^Slowly= 92$/);
  });

  it('is printed in the head, not over the first bar; later tempos stay over their bars', () => {
    const clip = clipOf('\\tempo 92 0.6.4 | \\tempo 100 0.6.4 |');
    const { container } = render(<TabClip clip={clip} width={800} parts="tab" title="Tempo" />);
    const drawn = container.querySelectorAll('[data-testid="tempo"]');
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toHaveTextContent('= 100');
  });

  it('is printed in the picture when set, and left unsaid when not', () => {
    const style = parseTabExportStyle(null);
    expect(tabSvg({ ...emptyClip(), name: 'Riff' }, style, 'Riff')).not.toContain('score-tempo-drawn');
    const svg = tabSvg({ ...clipOf('\\tempo (92 "Slowly") 0.6.4 |'), name: 'Riff' }, style, 'Riff');
    expect(svg).toContain('score-tempo-drawn');
    expect(svg).toContain(' = 92');
    expect(svg).toContain('Slowly');
  });
});

describe('the tempo panel', () => {
  it('opens from the head, sets a typed bpm and label as one undo step', () => {
    renderAt();
    fireEvent.click(tempoButton());
    expect(bpmField()).toHaveValue('120');
    fireEvent.change(bpmField(), { target: { value: '96' } });
    fireEvent.keyDown(bpmField(), { key: 'Enter' });
    expect(screen.queryByRole('dialog', { name: 'Tempo' })).toBeNull();
    expect(tempoButton()).toHaveAccessibleName('Tempo: 96 bpm');

    fireEvent.click(tempoButton());
    const label = within(panel()).getByLabelText('Label (optional)');
    fireEvent.change(label, { target: { value: 'Slowly' } });
    // The head follows while the panel is open; T in the label is a letter, not a tap.
    expect(tempoButton()).toHaveAccessibleName('Tempo: Slowly, 96 bpm');
    fireEvent.keyDown(label, { key: 't' });
    expect(bpmField()).toHaveValue('96');
    fireEvent.keyDown(label, { key: 'Enter' });

    undo();
    expect(tempoButton()).toHaveAccessibleName('Tempo: 96 bpm');
    undo();
    expect(tempoButton()).toHaveAccessibleName('Tempo: 120 bpm');
  });

  it('steps with the arrows, puts it back on Esc, and leaves the clip as it was when nothing changed', () => {
    renderAt();
    fireEvent.click(tempoButton());
    fireEvent.keyDown(bpmField(), { key: 'ArrowUp' });
    expect(tempoButton()).toHaveAccessibleName('Tempo: 121 bpm');
    fireEvent.keyDown(bpmField(), { key: 'Escape' });
    expect(tempoButton()).toHaveAccessibleName('Tempo: 120 bpm');

    fireEvent.click(tempoButton());
    fireEvent.keyDown(bpmField(), { key: 'Enter' });
    expect(alphaTexText()).not.toContain('\\tempo');
  });

  it('opens with the focus on itself: ↑ ↓ step the bpm, a digit starts typing it', () => {
    renderAt();
    fireEvent.click(tempoButton());
    expect(panel()).toHaveFocus();
    fireEvent.keyDown(panel(), { key: 'ArrowDown' });
    expect(bpmField()).toHaveValue('119');
    fireEvent.keyDown(panel(), { key: '9' });
    expect(bpmField()).toHaveFocus();
    fireEvent.keyDown(panel(), { key: 'Escape' });
    expect(tempoButton()).toHaveAccessibleName('Tempo: 120 bpm');
  });

  it('drags the bpm up and down, even while it is being typed', () => {
    // jsdom has no pointer capture.
    HTMLElement.prototype.setPointerCapture ??= () => {};
    renderAt();
    fireEvent.click(tempoButton());
    const drag = (dy: number) => {
      fireEvent.pointerDown(bpmField(), { button: 0, clientY: 200 });
      fireEvent.pointerMove(bpmField(), { clientY: 200 - dy });
      fireEvent.pointerUp(bpmField(), { clientY: 200 - dy });
    };
    drag(50);
    expect(bpmField()).toHaveValue('125');
    act(() => bpmField().focus());
    fireEvent.change(bpmField(), { target: { value: '90' } });
    drag(-30);
    expect(bpmField()).toHaveValue('87');
    expect(tempoButton()).toHaveAccessibleName('Tempo: 87 bpm');
  });

  it('takes the tempo from taps on Tap, or on T', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    renderAt();
    fireEvent.click(tempoButton());
    const tap = within(panel()).getByRole('button', { name: 'Tap' });
    for (const t of [10000, 10600, 11200]) {
      now = t;
      fireEvent.pointerDown(tap, { button: 0 });
    }
    expect(bpmField()).toHaveValue('100');
    // T from the bpm field taps on: 400 ms gaps from here (the run keeps its first two 600 ms gaps).
    for (const t of [11600, 12000]) {
      now = t;
      fireEvent.keyDown(bpmField(), { key: 't' });
    }
    expect(bpmField()).toHaveValue('120');
    fireEvent.keyDown(bpmField(), { key: 'Enter' });
    expect(alphaTexText()).toContain('\\tempo 120');
  });

  it('sets a later bar\'s tempo from the Tempo tool', async () => {
    renderAt('#tab=' + encodeURIComponent('\\title "Two bars"\n0.6.1 | 0.6.1 |'));
    await screen.findByRole('heading', { name: 'Two bars' }, { timeout: 5000 });
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    fireEvent.keyDown(editor, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: /Tempo from this bar on/ }));
    fireEvent.change(bpmField(), { target: { value: '80' } });
    fireEvent.keyDown(bpmField(), { key: 'Enter' });
    expect(tempoButton()).toHaveAccessibleName('Tempo: 120 bpm');
    expect(alphaTexText()).toMatch(/\| \\tempo 80 /);
  });
});
