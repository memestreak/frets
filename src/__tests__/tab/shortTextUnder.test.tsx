import * as alphaTab from '@coderline/alphatab';
import { render } from '@testing-library/react';
import { BEAT_TEXT_LINE, SHORT_TEXT_LENGTH, textGoesUnder } from '@/features/tab/beatText';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { layoutClip, type Layout } from '@/features/tab/layout';
import { textAt, textBox } from '@/features/tab/layoutText';
import { TabClip } from '@/features/tab/TabClip';

/** docs/specs/2026-11-07-tab-short-text-under-chords-design.md */

const clipOf = (tex: string): Part => {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
};
const placedOf = (layout: Layout) => layout.systems.flatMap(s => s.bars.flatMap(b => b.columns));

const C = '\\chord ("C" 0 1 0 2 3 x)\n.\n\\ts (4 4)\n';
const TWENTY = 'let ring throughout.';
const TWENTY_ONE = 'let ring throughout..';

describe('short texts under the chord names', () => {
  it('counts a text of up to 20 characters as short, and only on a line with chord names', () => {
    expect(TWENTY).toHaveLength(SHORT_TEXT_LENGTH);
    expect(textGoesUnder(TWENTY, true)).toBe(true);
    expect(textGoesUnder(TWENTY_ONE, true)).toBe(false);
    expect(textGoesUnder('let ring', false)).toBe(false);
  });

  it('draws "let ring" under the chord name and its diagram, over the music, and nothing in the row over the names', () => {
    const { rows } = layoutClip(clipOf(`${C}0.1.4{ch "C" txt "let ring"} 0.1.4 0.1.2 |`), 800, 'tab', true).systems[0];
    expect(rows.text).toBeNull();
    expect(rows.textUnder!).toBeGreaterThan(rows.chords!);
    expect(rows.textUnder!).toBeGreaterThan(rows.diagrams!);
    expect(rows.textUnder!).toBeLessThan(rows.staffTop);
  });

  it('keeps a 21-character text over the chord names, and a 20-character one goes under', () => {
    const over = layoutClip(clipOf(`${C}0.1.4{ch "C" txt "${TWENTY_ONE}"} 0.1.4 0.1.2 |`), 800).systems[0].rows;
    expect(over.text!).toBeLessThan(over.chords!);
    expect(over.textUnder).toBeNull();
    const under = layoutClip(clipOf(`${C}0.1.4{ch "C" txt "${TWENTY}"} 0.1.4 0.1.2 |`), 800).systems[0].rows;
    expect(under.text).toBeNull();
    expect(under.textUnder!).toBeGreaterThan(under.chords!);
  });

  it('puts a short text in the one text row on a line with no chord names', () => {
    const { rows } = layoutClip(clipOf('0.1.4{txt "let ring"} 0.1.4 0.1.2 |'), 800).systems[0];
    expect(rows.text).not.toBeNull();
    expect(rows.textUnder).toBeNull();
    expect(placedOf(layoutClip(clipOf('0.1.4{txt "let ring"} 0.1.4 0.1.2 |'), 800))[0].textUnder).toBe(false);
  });

  it('decides per line: a short text on a line without chord names stays in the row over', () => {
    const bars = ['0.1.1{ch "C"}', '0.1.1', '0.1.1', '0.1.1', '0.1.1{txt "let ring"}', '0.1.1', '0.1.1', '0.1.1'];
    const layout = layoutClip(clipOf(`${C}${bars.join(' | ')} |`), 400);
    const withText = layout.systems.find(s => s.bars.some(b => b.columns.some(c => c.column.text)))!;
    expect(withText.bars.some(b => b.columns.some(c => c.column.chord))).toBe(false);
    expect(withText.rows.text).not.toBeNull();
    expect(withText.rows.textUnder).toBeNull();
  });

  it('draws a long and a short text on one line in their two rows, and a press on each picks it', () => {
    const layout = layoutClip(clipOf(`${C}0.1.4{ch "C" txt "A long note about the whole passage"} 0.1.4 0.1.4{txt "P.M."} 0.1.4 |`), 800, 'tab', true);
    const { top, rows } = layout.systems[0];
    const [long, , short] = placedOf(layout);
    expect(long.textUnder).toBe(false);
    expect(short.textUnder).toBe(true);
    expect(rows.text!).toBeLessThan(rows.chords!);
    expect(rows.textUnder!).toBeGreaterThan(rows.diagrams!);
    expect(textAt(layout, short.x, top + rows.textUnder!)).toEqual({ kind: 'text', index: short.index });
    expect(textAt(layout, short.x + 4, top + rows.text!)).toEqual({ kind: 'text', index: long.index });
    const box = textBox(layout, { kind: 'text', index: short.index })!;
    expect(box.y).toBeGreaterThan(top + rows.diagrams!);
  });

  it('stacks short texts that touch inside their row, and moves the rows under it down', () => {
    const one = layoutClip(clipOf(`${C}0.1.16{ch "C" txt "let ring"} 0.1.16 0.1.16 0.1.16 0.1.2. |`), 800).systems[0];
    const two = layoutClip(clipOf(`${C}0.1.16{ch "C" txt "let ring"} 0.1.16{txt "slowing"} 0.1.16 0.1.16 0.1.2. |`), 800).systems[0];
    expect(two.textUnderRows).toBe(2);
    expect(two.rows.textUnder).toBe(one.rows.textUnder);
    expect(two.rows.staffTop - one.rows.staffTop).toBe(BEAT_TEXT_LINE);
  });

  it('draws the short text at its row under the diagram', () => {
    const clip = clipOf(`${C}0.1.4{ch "C" txt "let ring"} 0.1.4 0.1.2 |`);
    const { container } = render(<TabClip clip={clip} width={800} title="t" chordDiagrams />);
    const text = container.querySelector('[data-testid="beat-text"]')!;
    const name = container.querySelector('[data-testid="chord-name"]')!;
    expect(Number(text.getAttribute('y'))).toBeGreaterThan(Number(name.getAttribute('y')));
  });
});
