/**
 * Step 8, every Mark can be picked (`docs/specs/2026-11-04-tab-pick-every-mark-design.md`): P.M. and let
 * ring lines and signatures picked on their own, a Span's Handles dragged, Alt+Shift+← →, and what a
 * picked Mark draws on the page only.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { attachment } from '@/features/tab/attachment';
import { partOf, type Part } from '@/features/tab/clip';
import { DEFAULT_TAB_EXPORT, tabSvg } from '@/features/tab/exportTab';
import { layoutClip, type Layout, type Parts } from '@/features/tab/layout';
import { textBox, type WordHit } from '@/features/tab/layoutText';
import { markBoxes, type Box, type MarkHit } from '@/features/tab/marks';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';
import { setUpPage, renderAt, SLOW, undo, litFrets, isLit, editor, keys, alphaTex } from './helpers';
import { tool } from '../tool';

setUpPage();

function clipOf(text: string): Part {
  const read = readAlphaTexWith(alphaTab, text);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  return partOf(read.clip);
}

/** Opens `body` on the tab alone, drawn as jsdom draws it (800 wide at 0, 0), and gives its layout. */
async function open(body: string, parts: Parts = 'tab'): Promise<Layout> {
  // The clip's own line breaks drawn, so a test can put a Span's end at a line's end.
  localStorage.setItem('frets.tab.notation', JSON.stringify({ show: parts, lineBreaks: true }));
  const text = `\\title "Marks"\n${body}`;
  renderAt(`#tab=${encodeURIComponent(text)}`);
  await screen.findByRole('heading', { name: 'Marks' }, SLOW);
  return layoutClip(clipOf(text), 800, parts);
}

/** The fret numbers drawn in the selection's blue, leaving out a lit Mark's words. */
const litNumbers = () => litFrets().filter(e => /^\d+$/.test(e.textContent ?? ''));
const drawing = () => screen.getByRole('img', { name: /drawn as/ });
const middleOf = (box: Box) => ({ clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
const markHit = (layout: Layout, mark: MarkHit['mark']) => markBoxes(layout).find(m => m.hit.mark === mark)!;
/** A press on the middle of the first drawn `mark`; `button` 2 is a right-click, which opens its menu too. */
function pressMark(layout: Layout, mark: MarkHit['mark'], button = 0) {
  const at = middleOf(markHit(layout, mark).box);
  fireEvent.pointerDown(drawing(), { ...at, button });
  if (button === 2) fireEvent.contextMenu(editor(), at);
}
function pressWord(layout: Layout, hit: WordHit, button = 0) {
  const at = middleOf(textBox(layout, hit, null)!);
  fireEvent.pointerDown(drawing(), { ...at, button });
  if (button === 2) fireEvent.contextMenu(editor(), at);
}

describe('P.M. and let ring lines are picked as Marks (Q2)', () => {
  const cases = [
    ['let ring', 'letRing', 'let-ring', 'Let ring', 'Palm mute', '{lr}'],
    ['P.M.', 'palmMute', 'palm-mute', 'Palm mute', 'Let ring', '{pm}'],
  ] as const;

  it.each(cases)('a press on a %s line picks it: drawn blue, no column selected, only its tool lit; Delete keeps the notes', async (_, mark, testId, own, other, effect) => {
    const prop = effect.slice(1, -1);
    const layout = await open(`\\ts (4 4)\n0.3.4 2.3{${prop}}.4 3.3{${prop}}.4 5.3{${prop}}.4 |`);
    act(() => editor().focus());
    pressMark(layout, mark);
    expect(isLit(screen.getByTestId(testId))).toBe(true);
    expect(litNumbers()).toHaveLength(0);
    expect(screen.queryByTestId('range-box')).toBeNull();
    expect(tool(own)).toHaveAttribute('aria-pressed', 'true');
    expect(tool(other)).toHaveAttribute('aria-pressed', 'false');
    expect(tool('Quarter note')).toHaveAttribute('aria-pressed', 'false');
    keys('Delete');
    expect(screen.queryByTestId(testId)).toBeNull();
    expect(alphaTex()).toBe('0.3.4 2.3.4 3.3.4 5.3.4 |');
  });

  it.each(cases)('Esc lets a picked %s line go', async (_, mark, testId) => {
    const layout = await open(`\\ts (4 4)\n0.3.4 2.3{${mark === 'letRing' ? 'lr' : 'pm'}}.4 3.3.2 |`);
    act(() => editor().focus());
    pressMark(layout, mark);
    expect(isLit(screen.getByTestId(testId))).toBe(true);
    keys('Escape');
    expect(isLit(screen.getByTestId(testId))).toBe(false);
    expect(screen.queryByTestId('span-handle')).toBeNull();
  });
});

describe('time and key signatures are picked as words are (Q3)', () => {
  const BODY = '\\ts (4 4)\n\\ks G\n5.3.1 |\n\\ts (3 4)\n\\ks D\n5.3.2{d} |';
  const cases = [
    ['time', /^Time signature/, /\\ts \(3 4\)/],
    ['key', /^Key signature/, /\\ks D/],
  ] as const;

  it.each(cases)('a press on a %s signature picks it, blue, and opens no panel; Enter, a double-click and its menu’s Edit open it', async (kind, panel) => {
    // A key signature is drawn on the staff only.
    const layout = await open(BODY, 'both');
    pressWord(layout, { kind, bar: 1 });
    expect(screen.queryByRole('dialog', { name: panel })).toBeNull();
    const drawn = [...screen.queryAllByTestId(`${kind}-signature`), ...screen.queryAllByTestId(`staff-${kind}-signature`)];
    expect(drawn.some(isLit)).toBe(true);
    keys('Enter');
    expect(screen.getByRole('dialog', { name: panel })).toBeInTheDocument();
    keys('Escape');
    const at = middleOf(textBox(layout, { kind, bar: 1 }, null)!);
    fireEvent.pointerDown(drawing(), { ...at, button: 0 });
    fireEvent.pointerDown(drawing(), { ...at, button: 0 });
    fireEvent.doubleClick(drawing(), at);
    expect(screen.getByRole('dialog', { name: panel })).toBeInTheDocument();
    keys('Escape');
    pressWord(layout, { kind, bar: 1 }, 2);
    fireEvent.click(within(screen.getByRole('menu', { name: 'Selected' })).getByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByRole('dialog', { name: panel })).toBeInTheDocument();
  });

  it.each(cases)('Delete on a later %s change takes it away; on bar 1’s it does nothing, and its menu has no Delete', async (kind, _, change) => {
    // A key signature is drawn on the staff only.
    const layout = await open(BODY, 'both');
    act(() => editor().focus());
    const before = alphaTex();
    pressWord(layout, { kind, bar: 0 });
    keys('Delete');
    expect(alphaTex()).toBe(before);
    pressWord(layout, { kind, bar: 0 }, 2);
    expect(within(screen.getByRole('menu', { name: 'Selected' })).getAllByRole('menuitem').map(b => b.textContent)).toEqual(['Edit']);
    fireEvent.keyDown(screen.getByRole('menu', { name: 'Selected' }), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    const text = (screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement).value;
    expect(text).toMatch(change);
    fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
    act(() => editor().focus());
    pressWord(layout, { kind, bar: 1 });
    keys('Delete');
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect((screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement).value).not.toMatch(change);
  });
});

describe('a picked Span’s Handles (Q5–Q8)', () => {
  const RING = '\\ts (4 4)\n(2.2{lr} 0.3{lr}).4 (3.2 2.3).4 (0.2 3.3).4 r.4 |';
  const handles = (layout: Layout) => attachment(layout, markHit(layout, 'letRing').hit).handles;
  const drag = (from: { x: number; y: number }, toX: number) => {
    fireEvent.pointerDown(drawing(), { clientX: from.x, clientY: from.y, button: 0, pointerId: 1 });
    fireEvent.pointerMove(drawing(), { clientX: toX, clientY: from.y, pointerId: 1 });
  };
  const columnX = (layout: Layout, index: number) => layout.systems[0].bars.flatMap(b => b.columns).find(c => c.index === index)!.x;

  it('a picked let ring Span draws a Handle at each end, with its Attachment lines and its notes tinted', async () => {
    const layout = await open(RING);
    pressMark(layout, 'letRing');
    expect(screen.getAllByTestId('span-handle').map(h => h.getAttribute('data-end'))).toEqual(['start', 'end']);
    expect(screen.getAllByTestId('attachment-line')).toHaveLength(1);
    expect(screen.getAllByTestId('tinted-note')).toHaveLength(2);
    // Tinted numbers stay in ink: they don't look picked.
    expect(litNumbers()).toHaveLength(0);
  });

  it('dragging the end Handle two columns on marks every note of both, as one undo step; it stops before a rest', async () => {
    const layout = await open(RING);
    act(() => editor().focus());
    pressMark(layout, 'letRing');
    const end = handles(layout).find(h => h.end === 'end')!;
    drag(end, columnX(layout, 3) + 2);
    fireEvent.pointerUp(drawing(), { clientX: columnX(layout, 3) + 2, clientY: end.y, pointerId: 1 });
    expect(alphaTex()).toBe('(2.2{lr} 0.3{lr}).4 (3.2{lr} 2.3{lr}).4 (0.2{lr} 3.3{lr}).4 r.4 |');
    // Letting go leaves it picked.
    expect(isLit(screen.getByTestId('let-ring'))).toBe(true);
    undo();
    expect(alphaTex()).toBe('(2.2{lr} 0.3{lr}).4 (3.2 2.3).4 (0.2 3.3).4 r.4 |');
  });

  it('Esc while dragging puts the Span back', async () => {
    const layout = await open(RING);
    act(() => editor().focus());
    pressMark(layout, 'letRing');
    const end = handles(layout).find(h => h.end === 'end')!;
    drag(end, columnX(layout, 2));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(drawing(), { clientX: columnX(layout, 2), clientY: end.y, pointerId: 1 });
    expect(alphaTex()).toBe('(2.2{lr} 0.3{lr}).4 (3.2 2.3).4 (0.2 3.3).4 r.4 |');
  });

  it('dragging the start Handle one column earlier moves the label there', async () => {
    const layout = await open('\\ts (4 4)\n0.3.4 2.3{lr}.4 3.3{lr}.4 5.3.4 |');
    act(() => editor().focus());
    pressMark(layout, 'letRing');
    const start = handles(layout).find(h => h.end === 'start')!;
    const labelX = () => Number(screen.getByTestId('let-ring').querySelector('text')!.getAttribute('x'));
    const before = labelX();
    drag(start, columnX(layout, 0));
    fireEvent.pointerUp(drawing(), { clientX: columnX(layout, 0), clientY: start.y, pointerId: 1 });
    expect(labelX()).toBeLessThan(before);
    expect(alphaTex()).toBe('0.3{lr}.4 2.3{lr}.4 3.3{lr}.4 5.3.4 |');
  });
});

describe('Alt+Shift+← → on a picked Span (Q9)', () => {
  const LINES = '\\systemsLayout 1\n\\ts (2 4)\n0.3.4 2.3{lr}.4 |\n3.3.4 5.3.4 |';
  /** The bars, without the line that sets one bar to a line of tab. */
  const bars = () => alphaTex().replace(/^\\systemsLayout \(1\) /, '');

  it('Alt+Shift+→ marks the next column, across a line of tab; Alt+Shift+← unmarks its last', async () => {
    await open(LINES);
    expect(screen.getAllByTestId('tab-system')).toHaveLength(2);
    act(() => editor().focus());
    // On its label, where the page draws it (reading the alphaTex lets it go, so it is picked again).
    const pickLine = () => {
      const label = screen.getAllByTestId('let-ring')[0].querySelector('text')!;
      fireEvent.pointerDown(drawing(), { clientX: Number(label.getAttribute('x')) + 10, clientY: Number(label.getAttribute('y')) - 4, button: 0 });
      expect(isLit(screen.getAllByTestId('let-ring')[0])).toBe(true);
    };
    pickLine();
    keys({ key: 'ArrowRight', altKey: true, shiftKey: true });
    // Drawn on both lines, both lit: still picked.
    expect(screen.getAllByTestId('let-ring').map(isLit)).toEqual([true, true]);
    expect(bars()).toBe('0.3.4 2.3{lr}.4 |\n3.3{lr}.4 5.3.4 |');
    pickLine();
    keys({ key: 'ArrowLeft', altKey: true, shiftKey: true });
    expect(bars()).toBe('0.3.4 2.3{lr}.4 |\n3.3.4 5.3.4 |');
  });

  it('without a picked Span, Alt+Shift+→ grows the selection as before', async () => {
    await open(LINES);
    act(() => editor().focus());
    keys('Home');
    keys({ key: 'ArrowRight', altKey: true, shiftKey: true });
    const first = litNumbers().length;
    expect(first).toBeGreaterThan(0);
    keys({ key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(litNumbers().length).toBe(first + 1);
    expect(bars()).toBe('0.3.4 2.3{lr}.4 |\n3.3.4 5.3.4 |');
  });
});

describe('what a picked Mark draws stays on the page (Q17)', () => {
  it('PNG and SVG exports of a clip with a let ring Span have no Handle, Attachment line or tint', () => {
    // The export draws the clip with nothing picked: it is given no pick to draw.
    const svg = tabSvg(clipOf('\\ts (4 4)\n0.3{lr}.4 2.3{lr}.4 3.3.2 |'), DEFAULT_TAB_EXPORT, 'Marks');
    expect(svg).toContain('let-ring');
    for (const id of ['span-handle', 'attachment-line', 'tinted-note', 'tinted-head']) expect(svg).not.toContain(id);
  });
});

describe('the ? overlay', () => {
  it('lists Alt+Shift+← → for a picked line’s end', () => {
    const listed = TAB_SHORTCUTS.flatMap(g => g.shortcuts);
    expect(listed.find(s => s.keys.includes('Alt+Shift+Right'))?.does).toMatch(/line’s end/);
  });
});

describe('a let ring or P.M. line just added is picked (Jeremy, 2026-11-09)', () => {
  const cases = [['let ring', 'i', 'let-ring', 'lr'], ['P.M.', 'm', 'palm-mute', 'pm']] as const;

  it.each(cases)('%s on the note at the cursor: the line is picked, no note lit; Delete takes the line away', async (_, key, testId, prop) => {
    await open('\\ts (4 4)\n0.3.4 2.3.4 3.3.4 5.3.4 |');
    act(() => editor().focus());
    keys('ArrowRight', key);
    expect(isLit(screen.getByTestId(testId))).toBe(true);
    expect(litNumbers()).toHaveLength(0);
    expect(screen.getAllByTestId('span-handle')).toHaveLength(2);
    // Delete takes the picked line away, not the note.
    keys('Delete');
    expect(screen.queryByTestId(testId)).toBeNull();
    expect(alphaTex()).toBe('0.3.4 2.3.4 3.3.4 5.3.4 |');
    undo();
    expect(alphaTex()).toBe(`0.3.4 2.3{${prop}}.4 3.3.4 5.3.4 |`);
  });

  it.each(cases)('%s on a selection: the whole line is picked, so Alt+Shift+→ makes it longer', async (_, key, testId, prop) => {
    await open('\\ts (4 4)\n0.3.4 2.3.4 3.3.4 5.3.4 |');
    act(() => editor().focus());
    keys({ key: 'ArrowRight', shiftKey: true }, key);
    expect(isLit(screen.getByTestId(testId))).toBe(true);
    expect(litNumbers()).toHaveLength(0);
    keys({ key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(alphaTex()).toBe(`0.3{${prop}}.4 2.3{${prop}}.4 3.3{${prop}}.4 5.3.4 |`);
    expect(isLit(screen.getByTestId(testId))).toBe(true);
  });

  it('the key again on the picked line takes it all away, and nothing is picked', async () => {
    await open('\\ts (4 4)\n0.3.4 2.3.4 3.3.4 5.3.4 |');
    act(() => editor().focus());
    keys({ key: 'ArrowRight', shiftKey: true }, 'i', 'i');
    expect(alphaTex()).toBe('0.3.4 2.3.4 3.3.4 5.3.4 |');
    expect(screen.queryByTestId('let-ring')).toBeNull();
  });

  it('in note input mode I puts let ring on and picks nothing: the caret stays', async () => {
    await open('\\ts (4 4)\n0.3.4 2.3.4 3.3.4 5.3.4 |');
    act(() => editor().focus());
    keys('n', 'i');
    expect(screen.queryAllByTestId('span-handle')).toHaveLength(0);
    expect(isLit(screen.getByTestId('let-ring'))).toBe(false);
  });

  it('taking let ring off a note picks nothing', async () => {
    await open('\\ts (4 4)\n0.3{lr}.4 2.3.4 3.3.4 5.3.4 |');
    act(() => editor().focus());
    keys('i');
    expect(alphaTex()).toBe('0.3.4 2.3.4 3.3.4 5.3.4 |');
    expect(screen.queryByTestId('let-ring')).toBeNull();
    keys('Delete');
    expect(alphaTex()).toBe('r.4 2.3.4 3.3.4 5.3.4 |');
  });
});
