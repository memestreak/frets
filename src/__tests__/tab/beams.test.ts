/*
 * Beat groups and Beam overrides (step 7, `docs/specs/2026-11-04-tab-beat-groups-beams-design.md`): which
 * notes a beam joins in each meter, a time signature's own Beat groups and what they re-write, Break
 * before and Join to previous, and how both are read and written. The page's field, tools and menu are in
 * `page/beams.test.tsx`.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { setBeatGroups } from '@/features/tab/barEdits';
import { beamGroups } from '@/features/tab/beams';
import { partOf, WHOLE, withPart, type Clip, type Part } from '@/features/tab/clip';
import { clipAction } from '@/features/tab/clipState';
import { insertTime, type Target } from '@/features/tab/editing';
import { writeGuitarProWith } from '@/features/tab/guitarPro';
import { layoutClip } from '@/features/tab/layout';
import { writeMusicXml } from '@/features/tab/musicxml';
import { beamLit, canBeamTarget, cycleDots, setBeam, setValue } from '@/features/tab/noteEdits';
import { reBarEnd } from '@/features/tab/timeline';
import { writeBars } from '@/features/tab/alphatex';
import { stepFrets } from '@/features/tab/normalMode';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const partFrom = (text: string) => partOf(clipOf(text));

/** Each bar's beams as the number of notes under each, in order. */
function beamSizes(part: Part): number[][] {
  return layoutClip(part, 2000, 'tab').systems.flatMap(s => s.bars).map(bar => beamGroups(bar).filter(g => g.columns.length > 1).map(g => g.columns.length));
}

/** A Target on Column `column` of bar `bar`, or a selection over Columns `from`…`to` (counted through the Part). */
const at = (bar: number, column: number, string = 0): Target => ({ cursor: { bar, column, string }, selection: null });
const over = (from: number, to: number): Target => ({ cursor: { bar: 0, column: from, string: 0 }, selection: { anchor: from, focus: to } });

const SEVEN = '0.3.8 0.3.8 0.3.8 0.3.8 0.3.8 0.3.8 0.3.8 |';

describe('automatic beams (spec Q1)', () => {
  it('follow the Beat groups in meters counted in eighths: 7/8 2+2+3, 5/8 3+2, 6/8 3+3', () => {
    expect(beamSizes(partFrom(`\\ts (7 8) ${SEVEN}`))).toEqual([[2, 2, 3]]);
    expect(beamSizes(partFrom('\\ts (5 8) 0.3.8 0.3.8 0.3.8 0.3.8 0.3.8 |'))).toEqual([[3, 2]]);
    expect(beamSizes(partFrom('\\ts (6 8) 0.3.8 0.3.8 0.3.8 0.3.8 0.3.8 0.3.8 |'))).toEqual([[3, 3]]);
  });

  it('beam fourteen sixteenths in 7/8 in fours, fours and six', () => {
    expect(beamSizes(partFrom(`\\ts (7 8) ${'0.3.16 '.repeat(14)}|`))).toEqual([[4, 4, 6]]);
  });

  it('keep 4/4 eighths in two fours, 3/4 and 2/4 eighths in pairs, 4/4 sixteenths by the beat', () => {
    expect(beamSizes(partFrom(`\\ts (4 4) ${'0.3.8 '.repeat(8)}|`))).toEqual([[4, 4]]);
    expect(beamSizes(partFrom(`\\ts (3 4) ${'0.3.8 '.repeat(6)}|`))).toEqual([[2, 2, 2]]);
    expect(beamSizes(partFrom(`\\ts (2 4) ${'0.3.8 '.repeat(4)}|`))).toEqual([[2, 2]]);
    expect(beamSizes(partFrom(`\\ts (4 4) ${'0.3.16 '.repeat(16)}|`))).toEqual([[4, 4, 4, 4]]);
  });
});

describe('Beat groups of a time signature (spec Q4, Q5, Q6)', () => {
  /** The clip after the Beat groups field at bar `bar` of track 1 is set, re-written as the page does. */
  function grouped(clip: Clip, bar: number, counts: number[] | null): Clip {
    const part = setBeatGroups(partOf(clip), bar, counts);
    const action = clipAction(clip, { type: 'reBarPart', part, from: bar, to: reBarEnd(part, bar) });
    if (action.type !== 'replace') throw new Error('not replaced');
    return action.clip;
  }

  it('3+2+2 on bar 1 beams every 7/8 bar to the next time signature that way, and writes \\beaming', () => {
    const clip = grouped(clipOf(`\\ts (7 8) ${SEVEN} ${SEVEN} \\ts (4 4) ${'0.3.8 '.repeat(8)}|`), 0, [3, 2, 2]);
    expect(beamSizes(partOf(clip))).toEqual([[3, 2, 2], [3, 2, 2], [4, 4]]);
    expect(writeAlphaTex(clip)).toContain('\\ts (7 8)\n\\beaming (8 3 2 2)');
  });

  it('the default again takes the grouping and its \\beaming away', () => {
    const clip = grouped(grouped(clipOf(`\\ts (7 8) ${SEVEN}`), 0, [3, 2, 2]), 0, null);
    expect(writeAlphaTex(clip)).not.toContain('\\beaming');
    expect(beamSizes(partOf(clip))).toEqual([[2, 2, 3]]);
  });

  it('on a later bar it is a 7/8 time signature change there, and setting the groups before takes it away', () => {
    const text = `\\ts (7 8) ${SEVEN} ${SEVEN} ${SEVEN} ${SEVEN}`;
    const clip = grouped(clipOf(text), 2, [3, 2, 2]);
    expect(clip.masterBars[2]).toMatchObject({ time: { beats: 7, value: 8 }, beatGroups: [3, 2, 2] });
    expect(beamSizes(partOf(clip))).toEqual([[2, 2, 3], [2, 2, 3], [3, 2, 2], [3, 2, 2]]);
    const back = grouped(clip, 2, null);
    expect(back.masterBars[2].time).toBeUndefined();
    expect(writeAlphaTex(back)).toBe(writeAlphaTex(clipOf(text)));
  });

  it('a quarter on the third eighth of 7/8 is one quarter in 2+2+3 and two tied eighths in 3+2+2, in every Track', () => {
    const bar = '0.3.8 0.3.8 0.3.4 0.3.8 0.3.8 0.3.8 |';
    const clip = clipOf(`\\ts (7 8) \\track "A" ${bar} \\track "B" ${bar}`);
    const after = grouped(clip, 0, [3, 2, 2]);
    for (const t of [0, 1]) {
      expect(writeBars(partOf(clip, t))).toEqual(['0.3.8 0.3.8 0.3.4 0.3.8 0.3.8 0.3.8 |']);
      expect(writeBars(partOf(after, t))).toEqual(['\\beaming (8 3 2 2) 0.3.8 0.3.8 0.3.8 -.3.8 0.3.8 0.3.8 0.3.8 |']);
    }
  });

  it('a time signature after one with its own groups writes its default \\beaming, and reads back the same', () => {
    const clip = grouped(clipOf(`\\ts (7 8) ${SEVEN} \\ts (4 4) r.1 |`), 0, [3, 2, 2]);
    const text = writeAlphaTex(clip);
    expect(text).toContain('\\ts (4 4) \\beaming (8 4 4)');
    expect(writeAlphaTex(clipOf(text))).toBe(text);
  });

  it('reads \\beaming (16 6 4 4) in 7/8 as 3+2+2; keeps \\beaming (8 2 2 2), which does not add up, as written', () => {
    const fine = clipOf(`\\ts (7 8) \\beaming (16 6 4 4) ${SEVEN}`);
    expect(fine.masterBars[0].beatGroups).toEqual([3, 2, 2]);
    expect(beamSizes(partOf(fine))).toEqual([[3, 2, 2]]);
    const read = readAlphaTexWith(alphaTab, `\\ts (7 8) \\beaming (8 2 2 2) ${SEVEN}`);
    if (!read.ok) throw new Error('not read');
    expect(read.clip.masterBars[0].beatGroups).toBeUndefined();
    expect(beamSizes(partOf(read.clip))).toEqual([[2, 2, 3]]);
    expect(writeAlphaTex(read.clip)).toContain('\\beaming (8 2 2 2)');
    expect(read.warnings.join(' ')).toContain('\\beaming');
  });
});

describe('Beam overrides (spec Q7, Q10, Q11, Q12)', () => {
  const HALF = '\\ts (4 4) 0.3.8 0.3.8 0.3.8 0.3.8 r.2 |';
  const THREE = '\\ts (3 4) 0.3.8 0.3.8 0.3.8 0.3.8 r.4 |';

  it('Break on the third of four eighths in a half bar draws two beams of two and writes {beam split} on the second', () => {
    const part = setBeam(partFrom(HALF), at(0, 2), 'break');
    expect(beamSizes(part)).toEqual([[2, 2]]);
    expect(writeBars(part)).toEqual(['0.3.8 0.3.8{beam split} 0.3.8 0.3.8 r.2 |']);
  });

  it('Join on the first eighth of beat 2 in 3/4 joins it to beat 1 and writes {beam merge} on the note before', () => {
    const part = setBeam(partFrom(THREE), at(0, 2), 'join');
    expect(beamSizes(part)).toEqual([[4]]);
    expect(writeBars(part)).toEqual(['0.3.8 0.3.8{beam merge} 0.3.8 0.3.8 r.4 |']);
    // Read back, it is the same override.
    expect(partFrom(`\\ts (3 4) ${writeBars(part)[0]}`).bars[0].columns[2].beam).toBe('join');
  });

  it('do nothing after a rest, after a grace note, on a bar\'s first note, or on a quarter', () => {
    const cases: [string, number][] = [
      ['\\ts (4 4) 0.3.8 r.8 0.3.8 0.3.8 r.2 |', 2],
      ['\\ts (4 4) 0.3.8 2.3.8{gr} 0.3.8 0.3.8 0.3.8 r.2 |', 2],
      ['\\ts (4 4) 0.3.8 0.3.8 r.4 r.2 |', 0],
      ['\\ts (4 4) 0.3.8 0.3.4 0.3.8 r.2 |', 1],
    ];
    for (const [text, column] of cases) {
      const part = partFrom(text);
      for (const kind of ['break', 'join'] as const) {
        expect(setBeam(part, at(0, column), kind)).toBe(part);
        expect(beamLit(part, at(0, column), kind)).toBe(false);
        expect(canBeamTarget(part, at(0, column), kind)).toBe(false);
      }
    }
  });

  it('light for the note\'s own override; the lit one again is Automatic, the other switches', () => {
    const part = partFrom(HALF);
    const broken = setBeam(part, at(0, 2), 'break');
    expect(beamLit(broken, at(0, 2), 'break')).toBe(true);
    expect(beamLit(broken, at(0, 2), 'join')).toBe(false);
    expect(setBeam(broken, at(0, 2), 'break').bars[0].columns[2].beam).toBeUndefined();
    expect(setBeam(broken, at(0, 2), 'join').bars[0].columns[2].beam).toBe('join');
  });

  it('on a selection: Join beams four eighths across beats 1 and 2 of 3/4 as one, Break unbeams them, lit again is Automatic', () => {
    const part = partFrom(THREE);
    const joined = setBeam(part, over(0, 3), 'join');
    expect(beamSizes(joined)).toEqual([[4]]);
    expect(joined.bars[0].columns.map(c => c.beam)).toEqual([undefined, 'join', 'join', 'join', undefined]);
    expect(beamLit(joined, over(0, 3), 'join')).toBe(true);
    expect(setBeam(joined, over(0, 3), 'join').bars[0].columns.every(c => c.beam === undefined)).toBe(true);
    const broken = setBeam(part, over(0, 3), 'break');
    expect(beamSizes(broken)).toEqual([[]]);
    expect(setBeam(broken, over(0, 3), 'break').bars[0].columns.every(c => c.beam === undefined)).toBe(true);
  });

  it('survive a fret change, Insert before them, a grouping change, and copy and paste', () => {
    const part = setBeam(partFrom(THREE), at(0, 2), 'join');
    expect(stepFrets(part, [{ bar: 0, column: 2, string: 2 }], 1).bars[0].columns[2].beam).toBe('join');
    const inserted = insertTime(part, 0, WHOLE / 4, { bar: 0, column: 0, string: 2 })!;
    expect(writeBars(inserted.clip).join(' ')).toContain('{beam merge}');
    const regrouped = setBeatGroups(part, 0, [2, 1]);
    expect(regrouped.bars[0].columns[2].beam).toBe('join');
    // Copy and paste carry the alphaTex: read back, the override is there.
    expect(partFrom(`\\ts (3 4) ${writeBars(part)[0]}`).bars[0].columns[2].beam).toBe('join');
  });

  it('drop when the note\'s length or dot changes, and when it is written over; deleting the note before keeps it', () => {
    const part = setBeam(partFrom(THREE), at(0, 2), 'join');
    expect(setValue(part, at(0, 2, 2), 16).bars[0].columns[2].beam).toBeUndefined();
    const dotted = cycleDots(part, at(0, 2, 2));
    expect(dotted.bars[0].columns.some(c => c.beam)).toBe(false);
    // Written over by the note before made a quarter.
    expect(setValue(part, at(0, 1, 2), 4).bars[0].columns.some(c => c.beam)).toBe(false);
    const gone = { ...part, bars: [{ ...part.bars[0], columns: part.bars[0].columns.map((c, k) => (k === 1 ? { ...c, notes: c.notes.map(() => null) } : c)) }] };
    expect(gone.bars[0].columns[2].beam).toBe('join');
    expect(beamSizes(gone)).toEqual([[2]]);
  });
});

describe('exports', () => {
  it('MusicXML beams a 2+2+3 bar of 7/8, and a Break and a Join, as drawn', () => {
    // Each bar is written on the staff and on the tab: half the beams are each's.
    const begins = (xml: string) => (xml.match(/<beam number="1">begin<\/beam>/g) ?? []).length / 2;
    const seven = writeMusicXml(clipOf(`\\ts (7 8) ${SEVEN}`));
    expect(begins(seven)).toBe(3);
    expect(seven).toContain('<beats>7</beats>');
    const clip = clipOf('\\ts (3 4) 0.3.8 0.3.8{beam merge} 0.3.8 0.3.8 r.4 | \\ts (4 4) 0.3.8 0.3.8{beam split} 0.3.8 0.3.8 r.2 |');
    const xml = writeMusicXml(clip);
    const measures = xml.split('<measure ').slice(1);
    expect(begins(measures[0])).toBe(1);
    expect(begins(measures[1])).toBe(2);
  });

  it('Guitar Pro writes the bar\'s beam groups and the beats\' beaming', () => {
    const clip = clipOf(`\\ts (7 8) \\beaming (8 3 2 2) 0.3.8 0.3.8 0.3.8{beam merge} 0.3.8 0.3.8 0.3.8 0.3.8 |`);
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(writeGuitarProWith(alphaTab, clip), new alphaTab.Settings());
    expect([...score.masterBars[0].beamingRules!.groups.values()][0]).toEqual([3, 2, 2]);
    expect(score.tracks[0].staves[0].bars[0].voices[0].beats[2].beamingMode).toBe(alphaTab.model.BeatBeamingMode.ForceMergeWithNext);
  });
});

describe('Beat groups read with their Part (spec Q6)', () => {
  it('belong to the bar every Track shares', () => {
    const clip = clipOf(`\\ts (7 8) \\beaming (8 3 2 2) \\track "A" ${SEVEN} \\track "B" ${SEVEN}`);
    expect(clip.masterBars[0].beatGroups).toEqual([3, 2, 2]);
    expect(clip.tracks.every(t => !t.bars[0].extra)).toBe(true);
    expect(withPart(clip, partOf(clip, 1), 1).masterBars[0].beatGroups).toEqual([3, 2, 2]);
  });
});
