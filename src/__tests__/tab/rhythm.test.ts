/**
 * Tuplets, grace notes, tremolo picking and time signature changes: read, written, edited, laid
 * out and pressed. See docs/specs/2026-10-26-tab-rhythm-design.md.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAscii, writeAscii } from '@/features/tab/ascii';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import {
  changesTime, parseClip, ticks, timeAt, unevenMessage, WHOLE, type Clip,
} from '@/features/tab/clip';
import {
  copyText, cycleTremolo, moveColumn, pasteAt, setBarTime, setTremolo, sliceClip, toggleGrace, toggleTuplet, type Cursor,
} from '@/features/tab/editing';
import { beamGroups, layoutClip, textAt } from '@/features/tab/layout';
import { applyCyclingKey, applyTool, isAvailable, isOn, toolForKey } from '@/features/tab/tools';

const read = (text: string) => readAlphaTexWith(alphaTab, text);
function clipOf(text: string): Clip {
  const result = read(text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const bars = (clip: Clip) => writeAlphaTex(clip).split('\n').filter(l => l.endsWith('|')).join('\n');
const at = (bar: number, column: number, string: number): Cursor => ({ bar, column, string });
const only = (cursor: Cursor) => ({ cursor, selection: null });
const all = (cursor: Cursor, to: number) => ({ cursor, selection: { anchor: 0, focus: to } });

describe('tuplets', () => {
  it('fill the time of two (a triplet) or four plain notes, in whole ticks', () => {
    expect(ticks({ value: 8, dots: 0, tuplet: 3 }) * 3).toBe(WHOLE / 4);
    for (const n of [5, 6, 7] as const) expect(ticks({ value: 16, dots: 0, tuplet: n }) * n).toBe(WHOLE / 4);
    expect(ticks({ value: 32, dots: 2, tuplet: 7 })).toBe(840);
  });

  it('read and write tu 3, 5, 6 and 7, each bar adding up', () => {
    const tex = '5.3.8{tu 3} 7.3.8{tu 3} 8.3.8{tu 3} 5.2.16{tu 5} 5.2.16{tu 5} 5.2.16{tu 5} 5.2.16{tu 5} 5.2.16{tu 5} '
      + '5.1.16{tu 6} 5.1.16{tu 6} 5.1.16{tu 6} 5.1.16{tu 6} 5.1.16{tu 6} 5.1.16{tu 6} 7.1.16{tu 7} 7.1.16{tu 7} 7.1.16{tu 7} '
      + '7.1.16{tu 7} 7.1.16{tu 7} 7.1.16{tu 7} 7.1.16{tu 7} |';
    const result = read(tex);
    expect(result.ok && result.warnings).toEqual([]);
    const clip = clipOf(tex);
    expect(clip.bars[0].columns.map(c => c.duration.tuplet)).toEqual([3, 3, 3, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7]);
    expect(bars(clip)).toBe(tex);
  });

  it('keep a tuplet Frets does not draw as written, and say so', () => {
    const result = read('5.3.16{tu 9} 5.3.16{tu 9} 5.3.16{tu 9} 5.3.16{tu 9} 5.3.16{tu 9} 5.3.16{tu 9} 5.3.16{tu 9} 5.3.16{tu 9} 5.3.16{tu 9} r.2{d} |');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.clip.bars[0].columns[0]).toMatchObject({ duration: { value: 16, dots: 0 }, extra: ['tu 9'] });
    expect(result.warnings.join(' ')).toMatch(/tu \(tuplet\) ×9/);
    expect(bars(result.clip)).toContain('5.3.16{tu 9}');
  });

  it('are toggled one kind at a time, from the palette or Alt with the digit', () => {
    let clip = clipOf('5.3.8 7.3.8 8.3.8 r.8 r.2 |');
    clip = toggleTuplet(clip, all(at(0, 0, 2), 2), 3);
    expect(bars(clip)).toBe('5.3.8{tu 3} 7.3.8{tu 3} 8.3.8{tu 3} r.8 r.2 |');
    clip = applyTool(clip, only(at(0, 0, 2)), 'quintuplet');
    expect(clip.bars[0].columns[0].duration.tuplet).toBe(5);
    expect(isOn(clip, at(0, 0, 2), 'quintuplet')).toBe(true);
    expect(isOn(clip, at(0, 0, 2), 'triplet')).toBe(false);
    clip = applyTool(clip, only(at(0, 0, 2)), 'quintuplet');
    expect(clip.bars[0].columns[0].duration).toEqual({ value: 8, dots: 0 });
    expect(['Digit3', 'Digit5', 'Digit6', 'Digit7', 'Digit4'].map(code => toolForKey('x', true, code)))
      .toEqual(['triplet', 'quintuplet', 'sextuplet', 'septuplet', null]);
  });

  it('take a digit after the rhythm letter in ASCII tab', () => {
    const empty = '-'.repeat(22);
    const result = readAscii([
      '   s5 s5 s5 s5 s5 q  h', 'e|-5--7--8--7--5--0--0--|',
      ...['B', 'G', 'D', 'A', 'E'].map(n => `${n}|${empty}|`),
    ].join('\n'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.clip.bars[0].columns.map(c => c.duration.tuplet ?? null)).toEqual([5, 5, 5, 5, 5, null, null]);
    expect(writeAscii(result.clip)).toContain('s5');
  });
});

describe('grace notes', () => {
  it('take no time in the bar and are written at the length alphaTab gives them', () => {
    const tex = '5.3{h}.8{gr} 7.3.4 5.3.4 5.2.16{gr} 7.2{h}.16{gr} 8.2.4 3.1.32{gr} 5.1.32{gr} 7.1.32{gr} 8.1.4 |';
    const result = read(tex);
    expect(result.ok && result.warnings).toEqual([]);
    const clip = clipOf(tex);
    expect(clip.bars[0].columns.map(c => c.grace ?? null)).toEqual(['before', null, null, 'before', 'before', null, 'before', 'before', 'before', null]);
    expect(unevenMessage(clip)).toBeNull();
    expect(bars(clip)).toBe(tex);
  });

  it('read gr ob as on the beat, and keep a bend grace note as written', () => {
    const clip = clipOf('5.3.8{gr ob} 7.3.4 5.3.8{gr b} 7.3.2{d} |');
    expect(clip.bars[0].columns[0].grace).toBe('on');
    expect(clip.bars[0].columns[2].grace).toBeUndefined();
    expect(clip.bars[0].columns[2].extra).toEqual(['gr b']);
    expect(bars(clip)).toBe('5.3.8{gr ob} 7.3.4 5.3.8{gr b} 7.3.2{d} |');
  });

  it('are toggled with the palette or Shift+G, and keep their own length while they are grace notes', () => {
    let clip = clipOf('5.3.4 7.3.4 r.2 |');
    clip = toggleGrace(clip, only(at(0, 0, 2)));
    expect(bars(clip)).toBe('5.3.8{gr} 7.3.4 r.2 |');
    expect(isOn(clip, at(0, 0, 2), 'grace')).toBe(true);
    expect(clip.bars[0].columns[0].duration.value).toBe(4);
    clip = applyTool(clip, only(at(0, 0, 2)), 'grace');
    expect(bars(clip)).toBe('5.3.4 7.3.4 r.2 |');
    expect(toolForKey('G', false, 'KeyG')).toBe('grace');
    expect(toolForKey('g', false, 'KeyG')).toBe('ghost');
  });

  it('are left out of ASCII tab, which has no way to write them', () => {
    const clip = clipOf('5.3.8{gr} 7.3.1 |');
    const ascii = writeAscii(clip);
    expect(ascii).not.toMatch(/-5-/);
    expect(ascii).toMatch(/-7-/);
  });

  it('end a beam, take no time in it and are drawn narrow', () => {
    const clip = clipOf('5.3.8 7.3.8{gr} 8.3.8 7.3.8{gr} 5.3.16 7.3.16 r.4 r.2 |');
    const bar = layoutClip(clip, 800).systems[0].bars[0];
    expect(beamGroups(bar, WHOLE / 4).map(g => g.columns.map(c => c.index))).toEqual([[0], [2], [4, 5]]);
    expect(bar.columns[1].width).toBeLessThan(bar.columns[0].width);
  });
});

describe('tremolo picking', () => {
  it('reads tp 8, 16 and 32 and its marks 1 to 3, and writes the note values', () => {
    const clip = clipOf('5.3.4{tp 8} 5.3.4{tp 16} 5.3.4{tp 32} 5.3.4{tp 2} |');
    expect(clip.bars[0].columns.map(c => c.tremolo)).toEqual([8, 16, 32, 16]);
    expect(bars(clip)).toBe('5.3.4{tp 8} 5.3.4{tp 16} 5.3.4{tp 32} 5.3.4{tp 16} |');
  });

  it('keeps what Frets does not draw (four slashes, a buzz roll) as written', () => {
    const clip = clipOf('5.3.2{tp 4} 5.3.2{tp (16 buzzRoll)} |');
    expect(clip.bars[0].columns.map(c => [c.tremolo, c.extra])).toEqual([[undefined, ['tp 4']], [undefined, ['tp (16 buzzRoll)']]]);
  });

  it('is set by speed from the palette, the same speed again stopping it, and Shift+T steps through them', () => {
    let clip = clipOf('5.3.4 7.3.4 r.2 |');
    clip = setTremolo(clip, only(at(0, 0, 2)), 16);
    expect(isOn(clip, at(0, 0, 2), 'tremolo16')).toBe(true);
    clip = applyTool(clip, only(at(0, 0, 2)), 'tremolo16');
    expect(clip.bars[0].columns[0].tremolo).toBeUndefined();
    const seen: (number | undefined)[] = [];
    for (let k = 0; k < 4; k++) {
      clip = applyCyclingKey(clip, only(at(0, 0, 2)), 'T')!;
      seen.push(clip.bars[0].columns[0].tremolo);
    }
    expect(seen).toEqual([8, 16, 32, undefined]);
    expect(cycleTremolo(clip, all(at(0, 0, 2), 1)).bars[0].columns.map(c => c.tremolo)).toEqual([8, 8, undefined]);
  });
});

describe('time signature changes', () => {
  const tex = '\\ts (4 4)\n0.6.1 |\n\\ts (3 4) 0.5.2{d} |\n0.5.2{d} |\n\\ts (4 4) 0.6.1 |\n';

  it('are read from a later bar\'s \\ts, written back, and say which time each bar is in', () => {
    const result = read(tex);
    expect(result.ok && result.warnings).toEqual([]);
    const clip = clipOf(tex);
    expect(clip.bars.map(b => b.time ?? null)).toEqual([null, { beats: 3, value: 4 }, null, { beats: 4, value: 4 }]);
    expect([0, 1, 2, 3].map(i => `${timeAt(clip, i).beats}/${timeAt(clip, i).value}`)).toEqual(['4/4', '3/4', '3/4', '4/4']);
    expect([0, 1, 2, 3].map(i => changesTime(clip, i))).toEqual([false, true, false, true]);
    expect(writeAlphaTex(clip)).toBe(tex);
  });

  it('drop a \\ts that repeats the time already in force', () => {
    const clip = clipOf('\\ts (4 4)\n0.6.1 |\n\\ts (4 4) 0.6.1 |\n');
    expect(clip.bars[1].time).toBeUndefined();
  });

  it('name each bar that does not add up by its own time', () => {
    const clip = clipOf('\\ts (4 4)\n0.6.2 |\n\\ts (3 4) 0.6.2 |\n0.6.2 |\n');
    expect(unevenMessage(clip)).toBe("Bar 1 doesn't add up to 4/4; bars 2 and 3 don't add up to 3/4.");
  });

  it('are set from a bar on, taken away by null or by setting the time before, and set the clip\'s own on the first bar', () => {
    let clip = clipOf('\\ts (4 4)\n0.6.1 |\n0.6.1 |\n0.6.1 |\n');
    clip = setBarTime(clip, 1, { beats: 3, value: 4 });
    expect(clip.bars[1].time).toEqual({ beats: 3, value: 4 });
    // The button never shows pressed; in a bar that shows a time signature it is off, the drawn numbers being the way to change it.
    expect(isOn(clip, at(1, 0, 0), 'barTime')).toBe(false);
    expect([0, 1, 2].map(b => isAvailable(clip, at(b, 0, 0), 'barTime'))).toEqual([false, false, true]);
    expect(setBarTime(clip, 1, null).bars[1].time).toBeUndefined();
    expect(setBarTime(clip, 1, { beats: 4, value: 4 }).bars[1].time).toBeUndefined();
    const first = setBarTime(clip, 0, { beats: 3, value: 4 });
    expect(first.time).toEqual({ beats: 3, value: 4 });
    // Bar 2's 3/4 now repeats the clip's, so it is no longer a change.
    expect(first.bars[1].time).toBeUndefined();
  });

  it('decide when typing on runs into a new bar', () => {
    // In 2/4 two quarters fill the bar, so moving right from the second starts a new bar.
    const clip = clipOf('\\ts (4 4)\n0.6.1 |\n\\ts (2 4) 0.6.4 0.6.4 |\n');
    const moved = moveColumn(clip, at(1, 1, 5), 1);
    expect(moved.cursor.bar).toBe(2);
    // A grace note takes no time, so a bar of one grace note and one quarter still has room.
    const grace = clipOf('\\ts (2 4)\n5.3.8{gr} 7.3.4 |\n');
    expect(moveColumn(grace, at(0, 1, 2), 1).cursor).toEqual(at(0, 2, 2));
  });

  it('go with copied columns, which take the time they were in', () => {
    const clip = clipOf(tex);
    expect(sliceClip(clip, [2, 3]).time).toEqual({ beats: 3, value: 4 });
    expect(copyText(clip, [2, 3])).toBe('\\ts (3 4)\n0.5.2{d} |\n\\ts (4 4) 0.6.1 |\n');
    const pasted = pasteAt(clipOf('\\ts (4 4)\n0.6.1 |\n'), at(0, 1, 0), clipOf('\\ts (4 4)\n0.6.1 |\n\\ts (3 4) 0.5.2{d} |\n'));
    expect(pasted.clip.bars[1].time).toEqual({ beats: 3, value: 4 });
  });

  it('are drawn inside the bar, which grows to fit them, and a press on one says which bar', () => {
    const clip = clipOf(tex);
    const layout = layoutClip(clip, 2000);
    const [b0, b1, b2] = layout.systems[0].bars;
    expect([b0.timeX, b2.timeX]).toEqual([null, null]);
    expect(b1.timeX).not.toBeNull();
    expect(b1.x1 - b1.x0).toBeGreaterThan(b2.x1 - b2.x0);
    const middle = (layout.rows.staffTop + layout.rows.staffBottom) / 2;
    expect(textAt(layout, b1.timeX!, middle)).toEqual({ kind: 'time', bar: 1 });
    expect(textAt(layout, layout.systems[0].timeX!, middle)).toEqual({ kind: 'time', bar: 0 });
  });

  it('are kept by a stored clip, and a bad one refused', () => {
    const clip = clipOf(tex);
    expect(parseClip(JSON.parse(JSON.stringify(clip)))).toEqual(clip);
    const bad = JSON.parse(JSON.stringify(clip));
    bad.bars[1].time = { beats: 3, value: 3 };
    expect(parseClip(bad)).toBeNull();
  });
});

describe('a stored clip', () => {
  it('keeps tuplets, grace notes and tremolo picking, and refuses ones Frets does not offer', () => {
    const clip = clipOf('5.3.8{gr} 5.3.16{tu 5} 5.3.16{tu 5} 5.3.16{tu 5} 5.3.16{tu 5} 5.3.16{tu 5} 5.3.4{tp 16} r.2 |');
    expect(parseClip(JSON.parse(JSON.stringify(clip)))).toEqual(clip);
    for (const change of [
      (c: Clip) => { c.bars[0].columns[1].duration.tuplet = 4 as never; },
      (c: Clip) => { c.bars[0].columns[0].grace = 'after' as never; },
      (c: Clip) => { c.bars[0].columns[6].tremolo = 64 as never; },
    ]) {
      const copy = JSON.parse(JSON.stringify(clip)) as Clip;
      change(copy);
      expect(parseClip(copy)).toBeNull();
    }
  });
});
