/**
 * A double-click on a word, bar line or mark on the Tab page (issue #289): one with an Edit in its
 * right-click menu opens that same field; one with only Delete stays picked; anywhere else, out of note
 * input, it still goes into note input (issue #238).
 */
import * as alphaTab from '@coderline/alphatab';
import { vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, STRING_GAP } from '@/features/tab/layout';
import { textBox, type WordHit } from '@/features/tab/layoutText';
import { barLineBoxes, type BarLineHit } from '@/features/tab/barLines';
import { markBoxes } from '@/features/tab/marks';

const BUILTIN_FILES = await readBuiltinFiles();
vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
  if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
  return new Response(JSON.stringify(BUILTIN_FILES));
}));

/** Every kind of word: capo, section, tempo, chord name, text, a repeat played three times with endings, a double bar and a mark. */
const TEX = '\\title "Words"\n\\capo 2\n\\ts (4 4)\n'
  + '\\section "Verse" \\tempo 90 \\ro 5.1.4{ch "A"} 7.3.4{txt "let ring"} 7.3{h}.4 8.3.4 | \\ae 1 \\rc 3 3.4.1 | \\ae 2 \\tempo 120 5.1.1 | \\db 3.2.1 | 5.1.1 |';
const result = readAlphaTexWith(alphaTab, TEX);
if (!result.ok) throw new Error(result.errors.join('\n'));
const CLIP = partOf(result.clip);
/** jsdom draws the tab 800 wide at 0, 0. */
const LAYOUT = layoutClip(CLIP, 800);
const middleOf = (box: { x: number; y: number; width: number; height: number }) => ({ clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
const wordAt = (hit: WordHit) => middleOf(textBox(LAYOUT, hit, CLIP.capo ?? null)!);
const barLineAt = (kind: BarLineHit['kind']) => middleOf(barLineBoxes(LAYOUT).find(b => b.hit.kind === kind)!);

async function open() {
  window.history.replaceState(null, '', `/tab#tab=${encodeURIComponent(TEX)}`);
  render(<TabPage />);
  await screen.findByRole('heading', { name: 'Words' }, { timeout: 5000 });
}
const drawing = () => screen.getByRole('img', { name: /drawn as tab/ });
const pencil = () => screen.getByRole('button', { name: 'Note input' });
/** A double-click as a browser sends it: two presses, then the dblclick. */
function doubleClick(at: { clientX: number; clientY: number }) {
  fireEvent.pointerDown(drawing(), { ...at, button: 0 });
  fireEvent.pointerDown(drawing(), { ...at, button: 0 });
  fireEvent.doubleClick(drawing(), at);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('a double-click on something with an Edit opens its field (issue #289)', () => {
  const cases: [string, () => { clientX: number; clientY: number }, string][] = [
    ['a chord name', () => wordAt({ kind: 'chord', index: 0 }), 'Chord name'],
    ['text over a column', () => wordAt({ kind: 'text', index: 1 }), 'Text over the column'],
    ['a section', () => wordAt({ kind: 'section', bar: 0 }), 'Section'],
    ['the capo', () => wordAt({ kind: 'capo', bar: 0 }), 'Capo on fret, 1 to 12'],
    ['an ending', () => wordAt({ kind: 'ending', bar: 1 }), 'Ending number'],
    ['a repeat’s count', () => barLineAt('repeatCount'), 'Times played, 2 to 9'],
    ['a repeat’s end', () => barLineAt('repeatEnd'), 'Times played, 2 to 9'],
    ['a tempo', () => wordAt({ kind: 'tempo', bar: 2 }), 'Tempo'],
  ];
  it.each(cases)('%s', async (_, at, field) => {
    await open();
    doubleClick(at());
    expect(screen.getByRole('dialog', { name: field })).toBeInTheDocument();
    // It edits, and does not go into note input.
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens the repeat count with its value, and Enter sets it', async () => {
    await open();
    doubleClick(barLineAt('repeatCount'));
    const field = screen.getByRole('textbox', { name: 'Times played, 2 to 9' });
    expect(field).toHaveValue('3');
    fireEvent.change(field, { target: { value: '4' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByTestId('repeat-count')).toHaveTextContent('×4');
  });

  it('works in note input too', async () => {
    await open();
    fireEvent.click(pencil());
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    doubleClick(wordAt({ kind: 'chord', index: 0 }));
    expect(screen.getByRole('dialog', { name: 'Chord name' })).toBeInTheDocument();
  });
});

describe('a double-click on something with no Edit', () => {
  it.each(['repeatStart', 'doubleBar'] as const)('a %s stays picked, opening nothing and not going into note input', async kind => {
    await open();
    doubleClick(barLineAt(kind));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('a mark stays picked, opening nothing and not going into note input', async () => {
    await open();
    const marks = markBoxes(LAYOUT);
    expect(marks.length).toBeGreaterThan(0);
    doubleClick(middleOf(marks[0].box));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('a note still goes into note input (issue #238)', async () => {
    await open();
    // The fourth column's fret, on the third string (index 2) of the first line.
    const system = LAYOUT.systems[0];
    const column = system.bars[0].columns[3];
    doubleClick({ clientX: column.x, clientY: system.top + system.rows.staffTop + 2 * STRING_GAP });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
  });
});
