/**
 * Dynamics (issue #437, `docs/specs/2026-11-09-tab-dynamics-design.md`): read from and written as alphaTex
 * `dy`, laid out on the hairpins' row, picked as a Mark, kept on a rest, and exported to MusicXML.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { dynamicOf, partOf, type Clip, type Part } from '@/features/tab/clip';
import { drawnDynamics, dynamicWord, hairpinSpan } from '@/features/tab/dynamics';
import { restOf } from '@/features/tab/editing';
import { layoutClip } from '@/features/tab/layout';
import { markBoxes, markTool } from '@/features/tab/marks';
import { removeMark } from '@/features/tab/noteEdits';
import { columnRuns } from '@/features/tab/runs';
import { writeMusicXml } from '@/features/tab/musicxml';
import { setDynamic } from '@/features/tab/barEdits';

function read(tex: string) {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result;
}
const clipOf = (tex: string): Clip => read(tex).clip;
const partFrom = (tex: string): Part => partOf(clipOf(tex));
const firstColumns = (tex: string) => clipOf(tex).tracks[0].bars[0].voices[0];

describe('reading and writing dy', () => {
  it('reads {dy mf} as the column\'s dynamic, with no kept warning', () => {
    const result = read('5.3.4{dy mf} 5.3.4 5.3.2 |');
    expect(result.clip.tracks[0].bars[0].voices[0][0].dynamic).toBe('mf');
    expect(result.clip.tracks[0].bars[0].voices[0][0].extra).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it('reads {dy FF} as ff', () => {
    expect(firstColumns('5.3.4{dy FF} 5.3.4 5.3.2 |')[0].dynamic).toBe('ff');
  });

  it('keeps {dy n} and two dy on one beat as written', () => {
    const niente = firstColumns('5.3.4{dy n} 5.3.4 5.3.2 |')[0];
    expect(niente.dynamic).toBeUndefined();
    expect(niente.extra).toEqual(['dy n']);
    const two = firstColumns('5.3.4{dy p dy f} 5.3.4 5.3.2 |')[0];
    expect(two.dynamic).toBeUndefined();
    expect(two.extra).toEqual(['dy p', 'dy f']);
  });

  it('writes the dynamic after a hairpin, and reads it back the same', () => {
    const tex = '\\ts (4 4)\n5.3.4{cre dy mf} 5.3.4{cre} 5.3.4{dy sfz} r.4 |\n';
    const written = writeAlphaTex(clipOf(tex));
    expect(written).toBe(tex);
    expect(writeAlphaTex(clipOf(written))).toBe(tex);
  });
});

describe('dynamicOf', () => {
  it('takes any case and spaces round it, and nothing that isn\'t a dynamic', () => {
    expect(dynamicOf(' MF ')).toBe('mf');
    expect(dynamicOf('sfz')).toBe('sfz');
    expect(dynamicOf('mm')).toBeNull();
    expect(dynamicOf('n')).toBeNull();
    expect(dynamicOf('')).toBeNull();
  });
});

describe('where a dynamic is drawn', () => {
  const tex = '\\ts (4 4)\n5.3.4{dy p} 5.3.4 5.3.2 |';

  it('takes the hairpins\' row: over the tab in Tab view', () => {
    const { rows } = layoutClip(partFrom(tex), 800, 'tab').systems[0];
    expect(rows.dynamics).not.toBeNull();
    expect(rows.dynamics).toBe(rows.hairpins);
    expect(rows.dynamics!).toBeLessThan(rows.staffTop);
  });

  it('under the staff in Staff and Both views', () => {
    for (const parts of ['staff', 'both'] as const) {
      const { rows } = layoutClip(partFrom(tex), 800, parts).systems[0];
      expect(rows.dynamics!).toBeGreaterThan(rows.score!.bottom);
      if (parts === 'both') expect(rows.dynamics!).toBeLessThan(rows.staffTop);
    }
  });

  it('has no row on a line without dynamics or hairpins', () => {
    const { rows } = layoutClip(partFrom('\\ts (4 4)\n5.3.4 5.3.4 5.3.2 |'), 800, 'tab').systems[0];
    expect(rows.dynamics).toBeNull();
    expect(rows.hairpins).toBeNull();
  });

  it('starts a hairpin on a dynamic\'s column right of its letters', () => {
    const system = layoutClip(partFrom('\\ts (4 4)\n5.3.4{dy p cre} 5.3.4{cre} 5.3.2{dy f} |'), 800, 'tab').systems[0];
    const y = system.rows.hairpins!;
    const [run] = columnRuns(system, c => c.hairpin ?? null);
    const { x0, x1 } = hairpinSpan(system, run, y);
    const p = dynamicWord('p', run.from.x, y).box;
    expect(x0).toBeGreaterThan(p.x + p.width);
    const next = system.bars[0].columns[2];
    expect(x1).toBeLessThan(dynamicWord('f', next.x, y).box.x);
  });

  it('draws wider dynamics wider, centred on the column', () => {
    const p = dynamicWord('p', 100, 0).box;
    const fff = dynamicWord('fff', 100, 0).box;
    expect(fff.width).toBeGreaterThan(p.width);
    expect(p.x + p.width / 2).toBeCloseTo(100);
    expect(fff.x + fff.width / 2).toBeCloseTo(100);
  });
});

describe('dynamics of two Voices', () => {
  const twoVoices = (second: string) => `\\ts (4 4)\n\\voice\n12.1.4{dy f} 10.1.4 8.1.2 |\n\\voice\n0.6.2{dy ${second}} 3.6.2 |`;

  it('draws the same dynamic at one time once, the part\'s own', () => {
    const system = layoutClip(partFrom(twoVoices('f')), 800, 'tab').systems[0];
    const drawn = drawnDynamics(system, system.rows.dynamics!);
    expect(drawn.map(d => [d.dynamic, d.own])).toEqual([['f', true]]);
  });

  it('stands two different ones side by side, the part\'s own first, clear of each other', () => {
    const system = layoutClip(partFrom(twoVoices('pp')), 800, 'tab').systems[0];
    const [f, pp] = drawnDynamics(system, system.rows.dynamics!);
    expect([f.dynamic, f.own, pp.dynamic, pp.own]).toEqual(['f', true, 'pp', false]);
    expect(pp.box.x).toBeGreaterThan(f.box.x + f.box.width);
    // Only the part's own is picked by a press.
    expect(markBoxes(layoutClip(partFrom(twoVoices('pp')), 800, 'tab')).filter(m => m.hit.mark === 'dynamic')).toHaveLength(1);
  });
});

describe('a dynamic picked and changed', () => {
  const tex = '\\ts (4 4)\n5.3.4 5.3.4{dy mf} 5.3.2 |';

  it('is a Mark a press picks, lighting the Dynamic tool, and Delete takes it away', () => {
    const part = partFrom(tex);
    const layout = layoutClip(part, 800, 'tab');
    const hit = markBoxes(layout).find(m => m.hit.mark === 'dynamic')!;
    expect(hit.hit).toMatchObject({ kind: 'mark', mark: 'dynamic', index: 1, string: null });
    expect(markTool(part, hit.hit)).toBe('dynamic');
    const removed = removeMark(part, hit.hit);
    expect(removed.bars[0].columns[1].dynamic).toBeUndefined();
    expect(removed.bars[0].columns[1].notes[2]).toEqual({ fret: 5 });
  });

  it('is set and cleared on the cursor\'s column', () => {
    const part = partFrom(tex);
    const set = setDynamic(part, { bar: 0, column: 0, string: 0 }, 'pp');
    expect(set.bars[0].columns[0].dynamic).toBe('pp');
    expect(setDynamic(set, { bar: 0, column: 1, string: 0 }, null).bars[0].columns[1].dynamic).toBeUndefined();
  });

  it('stays on the rest when its notes are deleted, as a chord name does', () => {
    const column = partFrom(tex).bars[0].columns[1];
    expect(restOf(column).dynamic).toBe('mf');
  });
});

describe('MusicXML', () => {
  it('writes <dynamics> under the staff, before a hairpin starting with it', () => {
    const xml = writeMusicXml(clipOf('\\ts (4 4)\n5.3.4{dy mf cre} 5.3.4{cre} 5.3.2 |'));
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const directions = [...doc.querySelectorAll('part > measure > direction')];
    expect(directions[0].getAttribute('placement')).toBe('below');
    expect(directions[0].querySelector('dynamics > mf')).not.toBeNull();
    expect(directions[1].querySelector('wedge')?.getAttribute('type')).toBe('crescendo');
  });
});
