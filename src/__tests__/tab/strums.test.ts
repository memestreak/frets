/**
 * Strums and Rolled chords drawn and edited (issue #384;
 * `docs/specs/2026-11-09-tab-strums-rolled-chords-design.md`): read and written as alphaTex `bd` `bu`
 * `ad` `au`, set by four palette tools, drawn as a sign left of the chord, picked and deleted.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex, writePart } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Clip, type Part } from '@/features/tab/clip';
import { restOf, type Cursor } from '@/features/tab/editing';
import { layoutClip } from '@/features/tab/layout';
import { markAt, markBoxes, markTool, type MarkHit } from '@/features/tab/marks';
import { writeMusicXml } from '@/features/tab/musicxml';
import { removeMark } from '@/features/tab/noteEdits';
import { rollSign, tabRollPlace } from '@/features/tab/rollSign';
import { staffMarks } from '@/features/tab/staffMarks';
import { applyTool, isOn } from '@/features/tab/tools';

function read(body: string) {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${body}\n`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result;
}

function clipOf(body: string): Clip {
  const result = read(body);
  expect(result.warnings).toEqual([]);
  return result.clip;
}

const partFrom = (body: string): Part => partOf(clipOf(body));
/** The bars as alphaTex, without the header lines. */
const notesOf = (clip: Part) => writePart(clip).split('\n').filter(l => l && !l.startsWith('\\')).join(' ');
const at = (bar: number, column: number, string = 0): Cursor => ({ bar, column, string });
const only = (cursor: Cursor) => ({ cursor, selection: null });

const C = '(0.1 1.2 0.3 2.4 3.5)';
const WIDTH = 900;

describe('reading and writing', () => {
  it('reads each keyword as a Strum or Rolled chord, kept nowhere', () => {
    const clip = partFrom(`${C}.4{bd} ${C}.4{bu} ${C}.4{ad} ${C}.4{au} |`);
    expect(clip.bars[0].columns.map(c => c.roll)).toEqual([
      { sign: 'strum', direction: 'down' }, { sign: 'strum', direction: 'up' },
      { sign: 'rolled', direction: 'down' }, { sign: 'rolled', direction: 'up' },
    ]);
    expect(clip.bars[0].columns.every(c => c.extra === undefined)).toBe(true);
  });

  it('reads a written length', () => {
    expect(partFrom(`${C}.4{bd 60} r.4 r.2 |`).bars[0].columns[0].roll).toEqual({ sign: 'strum', direction: 'down', length: 60 });
  });

  it('keeps two on one beat as written', () => {
    const result = read(`${C}.4{bd au} r.4 r.2 |`);
    const column = partOf(result.clip).bars[0].columns[0];
    expect(column.roll).toBeUndefined();
    expect(column.extra).toEqual(['bd', 'au']);
  });

  it('writes each back after the pick stroke, and reads it back the same', () => {
    const clip = clipOf(`${C}.4{sd bd} ${C}.4{bu} ${C}.4{ad} ${C}.4{bd 60} |`);
    const text = writeAlphaTex(clip);
    expect(text).toContain(`${C}.4{sd bd} ${C}.4{bu}`);
    expect(text).toContain(`${C}.4{ad} ${C}.4{bd 60}`);
    expect(partOf(clipOf(text.replace('\\ts (4 4)\n', ''))).bars).toEqual(partOf(clip).bars);
  });
});

describe('the palette tools', () => {
  it('puts a Strum down on the cursor column, and takes it away when pressed again', () => {
    const clip = partFrom(`${C}.4 ${C}.4 r.2 |`);
    const on = applyTool(clip, only(at(0, 0)), 'strumDown');
    expect(on.bars[0].columns[0].roll).toEqual({ sign: 'strum', direction: 'down' });
    expect(on.bars[0].columns[1].roll).toBeUndefined();
    expect(applyTool(on, only(at(0, 0)), 'strumDown').bars[0].columns[0].roll).toBeUndefined();
  });

  it('puts it on every column of a selection', () => {
    const clip = applyTool(partFrom(`${C}.4 ${C}.4 ${C}.4 ${C}.4 |`), { cursor: at(0, 1), selection: { anchor: 2, focus: 1 } }, 'rolledUp');
    expect(clip.bars[0].columns.map(c => c.roll?.direction)).toEqual([undefined, 'up', 'up', undefined]);
  });

  it('replaces another sign, and a kept one, rather than adding to it', () => {
    const strum = partFrom(`${C}.4{bu} r.4 r.2 |`);
    expect(applyTool(strum, only(at(0, 0)), 'rolledUp').bars[0].columns[0].roll).toEqual({ sign: 'rolled', direction: 'up' });
    const kept = read(`${C}.4{bd au} r.4 r.2 |`);
    const replaced = applyTool(partOf(kept.clip), only(at(0, 0)), 'strumUp');
    expect(replaced.bars[0].columns[0].extra).toBeUndefined();
    expect(notesOf(replaced)).toMatch(/^\(0\.1 1\.2 0\.3 2\.4 3\.5\)\.4\{bu\} /);
  });

  it('leaves rests as they are', () => {
    const clip = applyTool(partFrom(`r.4 ${C}.4 r.2 |`), { cursor: at(0, 0), selection: { anchor: 0, focus: 2 } }, 'strumDown');
    expect(clip.bars[0].columns.map(c => c.roll?.sign)).toEqual([undefined, 'strum', undefined]);
  });

  it('lights only the button for the sign the cursor column has', () => {
    const clip = partFrom(`${C}.4{bd} r.4 r.2 |`);
    expect(isOn(clip, at(0, 0), 'strumDown')).toBe(true);
    for (const id of ['strumUp', 'rolledDown', 'rolledUp'] as const) expect(isOn(clip, at(0, 0), id)).toBe(false);
  });
});

describe('the sign', () => {
  it('points up for a roll down, down for a roll up', () => {
    // The arrowhead's tip is its path's first point.
    expect(rollSign({ sign: 'strum', direction: 'down' }, 10, 0, 40).head).toMatch(/^M10 0 /);
    expect(rollSign({ sign: 'rolled', direction: 'up' }, 10, 0, 40).head).toMatch(/^M10 40 /);
  });

  it('is straight for a Strum, wavy for a Rolled chord', () => {
    expect(rollSign({ sign: 'strum', direction: 'down' }, 10, 0, 40).line).not.toContain('Q');
    expect(rollSign({ sign: 'rolled', direction: 'down' }, 10, 0, 40).line).toContain('Q');
  });

  it('is 20 long beside one note', () => {
    const clip = partFrom('5.3.4{bd} r.4 r.2 |');
    const system = layoutClip(clip, WIDTH).systems[0];
    const place = tabRollPlace(system.bars[0].columns[0], system.rows)!;
    expect(place.bottom - place.top).toBe(20);
  });

  it('makes its column 14 wider, its notes 14 further right, in Tab and Both view', () => {
    for (const parts of ['tab', 'both'] as const) {
      const plain = layoutClip(partFrom(`r.4 ${C}.4 r.2 |`), WIDTH, parts).systems[0].bars[0].columns[1];
      const signed = layoutClip(partFrom(`r.4 ${C}.4{bd} r.2 |`), WIDTH, parts).systems[0].bars[0].columns[1];
      expect(signed.x - signed.start).toBeCloseTo(plain.x - plain.start + 14);
    }
  });
});

describe('picking', () => {
  const pickedFrom = (clip: Part, parts: 'tab' | 'both', on?: 'staff'): MarkHit => {
    const layout = layoutClip(clip, WIDTH, parts);
    const found = markBoxes(layout).find(m => m.hit.mark === 'roll' && m.hit.on === on)!;
    const hit = markAt(layout, found.box.x + found.box.width / 2, found.box.y + found.box.height / 2);
    expect(hit).toEqual(found.hit);
    return hit!;
  };

  it('picks the sign on the tab and on the staff, names its button, and Delete takes it away', () => {
    const clip = partFrom(`r.4 ${C}.4{au} r.2 |`);
    const onTab = pickedFrom(clip, 'tab');
    expect(onTab).toEqual({ kind: 'mark', mark: 'roll', index: 1, string: null });
    expect(markTool(clip, onTab)).toBe('rolledUp');
    expect(removeMark(clip, onTab).bars[0].columns[1].roll).toBeUndefined();
    const onStaff = pickedFrom(clip, 'both', 'staff');
    expect(onStaff).toMatchObject({ mark: 'roll', index: 1, on: 'staff' });
    expect(removeMark(clip, onStaff).bars[0].columns[1].roll).toBeUndefined();
  });

  it('is drawn on the staff left of the heads', () => {
    const layout = layoutClip(partFrom(`r.4 ${C}.4{bd} r.2 |`), WIDTH, 'staff');
    const sign = staffMarks(layout)[0].find(m => m.kind === 'roll')!;
    expect(sign.kind === 'roll' && sign.x).toBeLessThan(layout.systems[0].bars[0].columns[1].x - 6);
  });
});

it('goes with the notes when they are deleted', () => {
  expect(restOf(partFrom(`${C}.4{bd} r.4 r.2 |`).bars[0].columns[0]).roll).toBeUndefined();
});

it('is an arpeggio on each note of the chord in MusicXML, up for a roll down', () => {
  const xml = writeMusicXml(clipOf(`${C}.4{bd} ${C}.4{au} r.2 |`));
  expect(xml.match(/<arpeggiate direction="up"\/>/g)).toHaveLength(5);
  expect(xml.match(/<arpeggiate direction="down"\/>/g)).toHaveLength(5);
});
