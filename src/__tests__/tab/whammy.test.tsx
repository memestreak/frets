/**
 * The whammy bar (alphaTex `tb`, issue #216; docs/specs/2026-10-29-tab-whammy-design.md): read and
 * written, drawn under the tab as guitar books draw it, picked and set from the palette. Playback is
 * tested in playback.test.ts.
 */
import { render } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex, writeBars } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { parseClip, type Clip } from '@/features/tab/clip';
import { layoutClip, SPACE, stringY, type Parts } from '@/features/tab/layout';
import { barHeads } from '@/features/tab/notation';
import { staffMarks } from '@/features/tab/staffMarks';
import { markAt, markTool } from '@/features/tab/marks';
import { removeMark, setWhammy } from '@/features/tab/noteEdits';
import { TabClip } from '@/features/tab/TabClip';
import { isOn, noteKinds } from '@/features/tab/tools';
import { WHAMMY_SHAPES, whammyDrawings, whammyJoins, whammyLabel, whammyShape } from '@/features/tab/whammy';

function read(text: string) {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${text}\n`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result;
}
const clipOf = (text: string): Clip => read(text).clip;

const drawn = (text: string, parts: Parts = 'both') =>
  render(<TabClip clip={clipOf(text)} width={1200} parts={parts} title="Whammy" />).container;
const count = (container: Element, id: string) => container.querySelectorAll(`[data-testid="${id}"]`).length;
const labels = (container: Element) => [...container.querySelectorAll('[data-testid="whammy-label"]')].map(t => t.textContent);

/** Stop (Jane's Addiction), Gtr. 5, bars 2–3: a dive an octave down, held over the tie into the next bar. */
const DIVE = 'r.2 15.2.2{tb (0 -24)} | -.2.8{tb (-24 -24)} r.8 r.4 r.2 |';
/** Stop, Gtr. 4, bar 13: the open e pre-dipped three and a half steps, let back up over the tie. */
const RETURN = '0.1.4{tb (-14 -14)} -.1.8{tb (-14 0)} r.8 r.2 |';

describe('reading and writing', () => {
  it('reads tb as the column\'s whammy bar and writes it back after the beat\'s length', () => {
    const result = read('7.3.4{tb (0 -2 0)} 7.3.4{tb (-6 -6 -24)} r.2 |');
    expect(result.warnings).toEqual([]);
    expect(result.clip.bars[0].columns.map(c => c.whammy)).toEqual([[0, -2, 0], [-6, -6, -24], undefined]);
    expect(writeBars(result.clip)).toEqual(['7.3.4{tb (0 -2 0)} 7.3.4{tb (-6 -6 -24)} r.2 |']);
  });

  it('reads one written with a note as the beat\'s, where alphaTab reads it too', () => {
    const result = read('7.3{tb (0 -4)}.2 r.2 |');
    expect(result.warnings).toEqual([]);
    expect(result.clip.bars[0].columns[0].whammy).toEqual([0, -4]);
    expect(result.clip.bars[0].columns[0].notes[2]?.extra).toBeUndefined();
    expect(writeBars(result.clip)).toEqual(['7.3.2{tb (0 -4)} r.2 |']);
  });

  it('keeps as written the forms it doesn\'t draw: a pull-up, a named type, exact offsets, half quarter tones', () => {
    for (const tb of ['tb (0 4 0)', 'tb dive (0 -4)', 'tbe (0 0 60 -4)', 'tb (0 -2.5)']) {
      const result = read(`7.3.2{${tb}} r.2 |`);
      expect(result.clip.bars[0].columns[0].whammy).toBeUndefined();
      expect(result.clip.bars[0].columns[0].extra).toEqual([tb]);
      expect(result.warnings.join(' ')).toContain('tb');
    }
  });

  it('keeps only whole quarter tones from two to sixty points, none above the note, in a saved clip', () => {
    const clip = clipOf('7.3.2 r.2 |');
    const withWhammy = (whammy: unknown) => parseClip({ ...clip, bars: [{ columns: [{ ...clip.bars[0].columns[0], whammy }] }] });
    expect(withWhammy([0, -24])).not.toBeNull();
    for (const bad of [[0], [0, 2], [0, -1.5], 'tb', Array(61).fill(0)]) expect(withWhammy(bad)).toBeNull();
  });

  it('labels depths in steps, as guitar books do', () => {
    expect([-24, -6, -14, -2, -4, -1, -3, -12].map(whammyLabel)).toEqual(['-6', '-1½', '-3½', '-½', '-1', '-¼', '-¾', '-3']);
  });
});

describe('drawing', () => {
  it('draws a dive as a line from the number down under the tab, labelled with its depth, under "w/ bar"', () => {
    const container = drawn(DIVE);
    expect(labels(container)).toEqual(['-6']);
    expect(count(container, 'whammy-run')).toBe(1);
    expect(container.querySelector('[data-testid="whammy-run"]')?.textContent).toBe('w/ bar');
    const layout = layoutClip(clipOf(DIVE), 1200, 'both');
    const [[dive]] = whammyDrawings(layout);
    const { rows } = layout.systems[0];
    // One solid line from the number's right edge down past the bottom string.
    expect(dive.pieces).toHaveLength(1);
    expect(dive.pieces[0]).toMatchObject({ dashed: false, x1: dive.placed.x + 5, y1: stringY(rows, 1) + 6 });
    expect(dive.pieces[0].y2).toBeGreaterThan(rows.staffBottom);
  });

  it('draws nothing more for a tied note held down, and under a staff gives it no number, even at a bar\'s start', () => {
    const clip = clipOf(DIVE);
    const held = clip.bars[1].columns[0];
    expect(whammyJoins(clip).get(held)).toBe('hold');
    expect(whammyDrawings(layoutClip(clip, 1200, 'both')).flat()).toHaveLength(1);
    expect(drawn(DIVE, 'both').textContent).not.toContain('(15)');
    // The tab alone has its tie's arc, so it keeps the number.
    expect(drawn(DIVE, 'tab').textContent).toContain('(15)');
  });

  it('draws a pre-dipped note as a dashed drop, and its return climbing from there to the tied note\'s number', () => {
    const clip = clipOf(RETURN);
    expect(whammyJoins(clip).get(clip.bars[0].columns[1])).toBe('return');
    const layout = layoutClip(clip, 1200, 'both');
    const [[dip, back]] = whammyDrawings(layout);
    expect(dip.pieces).toEqual([expect.objectContaining({ dashed: true, x1: dip.placed.x, x2: dip.placed.x })]);
    expect(dip.labels.map(l => l.text)).toEqual(['-3½']);
    // The return leaves the drop's foot and ends at the tied note's number, which is drawn.
    expect(back.pieces).toHaveLength(1);
    expect(back.pieces[0]).toMatchObject({ dashed: false, x1: dip.placed.x, y1: dip.pieces[0].y2, x2: back.placed.x - 5 });
    expect(back.labels).toEqual([]);
    expect(drawn(RETURN, 'both').textContent).toContain('(0)');
  });

  it('draws a dip as a V with its depth at the bottom, and a dash where the bar is held within a note', () => {
    const [[dip, held]] = whammyDrawings(layoutClip(clipOf('7.3.4{tb (0 -2 0)} 7.3.2{tb (0 -8 -8)} r.4 |'), 1200, 'tab'));
    expect(dip.pieces.map(p => p.dashed)).toEqual([false, false]);
    expect(dip.pieces[0].y2).toBeGreaterThan(dip.pieces[0].y1);
    expect(dip.pieces[1].y2).toBe(dip.pieces[0].y1);
    expect(dip.labels.map(l => l.text)).toEqual(['-½']);
    expect(held.pieces.map(p => p.dashed)).toEqual([false, true]);
    expect(held.labels.map(l => l.text)).toEqual(['-2']);
  });

  it('goes deeper for a deeper dive', () => {
    const [[shallow, deep]] = whammyDrawings(layoutClip(clipOf('7.3.4{tb (0 -2)} 7.3.4{tb (0 -24)} r.2 |'), 1200, 'tab'));
    expect(deep.pieces[0].y2).toBeGreaterThan(shallow.pieces[0].y2);
  });

  it('goes on from where a hold began, on the same line or from the next line\'s start', () => {
    // Stop, Gtr. 5, bars 4–5: held at -3 at the end of a bar, diving on to -6 in the next.
    const bars = 'r.2 15.2.2{tb (-12 -12)} | -.2.2{tb (-12 -24)} r.2 |';
    const [line] = whammyDrawings(layoutClip(clipOf(bars), 1200, 'both'));
    expect(line).toHaveLength(2);
    const [held, dive] = line;
    expect(held.labels.map(l => l.text)).toEqual(['-3']);
    expect(dive.pieces[0].x1).toBe(held.placed.x);
    expect(dive.pieces[0].y1).toBe(held.pieces[0].y2);
    expect(dive.labels.map(l => l.text)).toEqual(['-6']);
    const broken = layoutClip(clipOf(`\\systemsLayout (1 1)\n${bars}`), 1200, 'both');
    const [first, second] = whammyDrawings(broken);
    expect(first).toHaveLength(1);
    expect(second[0].pieces[0].x1).toBe(broken.systems[1].staffStart);
  });

  it('makes room under the tab, pushing the tab\'s stems down', () => {
    const plain = layoutClip(clipOf('15.2.2 r.2 |'), 1200, 'tab').systems[0].rows;
    const dived = layoutClip(clipOf('15.2.2{tb (0 -24)} r.2 |'), 1200, 'tab').systems[0].rows;
    expect(plain.dives).toBeNull();
    expect(dived.dives).toBeGreaterThan(dived.staffBottom);
    expect(dived.stemTop - plain.stemTop).toBeGreaterThan(30);
    expect(dived.whammy).not.toBeNull();
  });

  it('draws only "w/ bar" of the tab\'s marks with the staff alone', () => {
    const container = drawn(DIVE, 'staff');
    expect(count(container, 'whammy')).toBe(0);
    expect(count(container, 'whammy-run')).toBe(1);
  });
});

describe('on the staff', () => {
  it('draws a tied note going on under a dive at the pitch reached, its own accidental shown, joined by a line', () => {
    // In E major, as the book has it: 15 on the B string is a D♮, written D6; an octave down, D5.
    const clip = clipOf(`\\ks E ${DIVE}`);
    const [picked] = barHeads(clip, 0)[1];
    const [dived] = barHeads(clip, 1)[0];
    expect(dived.step).toBe(picked.step - 7);
    // A new bar, so its natural is shown again.
    expect(dived.shows).toBe(0);
    const container = drawn(DIVE, 'both');
    expect(count(container, 'staff-slide')).toBe(1);
    expect(count(container, 'staff-tie')).toBe(0);
    // The tie's line says where the dive goes: no line of its own.
    expect(count(container, 'staff-whammy')).toBe(0);
  });

  it('draws a pre-dipped note at the pitch it is dipped to, after its fret\'s pitch in brackets', () => {
    const [[dipped]] = barHeads(clipOf(RETURN), 0);
    // The open e (E5 as written) dipped seven semitones, to A4.
    expect(dipped.bendFrom).toEqual({ step: dipped.step + 4, shows: null });
    expect(count(drawn(RETURN, 'both'), 'staff-bend-from')).toBe(1);
  });

  it('draws a line through the pitches of a dive or dip no tied note goes on from', () => {
    const text = '12.2.4{tb (0 -8 0)} 12.2.2{tb (0 -8)} r.4 |';
    const marks = staffMarks(layoutClip(clipOf(text), 1200, 'both'))[0].filter(m => m.kind === 'whammy');
    expect(marks).toHaveLength(2);
    const [dip, dive] = marks.map(m => (m.kind === 'whammy' ? m : null)!);
    expect(dip.points).toHaveLength(3);
    // Two whole steps down, an E to a C: two staff steps lower, and back.
    expect(dip.points[1][1] - dip.points[0][1]).toBeCloseTo(2 * SPACE / 2 * 1, 0);
    expect(dip.points[2][1]).toBe(dip.points[0][1]);
    expect(dive.points[1][1]).toBeGreaterThan(dive.points[0][1]);
    // Under a tab, the tab labels the depths.
    expect(dip.labels).toEqual([]);
    expect(count(drawn(text, 'both'), 'staff-whammy')).toBe(2);
  });

  it('labels the depths with the staff alone, pre-dips and tied dives too, under the staff', () => {
    const container = drawn(`${DIVE.split('|')[0]}| ${RETURN}`, 'staff');
    const texts = [...container.querySelectorAll('[data-testid="staff-whammy"] text')].map(t => t.textContent);
    expect(texts).toEqual(['-6', '-3½']);
  });

  it('picks the staff\'s line too, for the same Delete', () => {
    const text = '12.2.2{tb (0 -8)} r.2 |';
    const layout = layoutClip(clipOf(text), 1200, 'staff');
    const mark = staffMarks(layout)[0].find(m => m.kind === 'whammy')!;
    const hit = markAt(layout, mark.box.x + mark.box.width / 2, mark.box.y + mark.box.height / 2);
    expect(hit).toMatchObject({ mark: 'whammy', index: 0, on: 'staff' });
  });
});

describe('editing', () => {
  it('picks a drawn line under the tab, lights the Whammy bar button, and Delete takes it away', () => {
    const clip = clipOf('15.2.2{tb (0 -24)} r.2 |');
    const layout = layoutClip(clip, 1200, 'tab');
    const [[dive]] = whammyDrawings(layout);
    const { box } = dive;
    const hit = markAt(layout, box.x + box.width / 2, box.y + box.height - 4);
    expect(hit).toMatchObject({ mark: 'whammy', index: 0 });
    expect(markTool(clip, hit!)).toBe('whammy');
    expect(removeMark(clip, hit!).bars[0].columns[0].whammy).toBeUndefined();
    // On the strings a press is the note's, or a place for the cursor.
    expect(markAt(layout, dive.placed.x + 20, stringY(layout.systems[0].rows, 3))).toBeNull();
  });

  it('sets a shape from the palette\'s panel on the cursor\'s column, and None takes it away', () => {
    const clip = clipOf('15.2.2 r.2 |');
    const target = { cursor: { bar: 0, column: 0, string: 1 }, selection: null };
    const dived = setWhammy(clip, target, WHAMMY_SHAPES.diveBomb);
    expect(dived.bars[0].columns[0].whammy).toEqual([0, -24]);
    expect(isOn(dived, target.cursor, 'whammy')).toBe(true);
    expect(noteKinds(dived, target.cursor).whammy).toBe('diveBomb');
    expect(setWhammy(dived, target, null).bars[0].columns[0].whammy).toBeUndefined();
    expect(writeAlphaTex(dived)).toContain('15.2.2{tb (0 -24)}');
  });

  it('names a whammy bar no shape matches "other", so the button lights with no choice lit', () => {
    expect(whammyShape([-14, 0])).toBeNull();
    const clip = clipOf(RETURN);
    expect(noteKinds(clip, { bar: 0, column: 0, string: 0 }).whammy).toBe('other');
    expect(Object.keys(WHAMMY_SHAPES).map(id => whammyShape(WHAMMY_SHAPES[id as keyof typeof WHAMMY_SHAPES]))).toEqual(Object.keys(WHAMMY_SHAPES));
  });
});
