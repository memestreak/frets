/**
 * alphaTex in and out: the writer's text must mean the same clip to
 * alphaTab's parser, for every golden ASCII fixture, and what Frets doesn't
 * draw yet must survive a round trip as written.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { readAscii } from '@/features/tab/ascii';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { looksLikeAscii } from '@/features/tab/readTab';
import type { Clip } from '@/features/tab/clip';

const read = (text: string) => readAlphaTexWith(alphaTab, text);

function clipOf(text: string): Clip {
  const result = read(text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

const FIXTURES = join(__dirname, 'fixtures');
const asciiClips = readdirSync(FIXTURES)
  .filter(f => f.endsWith('.out.txt'))
  .map(f => {
    const ascii = readFileSync(join(FIXTURES, f), 'utf8').split('\n\n').slice(1).join('\n\n');
    const result = readAscii(ascii);
    return [f, result.ok ? result.clip : null] as const;
  })
  .filter((entry): entry is readonly [string, Clip] => entry[1] !== null);

describe('writeAlphaTex then reading it back', () => {
  it('has fixtures to check', () => {
    expect(asciiClips.length).toBeGreaterThan(10);
  });

  it.each(asciiClips)('%s gives the same clip', (_name, clip) => {
    const tex = writeAlphaTex(clip);
    const result = read(tex);
    expect(result.ok && result.warnings.filter(w => !/add up to/.test(w))).toEqual([]);
    expect(clipOf(tex)).toEqual(clip);
    expect(writeAlphaTex(clipOf(tex))).toBe(tex);
  });
});

describe('readAlphaTex', () => {
  it('reads durations, chords, rests and the header', () => {
    const clip = clipOf('\\title "Riff"\n\\ts (3 4)\n:8 5.5 7.5 (0.1 0.2).4 r.4');
    expect(clip.name).toBe('Riff');
    expect(clip.time).toEqual({ beats: 3, value: 4 });
    const [a, b, chord, rest] = clip.bars[0].columns;
    expect(a.duration.value).toBe(8);
    expect(b.notes[4]).toEqual({ fret: 7 });
    expect(chord.notes.slice(0, 2)).toEqual([{ fret: 0 }, { fret: 0 }]);
    expect(rest.notes.every(n => n === null)).toBe(true);
  });

  it('reads thirty-second and sixty-fourth notes, dotted too, and writes them back', () => {
    const text = '5.3.32{d} 7.3.64 7.3.64 5.3.16{d} 5.3.32 r.8 r.4 r.2 |';
    const clip = clipOf(text);
    expect(clip.bars[0].columns.map(c => [c.duration.value, c.duration.dots])).toEqual([
      [32, 1], [64, 0], [64, 0], [16, 1], [32, 0], [8, 0], [4, 0], [2, 0],
    ]);
    expect(clipOf(writeAlphaTex(clip))).toEqual(clip);
  });

  it('reads a note shorter than a sixty-fourth as one, and says so', () => {
    const result = read('5.3.128 |');
    expect(result.ok && result.clip.bars[0].columns[0].duration.value).toBe(64);
    expect(result.ok && result.warnings.join(' ')).toMatch(/1\/128/);
  });

  it('reads any count over 2, 4, 8, 16 or 32, and anything else as 4/4', () => {
    expect(clipOf('\\ts (7 8)\n5.3.8 |').time).toEqual({ beats: 7, value: 8 });
    expect(clipOf('\\ts (32 32)\n5.3.8 |').time).toEqual({ beats: 32, value: 32 });
    const odd = read('\\ts (3 1)\n5.3.1 |');
    expect(odd.ok && odd.clip.time).toEqual({ beats: 4, value: 4 });
    expect(odd.ok && odd.warnings.join(' ')).toMatch(/3\/1/);
  });

  it('puts hammer-ons, pull-offs and slides on the note they lead to', () => {
    const notes = clipOf('5.3{h}.8 7.3{h}.8 5.3{sl}.8 9.3.8 |').bars[0].columns.map(c => c.notes[2]);
    expect(notes.map(n => n?.legato)).toEqual([undefined, 'h', 'p', undefined]);
    expect(notes[3]?.slide).toBe('legato');
  });

  it('keeps every kind of slide, double dots and palm mute on single notes', () => {
    const tex = [
      '\\ts (4 4)',
      '5.3{ss}.8 7.3.8 5.3.8 7.3{sib}.8 5.3{sia}.4{dd} (5.4 3.5{pm}).16 |',
      '',
    ].join('\n');
    const clip = clipOf(tex);
    const notes = clip.bars[0].columns.map(c => c.notes[2]);
    expect(notes.map(n => n?.slide)).toEqual([undefined, 'shift', undefined, 'below', 'above', undefined]);
    expect(clip.bars[0].columns[4].duration.dots).toBe(2);
    expect(clip.bars[0].columns[5].notes.slice(3, 5)).toEqual([{ fret: 5 }, { fret: 3, palmMute: true }]);
    expect(writeAlphaTex(clip)).toBe(tex);
  });

  it('reads bends, pre-bends and releases from their points', () => {
    const bends = clipOf('7.3{b (0 4)}.4 7.3{b (0 2 0)}.4 7.3{b (4 4)}.4 7.3{b (4 4 0)}.4').bars[0].columns.map(c => c.notes[2]?.bend);
    expect(bends).toEqual([
      { quarters: 4, pre: false, release: false },
      { quarters: 2, pre: false, release: true },
      { quarters: 4, pre: true, release: false },
      { quarters: 4, pre: true, release: true },
    ]);
  });

  it('reads the tuning, high string first as alphaTex lists it', () => {
    expect(clipOf('\\tuning (E4 B3 G3 D3 A2 D2)\n0.6.4').tuning).toEqual(['D', 'A', 'D', 'G', 'B', 'E']);
  });

  it('keeps what it does not draw, says so, and writes it back as written', () => {
    const tex = '\\title "Kept"\n\\artist "Me"\n\\section "Chorus" 5.3{g lr}.4{gr} 7.3{vw}.4 |';
    const result = read(tex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.join(' ')).toMatch(/Kept but not drawn yet: .*g \(ghost note\)/);
    const out = writeAlphaTex(result.clip);
    expect(out).toContain('\\artist "Me"');
    expect(out).toContain('\\section "Chorus"');
    expect(out).toContain('5.3{g lr}');
    expect(out).toContain('{gr}');
    expect(out).toContain('7.3{vw}.4');
    expect(clipOf(out)).toEqual(result.clip);
  });

  it('gives alphaTab\'s errors with their line and column', () => {
    const result = read('5.3.4\n5.3{zz}.4');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/^Line 2, column \d+: .*zz/);
  });

  it('refuses anything but one six-string track', () => {
    expect(read('\\tuning (G3 D3 A2 E2)\n0.1.4').ok).toBe(false);
    expect(read('\\track "A"\n0.1.4 |\n\\track "B"\n0.1.4').ok).toBe(false);
  });
});

/** The examples in section 7 of tab-alphatex.txt, as written there. */
function documentExamples(): string[] {
  const doc = readFileSync(join(__dirname, '../../../public/tab-alphatex.txt'), 'utf8');
  const section = doc.split(/\n7\. EXAMPLES\n-+\n/)[1].split(/\n8\. OPENING/)[0];
  const body = section.split('\n').filter(l => l.startsWith('    ')).map(l => l.slice(4)).join('\n');
  return body.split(/\n(?=\\title)/).map(e => `${e.trim()}\n`);
}

describe('the examples in tab-alphatex.txt', () => {
  const examples = documentExamples();

  it('finds all six', () => {
    expect(examples).toHaveLength(6);
  });

  it.each(examples.map((e, i) => [i + 1, e]))('example %i reads without warnings and writes back the same', (_, text) => {
    const result = read(text);
    expect(result.ok && result.warnings).toEqual([]);
    if (result.ok) expect(writeAlphaTex(result.clip)).toBe(text);
  });

  it('keeps every symbol section 6 lists', () => {
    const result = read([
      '\\section "Chorus" \\tempo 120',
      '5.3{g lr ac st vw}.8 12.3{ah}.8 7.3{tr (9 16)}.8 5.3{sou}.8 5.3.16{gr} 5.3.8{tp 16} 3.6.8{tb (0 -4 0)} 3.6.8{txt "text"} 5.3.8{fermata (medium 1)} |',
    ].join('\n'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(clipOf(writeAlphaTex(result.clip))).toEqual(result.clip);
  });
});

describe('looksLikeAscii', () => {
  it.each([
    ['e|-----5h7-----|', true],
    ['e|-5-|\nB|-5-|', true],
    ['|:-0---3-|', true],
    ['\\title "A -- B"\n5.3.4 |', false],
    ['5.3{h}.8 7.3.8 -.3.4 |', false],
  ])('%j is ASCII: %s', (text, ascii) => {
    expect(looksLikeAscii(text)).toBe(ascii);
  });
});
