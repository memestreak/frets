import { readAscii } from '@/features/tab/ascii';
import { BEND_LABEL_RAISE, BEND_RISE, columnWidth, layoutClip, lineAt, rowsFor, stepY } from '@/features/tab/layout';
import { boundaryAt, columnAt, hitTest, staffAt } from '@/features/tab/hitTest';
import { textAt } from '@/features/tab/layoutText';
import { runAt } from '@/features/tab/runs';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';

function clipOf(text: string): Clip {
  const result = readAscii(text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

/** Eight bars of eighth notes on the low E. */
const LONG = clipOf(
  ['e', 'B', 'G', 'D', 'A', 'E']
    .map(n => `${n}|${`${n === 'E' ? '-0-0-0-0-0-0-0-0-' : '-----------------'}|`.repeat(8)}`)
    .join('\n'),
);

describe('layoutClip', () => {
  it('keeps every bar on one line when there is room', () => {
    const layout = layoutClip(LONG, 10_000);
    expect(layout.systems).toHaveLength(1);
    expect(layout.systems[0].bars).toHaveLength(8);
  });

  it('wraps bars onto new lines, never splitting one, all within the width', () => {
    const layout = layoutClip(LONG, 600);
    expect(layout.systems.length).toBeGreaterThan(1);
    expect(layout.systems.flatMap(s => s.bars.map(b => b.index))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const system of layout.systems) {
      expect(system.bars[system.bars.length - 1].x1).toBeLessThanOrEqual(600);
    }
  });

  it('puts the time signature in front of the first line of tab, starts every line under the first, and "TAB" on the lines before the bars', () => {
    const layout = layoutClip(LONG, 600);
    const [first, ...rest] = layout.systems;
    expect(first.timeX).toBeGreaterThan(0);
    expect(first.timeX!).toBeLessThan(first.lineStart);
    for (const system of rest) {
      expect(system.timeX).toBeNull();
      expect(system.lineStart).toBe(first.lineStart);
      expect(system.staffStart).toBe(first.staffStart);
    }
    for (const system of layout.systems) {
      expect(system.bars[0].x0).toBe(system.staffStart);
      expect(system.staffStart).toBeGreaterThan(system.lineStart);
    }
  });

  it('squeezes a bar wider than a whole line to fit', () => {
    const layout = layoutClip(LONG, 300);
    for (const system of layout.systems) {
      expect(system.bars).toHaveLength(1);
      expect(system.bars[0].x1).toBeLessThanOrEqual(300);
    }
  });

  it('places columns left to right inside their bar', () => {
    const [bar] = layoutClip(LONG, 10_000).systems[0].bars;
    const xs = bar.columns.map(c => c.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(xs[0]).toBeGreaterThan(bar.x0);
    expect(xs[xs.length - 1]).toBeLessThan(bar.x1);
  });

  it('gives longer notes more room', () => {
    const [eighth] = LONG.bars[0].columns;
    const half = { ...eighth, duration: { ...eighth.duration, value: 2 as const } };
    expect(columnWidth(half)).toBeGreaterThan(columnWidth(eighth));
  });

  it('leaves no room for string names in any tuning: the score head shows the tuning', () => {
    const dropD = layoutClip({ ...LONG, tuning: ['D', 'A', 'D', 'G', 'B', 'E'] }, 800);
    expect(dropD.systems.map(s => s.lineStart)).toEqual(layoutClip(LONG, 800).systems.map(s => s.lineStart));
  });
});

describe('rowsFor', () => {
  const rowsOf = (tex: string) => {
    const result = readAlphaTexWith(alphaTab, tex);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    return rowsFor(result.clip);
  };

  it('has no rows above the staff for plain notes, only room for bends', () => {
    const rows = rowsOf('5.3.4 7.3{b (0 4)}.4 r.2 |');
    expect([rows.endings, rows.strokes, rows.letRing, rows.palmMute, rows.harmonics, rows.vibrato, rows.accents]).toEqual([null, null, null, null, null, null, null]);
    // The bend's label sits where a first row would, FIRST_ROW (12), over its arrow.
    expect(rows.staffTop).toBe(12 + BEND_LABEL_RAISE + BEND_RISE);
  });

  it('gives each mark the clip uses a row of its own, in order, and moves the staff down for them', () => {
    const rows = rowsOf('5.3{pm ac}.4{sd} 7.3{lr v}.4 r.2 |');
    expect(rows.endings).toBeNull();
    expect(rows.harmonics).toBeNull();
    const used = [rows.strokes!, rows.letRing!, rows.palmMute!, rows.vibrato!, rows.accents!];
    expect(used).toEqual([...used].sort((a, b) => a - b));
    expect(new Set(used).size).toBe(used.length);
    expect(rows.staffTop).toBeGreaterThan(rows.accents! + 10);
    expect(rows.height).toBe(rows.staffBottom + 54);
  });
});

describe('pressing the drawing', () => {
  const clipOf = (tex: string) => {
    const result = readAlphaTexWith(alphaTab, tex);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    return result.clip;
  };
  const layout = layoutClip(clipOf('0.6{pm}.8 0.6{pm}.8 0.6.4 r.2 |'), 800);
  const { rows } = layout.systems[0];
  const [first, second] = layout.systems[0].bars[0].columns;

  it('lands on the staff only, not over or under it or past the last bar', () => {
    expect(hitTest(layout, first.x, rows.staffTop)).toEqual({ bar: 0, column: 0, string: 0 });
    expect(hitTest(layout, first.x, rows.palmMute!)).toBeNull();
    expect(hitTest(layout, first.x, rows.stemBottom)).toBeNull();
    expect(hitTest(layout, layout.systems[0].bars[0].x1 + 20, rows.staffTop)).toBeNull();
  });

  it('finds the column pressed above or below the staff, else the next one, for the playback line', () => {
    expect(columnAt(layout, second.x + 2, rows.stemBottom)).toBe(1);
    expect(columnAt(layout, first.x, 0)).toBe(0);
    expect(columnAt(layout, first.x - 10, 0)).toBe(0);
    // Left of the first bar, over the time signature or the clef: in front of the first column.
    expect(columnAt(layout, 2, 0)).toBe(0);
    expect(columnAt(layout, 2, rows.stemBottom)).toBe(0);
    // Past a note: the next one, even nearer the note just passed.
    expect(columnAt(layout, first.x + (second.x - first.x) / 3, 0)).toBe(1);
    // Past the last column of the clip: the last.
    const bar = layout.systems[0].bars[0];
    expect(columnAt(layout, bar.x1 - 1, 0)).toBe(bar.columns[bar.columns.length - 1].index);
    expect(columnAt(layout, layout.systems[0].bars[0].x1 + 20, rows.stemBottom)).toBeNull();
  });

  it('in Both, leaves the gap between the staff and the tab to the playback line', () => {
    const both = layoutClip(clipOf('0.1.4 2.1.4 |'), 800, 'both');
    const x = both.systems[0].bars[0].columns[0].x;
    const gap = (both.systems[0].rows.score!.bottom + both.systems[0].rows.staffTop) / 2;
    expect(staffAt(both, x, gap)).toBeNull();
    expect(hitTest(both, x, gap)).toBeNull();
    expect(columnAt(both, x, gap)).toBe(0);
    // But a head drawn down there, on ledger lines (the open low E), is still pressed (Jeremy, 2026-10-28).
    const low = layoutClip(clipOf('0.6.4 2.6.4 |'), 800, 'both');
    const head = low.systems[0].bars[0].columns[0].heads[0];
    expect(staffAt(low, x, stepY(low.systems[0].rows.score!, head.step))).toMatchObject({ bar: 0, column: 0, string: 5 });
  });

  it('finds the P.M. run under a press on its label or line', () => {
    const hit = runAt(layout, first.x, rows.palmMute!);
    expect(hit?.mark).toBe('palmMute');
    expect(hit?.run.columns).toEqual([first, second]);
    expect(runAt(layout, first.x, rows.staffTop)).toBeNull();
  });
});

describe('words over the tab', () => {
  const clipOf = (tex: string) => {
    const result = readAlphaTexWith(alphaTab, tex);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    return result.clip;
  };

  it('gives tempos, sections and chord names rows of their own, over the endings and strokes', () => {
    const rows = rowsFor(clipOf('\\section "A" \\tempo 90 \\ae 1 0.1.2{ch "C" sd} 0.1.2 |'));
    expect([rows.tempo!, rows.section!, rows.endings!, rows.chords!, rows.strokes!]).toEqual(
      [rows.tempo!, rows.section!, rows.endings!, rows.chords!, rows.strokes!].sort((a, b) => a - b),
    );
  });

  it('finds the chord name, section or tempo under a press', () => {
    const layout = layoutClip(clipOf('\\section "Verse" \\tempo 90 0.1.2{ch "Am"} 0.1.2 |'), 800);
    const { rows } = layout.systems[0];
    const bar = layout.systems[0].bars[0];
    expect(textAt(layout, bar.columns[0].x, rows.chords!)).toEqual({ kind: 'chord', index: 0 });
    expect(textAt(layout, bar.columns[1].x, rows.chords!)).toBeNull();
    expect(textAt(layout, bar.x0 + 10, rows.section!)).toEqual({ kind: 'section', bar: 0 });
    expect(textAt(layout, bar.x0 + 10, rows.tempo!)).toEqual({ kind: 'tempo', bar: 0 });
    expect(textAt(layout, bar.x0 + 10, rows.staffTop)).toBeNull();
  });
});

describe('ending brackets and gaps', () => {
  const tex = (t: string) => {
    const r = readAlphaTexWith(alphaTab, t);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    return r.clip;
  };

  it('picks a drawn ending bracket by its line, as its run\'s first bar on that line', () => {
    const layout = layoutClip(tex('\\ro 0.6.1 | \\ae 1 \\rc 2 3.6.1 | \\ae 2 3.6.1 | \\ae 2 5.6.1 |'), 900);
    const { rows } = layout.systems[0];
    const [, b1, b2, b3] = layout.systems[0].bars;
    expect(textAt(layout, b1.x0 + 20, rows.endings!)).toEqual({ kind: 'ending', bar: 1 });
    expect(textAt(layout, b3.x0 + 20, rows.endings!)).toEqual({ kind: 'ending', bar: 2 });
    expect(textAt(layout, b2.x0 + 20, rows.staffTop)).toBeNull();
  });

  it('gives the gap after the clip\'s last column as the column count', () => {
    const layout = layoutClip(tex('0.6.4 2.6.4 |'), 600);
    const bar = layout.systems[0].bars[0];
    expect(boundaryAt(layout, bar.x1 - 1, 0)).toBe(2);
    expect(columnAt(layout, bar.x1 - 1, 0)).toBe(1);
  });
});


describe('each line\'s own rows', () => {
  const clipOf = (tex: string) => {
    const r = readAlphaTexWith(alphaTab, tex);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    return r.clip;
  };
  // Chord names on the first line only, a bend on the second only: four bars of four quarters a line at 600.
  const bars = (n: number, body: string) => Array.from({ length: n }, () => body).join(' ');
  const clip = clipOf(`${bars(4, '5.3{ch "C"}.4 5.3.4 5.3.4 5.3.4 |')} ${bars(4, '5.3.4 7.3{b (0 4)}.4 5.3.4 5.3.4 |')}`);
  const layout = layoutClip(clip, 600);

  it('leaves no room on a line for what only another line draws (Jeremy, 2026-10-28)', () => {
    expect(layout.systems.length).toBeGreaterThan(1);
    const [first] = layout.systems;
    const last = layout.systems[layout.systems.length - 1];
    expect(first.bars[0].bar.columns[0].chord).toBe('C');
    expect(first.rows.chords).not.toBeNull();
    expect(last.rows.chords).toBeNull();
    // The first line has chord names and no bends: the tab sits right under the names.
    expect(first.rows.staffTop - first.rows.chords!).toBeLessThanOrEqual(18);
    // The last has bends and no names: room for the arrow and its label only.
    expect(last.rows.staffTop).toBe(12 + BEND_LABEL_RAISE + BEND_RISE);
  });

  it('stacks the lines one under another, and finds each by its y', () => {
    let top = 0;
    layout.systems.forEach((system, si) => {
      expect(system.top).toBe(top);
      expect(lineAt(layout, top + system.rows.staffTop)).toMatchObject({ si, localY: system.rows.staffTop });
      top += system.rows.height;
    });
    expect(layout.height).toBe(top);
    expect(lineAt(layout, -1)).toBeNull();
    expect(lineAt(layout, layout.height)).toBeNull();
  });

  it('puts the capo over the first line only', () => {
    const capo = layoutClip({ ...clip, capo: 2 }, 600);
    expect(capo.systems[0].rows.capo).not.toBeNull();
    expect(capo.systems[1].rows.capo).toBeNull();
  });
});
