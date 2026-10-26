import { readFileSync } from 'fs';
import path from 'path';
import { readAscii, writeAscii } from '@/features/tab/ascii';
import {
  BEND_QUARTERS, isPalmMuted, isUneven, NOTE_VALUES, SHORTEST_DOTTED, STANDARD_TUNING, ticks,
  type Bar, type Clip, type Column, type Duration, type Note,
} from '@/features/tab/clip';
import { seededRng } from '../helpers/rng';

/** The worked examples in section 8 of the format's definition, as written there. */
function documentExamples(): string[] {
  const doc = readFileSync(path.resolve(__dirname, '../../../public/tab-ascii.txt'), 'utf8');
  const section = doc.split(/\n8\. EXAMPLES\n-+\n/)[1].split(/\n9\. OPENING/)[0];
  const dedented = section.split('\n').map(l => l.replace(/^ {4}/, '')).join('\n').trim();
  return dedented.split(/\n\n(?=Title:)/);
}

function read(text: string) {
  const result = readAscii(text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result;
}

const notesOf = (c: Column) => c.notes.map(n => (n ? n.fret : '-'));

describe('the examples in tab-ascii.txt', () => {
  const examples = documentExamples();

  it('are four', () => {
    expect(examples).toHaveLength(4);
  });

  it.each(examples.map((e, i) => [i + 1, e]))('example %i reads without warnings and writes back the same', (_, text) => {
    const { clip, warnings } = read(text as string);
    expect(warnings).toEqual([]);
    expect(clip.bars.every(b => !isUneven(b, clip.time))).toBe(true);
    expect(writeAscii(clip)).toBe(text);
  });

  it('reads legato, a bend and vibrato', () => {
    const { clip } = read(examples[0]);
    expect(clip.name).toBe('Legato, a bend and vibrato');
    const [one, two] = clip.bars;
    expect(one.columns).toHaveLength(8);
    expect(one.columns[1].notes[5]).toEqual({ fret: 8, legato: 'h' });
    expect(two.columns[1].notes[2]).toEqual({ fret: 5, legato: 'p' });
    expect(two.columns[4].notes[4]).toEqual({ fret: 7, bend: { quarters: 4, pre: false, release: false } });
    expect(two.columns[5].notes[5]).toEqual({ fret: 5, vibrato: 'slight' });
    expect(two.columns[4].duration).toEqual({ value: 4, dots: 0, triplet: false });
  });

  it('reads strummed chords, ties, a rest, palm mutes, strokes and a counted repeat', () => {
    const { clip } = read(examples[1]);
    const [one, two] = clip.bars;
    expect(one.repeatStart).toBe(true);
    expect(two.repeatEnd).toBe(4);
    expect(notesOf(one.columns[0])).toEqual([3, 3, 0, 0, 2, 3]);
    expect(one.columns.map(c => c.stroke)).toEqual(['down', 'down', 'up', 'up', 'up', 'down']);
    expect(notesOf(one.columns[3])).toEqual([null, null, null, null, null, null]);
    expect(two.columns[0].notes.every(n => n?.tie)).toBe(true);
    expect(two.columns[0].duration.value).toBe(2);
    expect(two.columns.map(isPalmMuted)).toEqual([false, true, true, true, false]);
    expect(two.columns[4].notes.every(n => n === null)).toBe(true);
  });

  it('reads sixteenths, a triplet, a tap, harmonics and a pre-bend', () => {
    const { clip } = read(examples[2]);
    const cols = clip.bars[0].columns;
    expect(cols.slice(0, 4).every(c => c.duration.value === 16)).toBe(true);
    expect(cols[1].notes[1]).toEqual({ fret: 7, slide: 'legato' });
    expect(cols[4].duration).toEqual({ value: 8, dots: 0, triplet: true });
    expect(cols[4].notes[0]).toEqual({ fret: 12, tap: true });
    expect(cols[7].notes.slice(0, 3)).toEqual([0, 1, 2].map(() => ({ fret: 12, harmonic: 'natural' })));
    expect(cols[8].notes[1]).toEqual({ fret: 8, bend: { quarters: 4, pre: true, release: true } });
  });

  it('reads a tuning and endings across two blocks', () => {
    const { clip } = read(examples[3]);
    expect(clip.tuning).toEqual(['D', 'A', 'D', 'G', 'B', 'E']);
    expect(clip.bars).toHaveLength(3);
    expect(clip.bars.map(b => b.ending)).toEqual([undefined, 1, 2]);
    expect(clip.bars[0].repeatStart).toBe(true);
    expect(clip.bars[1].repeatEnd).toBe(2);
  });
});

describe('readAscii refuses', () => {
  const errorsOf = (text: string) => {
    const r = readAscii(text);
    return r.ok ? [] : r.errors;
  };

  it('text with no tab', () => {
    expect(errorsOf('just some words')[0]).toMatch(/No tab found/);
  });

  it('a block of five string lines', () => {
    expect(errorsOf('e|---|\nB|---|\nG|---|\nD|---|\nA|---|')[0]).toMatch(/5 string lines/);
  });

  it('a fret above 24, including digits run together', () => {
    expect(errorsOf('e|-128---|\nB|-------|\nG|-------|\nD|-------|\nA|-------|\nE|-------|')[0])
      .toMatch(/fret 128 is above 24/);
  });

  it('a hammer-on with no earlier note on its string', () => {
    expect(errorsOf('e|--h5---|\nB|-------|\nG|-------|\nD|-------|\nA|-------|\nE|-------|')[0])
      .toMatch(/Line 1: "h" with no earlier note/);
  });

  it('a tie that does not continue the same fret', () => {
    expect(errorsOf('e|-5---(7)-|\nB|---------|\nG|---------|\nD|---------|\nA|---------|\nE|---------|')[0])
      .toMatch(/tie \(7\)/);
  });
});

describe('readAscii forgives', () => {
  it('t and x in the rhythm line as thirty-second and sixty-fourth notes', () => {
    const { clip } = read([
      '   t. x  x  s  ',
      'e|-5--7--8--5-|',
      'B|------------|',
      'G|------------|',
      'D|------------|',
      'A|------------|',
      'E|------------|',
    ].join('\n'));
    expect(clip.bars[0].columns.map(c => [c.duration.value, c.duration.dots])).toEqual([[32, 1], [64, 0], [64, 0], [16, 0]]);
  });

  it('a missing rhythm line, guessing from the spacing within each bar', () => {
    const { clip, warnings } = read([
      'e|-5---5---5---5---|-5-------5-------|',
      'B|-----------------|-----------------|',
      'G|-----------------|-----------------|',
      'D|-----------------|-----------------|',
      'A|-----------------|-----------------|',
      'E|-----------------|-----------------|',
    ].join('\n'));
    expect(clip.bars[0].columns.map(c => c.duration.value)).toEqual([4, 4, 4, 4]);
    expect(clip.bars[1].columns.map(c => c.duration.value)).toEqual([2, 2]);
    expect(warnings[0]).toMatch(/Guessed the length of 6 notes/);
  });

  it('names the bars whose durations don\'t add up', () => {
    const { clip, warnings } = read([
      '   q   q   q   | q   q   q   q   | q   q   |',
      'e|-5---5---5---|-5---5---5---5---|-5---5---|',
      'B|-------------|-----------------|---------|',
      'G|-------------|-----------------|---------|',
      'D|-------------|-----------------|---------|',
      'A|-------------|-----------------|---------|',
      'E|-------------|-----------------|---------|',
    ].join('\n'));
    expect(clip.bars).toHaveLength(3);
    expect(warnings).toEqual(['Bars 1 and 3 don\'t add up to 4/4.']);
  });

  it('tab with no bar lines inside, taking the most common gap as an eighth', () => {
    const { clip } = read([
      'e|-5--5--5--5--5--5--5--5--5--5--|',
      'B|-------------------------------|',
      'G|-------------------------------|',
      'D|-------------------------------|',
      'A|-------------------------------|',
      'E|-------------------------------|',
    ].join('\n'));
    expect(clip.bars).toHaveLength(2);
    expect(clip.bars[0].columns).toHaveLength(8);
    expect(clip.bars[0].columns.every(c => c.duration.value === 8)).toBe(true);
  });

  it('unknown characters, short lines and a bend past 2 steps', () => {
    const { clip, warnings } = read([
      'e|-5b12--*--|',
      'B|-------|',
      'G|----------|',
      'D|----------|',
      'A|----------|',
      'E|----------|',
    ].join('\n'));
    expect(clip.bars[0].columns[0].notes[0]?.bend?.quarters).toBe(8);
    expect(warnings.join(' ')).toMatch(/past 2 steps/);
    expect(warnings.join(' ')).toMatch(/Ignored 1 character/);
    expect(warnings.join(' ')).toMatch(/padded/);
  });

  it('any count over 2, 4, 8, 16 or 32, and anything else as 4/4', () => {
    const body = '\ne|-5-|\nB|---|\nG|---|\nD|---|\nA|---|\nE|---|';
    expect(read(`Time: 7/8${body}`).clip.time).toEqual({ beats: 7, value: 8 });
    const { clip, warnings } = read(`Time: 5/1${body}`);
    expect(clip.time).toEqual({ beats: 4, value: 4 });
    expect(warnings.join(' ')).toMatch(/5\/1/);
  });

  it('tab as found online: chord names, lyrics, E for both E strings, ||: and :||', () => {
    const { clip } = read([
      'Intro riff (capo off)',
      '',
      '     Em                 G',
      'E||:-------------------|-------------------:||',
      'B||:-------------------|-------------------:||',
      'G||:-------------------|-------------------:||',
      'D||:---------2----2----|-------------------:||',
      'A||:-----2---------2---|-----2----5--------:||',
      'E||:-0-----------------|-3-------------3---:||',
      'la la la',
    ].join('\n'));
    expect(clip.bars).toHaveLength(2);
    expect(clip.bars[0].repeatStart).toBe(true);
    expect(clip.bars[1].repeatEnd).toBe(2);
    expect(clip.bars[0].columns.map(notesOf)).toEqual([
      ['-', '-', '-', '-', '-', 0], ['-', '-', '-', '-', 2, '-'], ['-', '-', '-', 2, '-', '-'],
      ['-', '-', '-', 2, '-', '-'], ['-', '-', '-', '-', 2, '-'],
    ]);
    expect(clip.tuning).toEqual(STANDARD_TUNING);
  });

  it('string names that differ from standard as the tuning', () => {
    const { clip } = read('e|-5-|\nB|---|\nG|---|\nD|---|\nA|---|\nD|---|');
    expect(clip.tuning).toEqual(['D', 'A', 'D', 'G', 'B', 'E']);
  });
});

describe('writeAscii and readAscii round trip', () => {
  /** A random clip using every mark, as an editor could make it. */
  function randomClip(seed: number): Clip {
    const rng = seededRng(seed);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
    const previous: (Note | null)[] = Array(6).fill(null);
    const bars: Bar[] = [];
    for (let b = 0; b < 1 + Math.floor(rng() * 5); b++) {
      const columns: Column[] = [];
      for (let k = 0; k < 1 + Math.floor(rng() * 6); k++) {
        const duration: Duration = {
          value: pick(NOTE_VALUES), dots: rng() < 0.2 ? 1 : 0, triplet: false,
        };
        if (duration.dots && duration.value > SHORTEST_DOTTED) duration.dots = 0;
        if (!duration.dots && rng() < 0.15) duration.triplet = true;
        const notes: (Note | null)[] = Array(6).fill(null);
        if (rng() > 0.1) {
          for (let s = 0; s < 6; s++) {
            if (rng() < 0.6) continue;
            const before = previous[s];
            const note: Note = { fret: rng() < 0.05 ? null : Math.floor(rng() * 20) };
            const r = rng();
            if (note.fret !== null) {
              if (r < 0.1 && before) note.legato = pick(['h', 'p'] as const);
              // ASCII has a slide from the note before, or from below or above when there is none.
              else if (r < 0.2) note.slide = before ? 'legato' : pick(['below', 'above'] as const);
              else if (r < 0.3 && before && before.fret !== null) {
                note.fret = before.fret;
                note.tie = true;
              } else if (r < 0.35) note.harmonic = 'natural';
              else if (r < 0.4) note.tap = true;
              if (rng() < 0.15) note.bend = { quarters: pick(BEND_QUARTERS), pre: rng() < 0.3, release: rng() < 0.4 };
              if (note.bend?.quarters === 1) note.bend.pre = false;
              if (rng() < 0.15) note.vibrato = 'slight';
            }
            notes[s] = note;
            previous[s] = note;
          }
        }
        const column: Column = { duration, notes };
        // ASCII palm mutes whole columns.
        if (rng() < 0.2) for (const n of notes) if (n) n.palmMute = true;
        if (rng() < 0.3) column.stroke = pick(['down', 'up'] as const);
        columns.push(column);
      }
      const bar: Bar = { columns };
      if (rng() < 0.2) bar.repeatStart = true;
      if (rng() < 0.2) bar.repeatEnd = pick([2, 3, 4]);
      bars.push(bar);
    }
    return {
      name: rng() < 0.5 ? `Clip ${seed}` : '',
      time: { beats: 4, value: 4 },
      tuning: rng() < 0.3 ? ['D', 'A', 'D', 'G', 'B', 'E'] : [...STANDARD_TUNING],
      bars,
    };
  }

  it.each(Array.from({ length: 40 }, (_, i) => i + 1))('gives the same clip (seed %i)', seed => {
    const clip = randomClip(seed);
    const text = writeAscii(clip);
    const back = read(text).clip;
    expect(back).toEqual(clip);
  });

  it('keeps a triplet group exact', () => {
    const t: Duration = { value: 8, dots: 0, triplet: true };
    expect(ticks(t) * 3).toBe(ticks({ value: 4, dots: 0, triplet: false }));
  });
});

describe('readAscii, smaller marks', () => {
  it('reads a double dot in the rhythm line and writes it back', () => {
    const result = readAscii('Time: 2/4\n\n   q.. s\ne|-5---7-|\nB|-------|\nG|-------|\nD|-------|\nA|-------|\nE|-------|');
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.clip.bars[0].columns[0].duration).toEqual({ value: 4, dots: 2, triplet: false });
    expect(writeAscii(result.clip)).toContain('q..');
  });

  it('mutes only the note marked M', () => {
    const result = readAscii('e|-5M--|\nB|-5---|\nG|-----|\nD|-----|\nA|-----|\nE|-----|');
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.clip.bars[0].columns[0].notes.slice(0, 2)).toEqual([{ fret: 5, palmMute: true }, { fret: 5 }]);
  });
});
