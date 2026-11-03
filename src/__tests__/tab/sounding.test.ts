/**
 * Sounding notes: reading a Voice's Columns as the notes they sound, and writing them back by the
 * meter (`docs/specs/2026-11-03-tab-sounding-notes-design.md`, its `## Tests`).
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { isRest, partOf, WHOLE, type Column, type Part, type TimeSignature } from '@/features/tab/clip';
import { builtinsFrom } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { beatGroups, emptyBarRests, meterOf, readVoice, spell, writeVoice } from '@/features/tab/sounding';

const W = WHOLE;
const H = W / 2;
const Q = W / 4;
const E = W / 8;
const S = W / 16;

/** The first Track of an alphaTex text as a Part. */
function part(tex: string): Part {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

const LETTER: Record<number, string> = { 1: 'w', 2: 'h', 4: 'q', 8: 'e', 16: 's', 32: 't', 64: 'x' };

/** A bar's rhythm in the spec's shorthand: `~` a note tied on, `r` a rest, `g` a grace note, `/3` a triplet. */
function rhythm(columns: Column[]): string {
  return columns.map(c => [
    c.grace ? 'g' : '',
    c.notes.some(n => n?.tie) ? '~' : '',
    isRest(c) ? 'r' : '',
    LETTER[c.duration.value],
    '.'.repeat(c.duration.dots),
    c.duration.tuplet ? `/${c.duration.tuplet}` : '',
  ].join('')).join(' ');
}

/** Each bar of `tex` written back by the meter, in shorthand. */
function rewritten(tex: string): string[] {
  const p = part(tex);
  return writeVoice(p, readVoice(p)).bars.map(b => rhythm(b.columns));
}

/** The values a note or Gap from `from` for `length` ticks is written as, in shorthand. */
function spelled(time: TimeSignature, from: number, length: number, kind: 'note' | 'rest' = 'note'): string {
  return spell(meterOf(time), from, length, kind).map(d => `${LETTER[d.value]}${'.'.repeat(d.dots)}`).join(' ');
}

const T44 = { beats: 4, value: 4 } as const;
const T34 = { beats: 3, value: 4 } as const;
const T24 = { beats: 2, value: 4 } as const;
const T68 = { beats: 6, value: 8 } as const;
const T128 = { beats: 12, value: 8 } as const;
const T58 = { beats: 5, value: 8 } as const;
const T78 = { beats: 7, value: 8 } as const;

describe('reading Columns as Sounding notes', () => {
  it('reads a quarter tied to an eighth as one note a dotted quarter long', () => {
    const { notes } = readVoice(part('\\ts (4 4) 5.3.4 -.3.8 r.8 r.2 |'));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ voice: 0, string: 2, start: 0, length: Q + E });
    expect(notes[0].pieces.map(p => p.at)).toEqual([0, Q]);
  });

  it('reads a chain over a bar line as one note starting in the first bar', () => {
    const { notes } = readVoice(part('\\ts (4 4) r.2 r.4 5.3.4 | -.3.4 r.4 r.2 |'));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ start: 3 * Q, length: H });
  });

  it('reads a chord as one Sounding note per string, starting together, and rests as nothing', () => {
    const { notes } = readVoice(part('\\ts (4 4) (5.3 7.2 5.1).4 r.4 r.2 |'));
    expect(notes.map(n => [n.string, n.start, n.length])).toEqual([[0, 0, Q], [1, 0, Q], [2, 0, Q]]);
  });
});

describe('marks on a Tie chain', () => {
  it("keeps a tied piece's own bend and chord name on the same piece, as its own written note", async () => {
    const files = await readBuiltinFiles();
    const rise = builtinsFrom(files).find(b => b.id === 'solo-bend-rise')!;
    const p = part(rise.text);
    const before = p.bars[1].columns.slice(0, 3);
    const after = writeVoice(p, readVoice(p)).bars[1].columns.slice(0, 3);
    expect(after).toEqual(before);
    expect(after[0]).toMatchObject({ chord: 'A5' });
    expect(after.map(c => c.notes[0]?.bend?.quarters)).toEqual([6, 6, 6]);
  });

  it('copies whole-note marks to every piece of a split note and keeps attack marks on the first', () => {
    const p = part('\\ts (4 4) 3.3.4 5.3.2{d} |');
    const marked = {
      ...p.bars[0].columns[1],
      tremolo: 16 as const, ottava: '8va' as const, hairpin: 'crescendo' as const,
      notes: p.bars[0].columns[1].notes.map(n => (n ? {
        ...n, palmMute: true, letRing: true, vibrato: 'slight' as const,
        legato: 'h' as const, accent: 'normal' as const, ghost: true, tap: true, harmonic: 'natural' as const,
        mordent: 'upper' as const, staccato: true,
      } : null)),
    };
    const q = { ...p, bars: [{ ...p.bars[0], columns: [p.bars[0].columns[0], marked] }] };
    const out = writeVoice(q, readVoice(q)).bars[0].columns;
    expect(rhythm(out)).toBe('q q ~h');
    const [, first, second] = out;
    expect(first.notes[2]).toMatchObject({ legato: 'h', accent: 'normal', ghost: true, tap: true, harmonic: 'natural', mordent: 'upper', staccato: true });
    expect(second.notes[2]).toEqual({ fret: 5, tie: true, palmMute: true, letRing: true, vibrato: 'slight' });
    for (const c of [first, second]) expect(c).toMatchObject({ tremolo: 16, ottava: '8va', hairpin: 'crescendo' });
  });

  it('writes a plain chain fresh: q~e on beat 1 is q., and e~e inside a beat is q', () => {
    expect(rewritten('\\ts (4 4) 5.3.4 -.3.8 r.8 r.2 |')).toEqual(['q. re rh']);
    expect(rewritten('\\ts (4 4) 5.3.8 -.3.8 r.4 r.2 |')).toEqual(['q rq rh']);
  });

  it('keeps a bent note as written, so the bend keeps its timing', () => {
    expect(rewritten('\\ts (4 4) 5.3.4 7.3{b (0 4 0)}.4{d} 5.3.8 r.4 |')).toEqual(['q q. e rq']);
    expect(rewritten('\\ts (4 4) 7.3{b (0 4)}.4 -.3{b (4 4)}.8 r.8 r.2 |')).toEqual(['q ~e re rh']);
  });
});

describe('writing Columns back', () => {
  it('writes a bass note held under two eighths as two Columns, the bass tied into the second', () => {
    const p = part('\\ts (4 4) (5.1 3.6).8 (7.1 -.6).8 r.4 r.2 |');
    const out = writeVoice(p, readVoice(p)).bars[0].columns;
    expect(rhythm(out)).toBe('e ~e rq rh');
    expect(out[1].notes[5]).toEqual({ fret: 3, tie: true });
    expect(out[1].notes[0]).toEqual({ fret: 7 });
  });

  it('keeps a short bar, an overfull bar and a free-time bar exactly as written', () => {
    expect(rewritten('\\ts (4 4) 5.3.4{d} |')).toEqual(['q.']);
    expect(rewritten('\\ts (4 4) 5.3.1 5.3.4{d} |')).toEqual(['w q.']);
    expect(rewritten('\\ts (4 4) \\ft r.2{d} 5.3.4 |')).toEqual(['rh. q']);
  });

  it('keeps a tuplet as written, and a grace note before its note', () => {
    expect(rewritten('\\ts (4 4) 5.3.8{tu 3} 5.3.8{tu 3} 5.3.8{tu 3} r.4 r.2 |')).toEqual(['e/3 e/3 e/3 rq rh']);
    expect(rewritten('\\ts (4 4) 5.3.8{gr} 7.3.4 r.4 r.2 |')).toEqual(['ge q rq rh']);
  });

  it('writes only the bars asked for', () => {
    const p = part('\\ts (4 4) 5.3.8 r.4{d} r.2 | 5.3.8 r.4{d} r.2 |');
    const out = writeVoice(p, readVoice(p), { bars: [1] }).bars.map(b => rhythm(b.columns));
    expect(out).toEqual(['e rq. rh', 'e re rq rh']);
  });
});

describe('Beat groups', () => {
  it.each([
    ['2/4', 2, 4, [Q, Q]], ['3/4', 3, 4, [Q, Q, Q]], ['4/4', 4, 4, [H, H]], ['2/2', 2, 2, [H, H]],
    ['3/2', 3, 2, [H, H, H]], ['5/4', 5, 4, [3 * Q, H]], ['6/4', 6, 4, [3 * Q, 3 * Q]], ['7/4', 7, 4, [W, 3 * Q]],
    ['3/8', 3, 8, [3 * E]], ['6/8', 6, 8, [3 * E, 3 * E]], ['9/8', 9, 8, [3 * E, 3 * E, 3 * E]],
    ['12/8', 12, 8, [3 * E, 3 * E, 3 * E, 3 * E]], ['5/8', 5, 8, [3 * E, 2 * E]], ['7/8', 7, 8, [2 * E, 2 * E, 3 * E]],
    ['11/8', 11, 8, [2 * E, 2 * E, 2 * E, 2 * E, 3 * E]],
  ] as const)('%s', (_, beats, value, groups) => {
    expect(beatGroups({ beats, value })).toEqual(groups);
  });
});

describe('writing notes by the meter', () => {
  it('keeps the syncopations whole: q h q, e q e, s e s', () => {
    expect(spelled(T44, Q, H)).toBe('h');
    expect(spelled(T44, E, Q)).toBe('q');
    expect(spelled(T44, Q + S, E)).toBe('e');
    expect(spelled(T24, E, Q)).toBe('q');
  });

  it('keeps q. e and e. s on the beat', () => {
    expect(spelled(T44, 0, Q + E)).toBe('q.');
    expect(spelled(T44, 2 * Q, Q + E)).toBe('q.');
    expect(spelled(T44, Q, E + S)).toBe('e.');
  });

  it('splits at the beat what hides the middle of 4/4', () => {
    expect(spelled(T44, Q, 3 * Q)).toBe('q h');
    expect(spelled(T44, Q, Q + E)).toBe('q e');
    expect(spelled(T44, 3 * E, Q)).toBe('e e');
    expect(spelled(T44, Q, H + Q)).toBe('q h');
  });

  it('writes a whole note only on beat 1 of 4/4, and a dotted half only on beat 1', () => {
    expect(spelled(T44, 0, W)).toBe('w');
    expect(spelled(T44, 0, 3 * Q)).toBe('h.');
    expect(spelled(T34, 0, 3 * Q)).toBe('h.');
  });

  it('splits and ties a note over a bar line', () => {
    expect(rewritten('\\ts (4 4) r.2 r.4 5.3.4 | -.3.4 r.4 r.2 |')).toEqual(['rh rq q', '~q rq rh']);
  });

  it('keeps q e, e q and e e e inside a 6/8 group, and a dotted half from its start', () => {
    expect(spelled(T68, 0, Q)).toBe('q');
    expect(spelled(T68, E, Q)).toBe('q');
    expect(spelled(T68, 0, 6 * E)).toBe('h.');
    expect(spelled(T128, 6 * E, 6 * E)).toBe('h.');
  });

  it('splits a quarter on the third eighth of 6/8 into e~e', () => {
    expect(spelled(T68, 2 * E, Q)).toBe('e e');
  });

  it('fills a group of 5/8 and 7/8 with one note, and splits one over a group edge', () => {
    expect(spelled(T58, 0, 3 * E)).toBe('q.');
    expect(spelled(T58, 3 * E, 2 * E)).toBe('q');
    expect(spelled(T58, E, Q)).toBe('q');
    expect(spelled(T78, E, Q)).toBe('e e');
    expect(spelled(T78, 4 * E, 3 * E)).toBe('q.');
  });
});

describe('writing Gaps by the meter', () => {
  it('shows every beat and the half-beat inside a beat in simple time', () => {
    expect(rewritten('\\ts (4 4) 5.3.8 r.2{dd} |')).toEqual(['e re rq rh']);
    expect(rewritten('\\ts (4 4) 5.3.16 r.8{d} r.4 r.2 |')).toEqual(['s rs re rq rh']);
    expect(rewritten('\\ts (3 4) 5.3.4 r.2 |')).toEqual(['q rq rq']);
    expect(spelled(T44, H, H, 'rest')).toBe('h');
    expect(spelled(T44, Q, H, 'rest')).toBe('q q');
  });

  it('writes no dotted rest in simple time', () => {
    expect(spelled(T44, 0, Q + E, 'rest')).toBe('q e');
    expect(spelled(T34, Q, Q + E, 'rest')).toBe('q e');
  });

  it('writes re e re around a middle note, and e rq, in a 6/8 group', () => {
    expect(rewritten('\\ts (6 8) r.8 5.3.8 r.8 r.4{d} |')).toEqual(['re e re rq.']);
    expect(rewritten('\\ts (6 8) 5.3.8 r.8 r.8 r.4{d} |')).toEqual(['e rq rq.']);
  });

  it('shows every group of 5/8', () => {
    expect(rewritten('\\ts (5 8) 5.3.8 r.2 |')).toEqual(['e rq rq']);
  });

  it('writes an empty bar as one rest of its length, else one per Beat group', () => {
    const empty = (time: TimeSignature) => emptyBarRests(time).map(d => `r${LETTER[d.value]}${'.'.repeat(d.dots)}`).join(' ');
    expect(empty(T44)).toBe('rw');
    expect(empty(T34)).toBe('rh.');
    expect(empty(T68)).toBe('rh.');
    expect(empty(T24)).toBe('rh');
    expect(empty(T58)).toBe('rq. rq');
    expect(rewritten('\\ts (3 4) r.4 r.4 r.4 |')).toEqual(['rh.']);
  });
});

describe('the built-in arrangements', () => {
  it('come back exactly, but for the bars listed here, written by the meter', async () => {
    const changed: string[] = [];
    for (const builtin of builtinsFrom(await readBuiltinFiles())) {
      const result = readAlphaTexWith(alphaTab, builtin.text);
      if (!result.ok) continue;
      result.clip.tracks.forEach((_, t) => {
        const p = partOf(result.clip, t);
        const back = writeVoice(p, readVoice(p));
        p.bars.forEach((bar, b) => {
          try {
            expect(back.bars[b].columns).toEqual(bar.columns);
          } catch {
            changed.push(`${builtin.folder}/${builtin.id}, track ${t + 1}, bar ${b + 1}: ${rhythm(bar.columns)} → ${rhythm(back.bars[b].columns)}`);
          }
        });
      });
    }
    expect(changed).toMatchSnapshot();
  });
});
