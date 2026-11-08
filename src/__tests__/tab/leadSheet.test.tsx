/**
 * The lead sheet's layout, presses and keys (issue #295, `docs/specs/2026-11-08-tab-lead-sheet-design.md`).
 * The page is in `page/leadSheet.test.tsx`.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { tabSvg } from '@/features/tab/exportTab';
import { DEFAULT_TAB_EXPORT } from '@/features/tab/exportTab';
import { boxOf, boxX, layoutLeadSheet, leadAt, leadBeats, leadCaret, leadKey, leadPlayX, MIN_BOX, type LeadBox } from '@/features/tab/leadSheet';
import { readShowParam, shareLink } from '@/features/tab/shareLink';

function read(text: string): Part {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${text}`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

const G = '(3.1 0.2 0.3 0.4 2.5 3.6)';
const C = '(0.1 1.2 0.3 2.4 3.5)';
/** `n` bars of a whole G chord, the first named G. */
const bars = (n: number, head = '') => `${head}${G}.1{ch "G"} |${` ${G}.1 |`.repeat(n - 1)}`;
const WIDTH = 800;
const lead = (part: Part, width = WIDTH) => layoutLeadSheet(part, width);
const box = (part: Part, bar: number, width = WIDTH): LeadBox => boxOf(lead(part, width), bar)!.box;
/** Each slash's beat, counted from 1, by where it is drawn in its box. */
const slashBeats = (b: LeadBox, beats: number[]) => b.slashes.map(x => beats.findIndex(s => Math.abs(boxX(b, s) - x) < 0.01) + 1);

describe('rows', () => {
  it('four bars a row when the arrangement sets no line breaks', () => {
    const layout = lead(read(bars(9)));
    expect(layout.rows.map(r => r.boxes.length)).toEqual([4, 4, 1]);
    // A short row's boxes are as wide as a full row's.
    expect(layout.rows[2].boxes[0].x1 - layout.rows[2].boxes[0].x0).toBeCloseTo(layout.rows[0].boxes[0].x1 - layout.rows[0].boxes[0].x0);
  });

  it('the arrangement’s own bars per line', () => {
    expect(lead(read(bars(7, '\\defaultSystemsLayout 3\n'))).rows.map(r => r.boxes.length)).toEqual([3, 3, 1]);
  });

  it('a section starts a row', () => {
    const part = read(`${G}.1{ch "G"} | ${G}.1 | \\section "Chorus" ${C}.1{ch "C"} | ${C}.1 | ${C}.1 |`);
    const layout = lead(part);
    expect(layout.rows.map(r => r.boxes.map(b => b.bar))).toEqual([[0, 1], [2, 3, 4]]);
    expect(layout.rows[1].section?.section.text).toBe('Chorus');
  });

  it('a narrow page holds fewer, never a box under the narrowest', () => {
    const layout = lead(read(bars(4)), 300);
    expect(layout.rows[0].boxes.length).toBeLessThan(4);
    expect(layout.rows[0].boxes[0].x1 - layout.rows[0].boxes[0].x0).toBeGreaterThanOrEqual(MIN_BOX);
  });
});

describe('chord names and slashes', () => {
  it('a bar with no new chord draws the name again', () => {
    const part = read(bars(2));
    expect(box(part, 1).chords).toMatchObject([{ name: 'G', carried: true, index: null }]);
  });

  it('a chord on beat 3 of 4/4 is drawn halfway', () => {
    const b = box(read(`${G}.2{ch "G"} ${C}.2{ch "C"} |`), 0);
    expect(b.chords.map(c => c.name)).toEqual(['G', 'C']);
    expect(b.chords[1].x).toBeCloseTo((b.from + b.to) / 2);
  });

  it('a chord coming after the bar’s start: the one sounding is drawn first', () => {
    const b = box(read(`${G}.1{ch "G"} | ${G}.2 ${C}.2{ch "C"} |`), 1);
    expect(b.chords.map(c => [c.name, c.carried])).toEqual([['G', true], ['C', false]]);
  });

  it('G on beat 1 of 4/4 draws slashes on beats 3 and 4 only: beat 2 is under the name', () => {
    const part = read(`${G}.4{ch "G"} ${G}.4 ${G}.4 ${G}.4 |`);
    expect(slashBeats(box(part, 0), leadBeats(part, 0))).toEqual([3, 4]);
  });

  it('a longer name covers less than two beats; Am7 on 1 leaves 3 and 4', () => {
    const part = read(`${C}.1{ch "Am7"} |`);
    expect(slashBeats(box(part, 0), leadBeats(part, 0))).toEqual([3, 4]);
  });

  it('beats: 6/8 has two, 7/8 as 2+2+3 three, 2/2 two, and a Pickup bar only those in it', () => {
    expect(leadBeats(read(`\\ts (6 8) ${G}.4{d} ${G}.4{d} |`), 0)).toHaveLength(2);
    expect(leadBeats(read(`\\ts (7 8) ${G}.4 ${G}.4 ${G}.4{d} |`), 0)).toHaveLength(3);
    expect(leadBeats(read(`\\ts (2 2) ${G}.1 |`), 0)).toHaveLength(2);
    const pickup = read(`\\ac ${G}.4 | ${G}.1 |`);
    expect(leadBeats(pickup, 0)).toEqual([0]);
  });

  it('a silent bar is an empty box, and the bar after it draws the chord carried on', () => {
    const part = read(`${G}.1{ch "G"} | r.1 | ${G}.1 |`);
    expect(box(part, 1)).toMatchObject({ silent: true, chords: [], slashes: [] });
    expect(box(part, 2).chords).toMatchObject([{ name: 'G', carried: true }]);
  });

  it('names that would touch are drawn smaller', () => {
    const tight = box(read(`${G}.16{ch "Cmaj7#11"} ${G}.16{ch "Dbmaj9"} ${G}.8 ${G}.4 ${G}.2 |`), 0, 400);
    expect(tight.nameSize).toBeLessThan(20);
    expect(box(read(bars(1)), 0).nameSize).toBe(20);
  });
});

describe('signatures, repeats and endings', () => {
  it('the time signature before the first box and at a change, on no other bar', () => {
    const part = read(`${G}.1 | ${G}.1 | \\ts (3 4) ${G}.2{d} | ${G}.2{d} |`);
    const layout = lead(part);
    const times = layout.rows.flatMap(r => r.boxes).map(b => (b.time ? `${b.time.beats}/${b.time.value}` : null));
    expect(times).toEqual(['4/4', null, '3/4', null]);
    // Bar 1's is before its box; bar 3's, not first on its row, inside its box.
    expect(box(part, 0).timeX).toBeLessThan(box(part, 0).x0);
    expect(box(part, 2).timeX).toBeGreaterThan(box(part, 2).x0);
  });

  it('a repeat’s start, end and ×3, an ending, a double bar and the end', () => {
    const part = read(`\\ro ${G}.1 | \\ae 1 \\rc 3 ${G}.1 | \\ae 2 ${G}.1 | \\db ${G}.1 | ${G}.1 |`);
    const boxes = lead(part).rows.flatMap(r => r.boxes);
    expect(boxes.map(b => [b.repeatStart, b.repeatEnd, b.ending, b.doubleBar, b.last])).toEqual([
      [true, null, null, false, false],
      [false, 3, 1, false, false],
      [false, null, 2, false, false],
      [false, null, null, true, false],
      [false, null, null, false, true],
    ]);
    expect(lead(part).rows[0].endingY).not.toBeNull();
  });
});

describe('presses, the caret and the playhead', () => {
  const part = read(`\\section "Verse" ${G}.2{ch "G" txt "softly"} ${C}.4{ch "C"} ${C}.4 | ${G}.1 |`);
  const layout = lead(part);
  const row = layout.rows[0];
  const b0 = row.boxes[0];
  const mid = (row.boxTop + row.boxBottom) / 2;

  it('a press in a box is on the beat’s column: beat 2 is the half note’s, beat 4 the last quarter’s', () => {
    expect(leadAt(part, layout, boxX(b0, b0.span * 0.3), row.boxBottom - 4)).toEqual({ kind: 'beat', bar: 0, column: 0 });
    expect(leadAt(part, layout, boxX(b0, b0.span * 0.8), row.boxBottom - 4)).toEqual({ kind: 'beat', bar: 0, column: 2 });
  });

  it('a press on a chord name, a text or a section picks it; on a carried name, the beat', () => {
    expect(leadAt(part, layout, b0.chords[0].x + 4, mid + 4)).toEqual({ kind: 'chord', index: 0 });
    expect(leadAt(part, layout, b0.texts[0].x + 4, row.textY! + 6)).toEqual({ kind: 'text', index: 0 });
    expect(leadAt(part, layout, b0.x0 + 4, row.sectionY! + 10)).toEqual({ kind: 'section', bar: 0 });
    const b1 = row.boxes[1];
    expect(leadAt(part, layout, b1.chords[0].x + 4, mid + 4)).toEqual({ kind: 'beat', bar: 1, column: 0 });
    // Off every box.
    expect(leadAt(part, layout, 2, 2)).toBeNull();
  });

  it('the caret and the playhead at their column’s time', () => {
    expect(leadCaret(layout, { bar: 0, column: 1 })!.x).toBeCloseTo(boxX(b0, b0.span / 2) - 3);
    // Halfway through the half note: a quarter in.
    expect(leadPlayX(part, layout, 0, 0.5)!.x).toBeCloseTo(boxX(b0, b0.span / 4));
    // In bar 2's box.
    expect(leadPlayX(part, layout, 3, 0)!.x).toBeCloseTo(row.boxes[1].from);
  });

  it('keys: Left and Right a column across bars, Ctrl/⌘ a bar, C, Enter, Delete and Esc; digits nothing', () => {
    const at = { bar: 0, column: 2, string: 0 };
    expect(leadKey(part, at, false, { key: 'ArrowRight' })).toEqual({ move: { bar: 1, column: 0 } });
    expect(leadKey(part, at, false, { key: 'ArrowLeft' })).toEqual({ move: { bar: 0, column: 1 } });
    expect(leadKey(part, { ...at, bar: 1, column: 0 }, false, { key: 'ArrowLeft' })).toEqual({ move: { bar: 0, column: 2 } });
    expect(leadKey(part, at, false, { key: 'ArrowRight', metaKey: true })).toEqual({ move: { bar: 1, column: 0 } });
    expect(leadKey(part, at, false, { key: 'c' })).toEqual({ act: 'chord' });
    expect(leadKey(part, at, true, { key: 'Enter' })).toEqual({ act: 'edit' });
    expect(leadKey(part, at, true, { key: 'Delete' })).toEqual({ act: 'delete' });
    expect(leadKey(part, at, false, { key: 'Delete' })).toBeNull();
    expect(leadKey(part, at, false, { key: 'Escape' })).toEqual({ act: 'letGo' });
    expect(leadKey(part, at, false, { key: '5' })).toBeNull();
    expect(leadKey(part, at, false, { key: 'ArrowUp' })).toBeNull();
  });
});

describe('the link and the image', () => {
  it('?show=lead reads as the lead sheet, and a link writes it', async () => {
    expect(readShowParam('?show=lead')).toBe('lead');
    expect(readShowParam('?show=Lead')).toBeNull();
    expect(await shareLink('https://frets.eminor.net', 'riff', 'lead')).toMatch(/^https:\/\/frets\.eminor\.net\/tab\?show=lead#tabz=/);
  });

  it('the exported SVG with the lead sheet draws the grid, not a tab', () => {
    const part = read(`${G}.1{ch "G"} | ${G}.1 |`);
    const svg = tabSvg(part, DEFAULT_TAB_EXPORT, 'Song', 'lead');
    expect(svg).toContain('data-testid="lead-sheet"');
    expect(svg).not.toContain('data-testid="tab-system"');
    expect(tabSvg(part, DEFAULT_TAB_EXPORT, 'Song', 'tab')).not.toContain('lead-sheet');
  });
});
