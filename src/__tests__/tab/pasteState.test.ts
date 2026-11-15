/**
 * A paste keeps the key, meter and tempo of what it pastes, and the music after it keeps its own
 * (`docs/specs/2026-11-15-tab-paste-keeps-key-meter-tempo-design.md`): a mark goes in only where they change,
 * and labels (a section) slide on with their music under Insert paste.
 */
import * as alphaTab from '@coderline/alphatab';
import { writePart } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { insertPaste, pasteOver, sliceClip, statedIn } from '@/features/tab/editing';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}
const at = (bar: number) => ({ bar, column: 0, string: 0 });

/** Jeremy's sample, 2026-11-15: an Intro in E at Slowly ♩ = 72, then a Verse in C. */
const SONG = clipOf([
  '\\ts (6 8)',
  '\\ks E \\tempo (72 "Slowly") \\section "Intro" 3.5.8 2.4.8 3.5.8 0.3.8 2.4.8 3.5.8 |',
  '2.5.4{d} 1.4.4{d} |',
  '\\ks C \\section "Verse" 3.5.4{d} 0.3.4{d} |',
  '0.1.2{d} |',
].join('\n'));
const FIRST_BAR = writePart(sliceClip(SONG, [0, 5]));
const pasteInto = (clip: Part, bar: number, text: string, insert = true) =>
  writePart((insert ? insertPaste : pasteOver)(clip, at(bar), clipOf(text), statedIn(text)).clip);

describe('a copy says the key, meter and tempo it was in', () => {
  it('even when they were set on an earlier bar', () => {
    expect(writePart(sliceClip(SONG, [6, 7]))).toBe('\\ts (6 8)\n\\ks E \\tempo (72 "Slowly") 2.5.4{d} 1.4.4{d} |\n');
  });
  it('a clip that sets no key or tempo anywhere says none', () => {
    expect(writePart(sliceClip(clipOf('\\ts (4 4)\n5.1.4 7.1.4 r.2 |'), [0, 1]))).toBe('\\ts (4 4)\n5.1.4 7.1.4 |\n');
  });
});

describe('Insert paste of whole bars at a bar line', () => {
  it('the issue: bar 1 pasted before bar 1 keeps E, 6/8 and Slowly ♩ = 72; the Intro slides on with its music, said once', () => {
    expect(pasteInto(SONG, 0, FIRST_BAR)).toBe([
      '\\ts (6 8)',
      '\\ks E \\tempo (72 "Slowly") 3.5.8 2.4.8 3.5.8 0.3.8 2.4.8 3.5.8 |',
      '\\section "Intro" 3.5.8 2.4.8 3.5.8 0.3.8 2.4.8 3.5.8 | 2.5.4{d} 1.4.4{d} |',
      '\\ks C \\section "Verse" 3.5.4{d} 0.3.4{d} | 0.1.2{d} |',
      '',
    ].join('\n'));
  });
  it('before the Verse: the pasted bar stays in E, the Verse keeps its C and its label', () => {
    expect(pasteInto(SONG, 2, FIRST_BAR)).toContain('2.5.4{d} 1.4.4{d} | 3.5.8 2.4.8 3.5.8 0.3.8 2.4.8 3.5.8 |\n\\ks C \\section "Verse" 3.5.4{d}');
  });
  it('a 6/8 bar into 4/4: its meter, key and tempo go in with it, and the bar after gets back its own', () => {
    const four = clipOf('\\ts (4 4)\n\\tempo 100 5.1.4 7.1.4 5.1.4 7.1.4 |\n8.1.1 |');
    expect(pasteInto(four, 1, FIRST_BAR)).toBe([
      '\\ts (4 4)',
      '\\tempo 100 5.1.4 7.1.4 5.1.4 7.1.4 |',
      '\\ts (6 8) \\ks E \\tempo (72 "Slowly") 3.5.8 2.4.8 3.5.8 0.3.8 2.4.8 3.5.8 |',
      '\\ts (4 4) \\ks C \\tempo 100 8.1.1 |',
      '',
    ].join('\n'));
  });
  it('alphaTex that says no meter, key or tempo takes the ones where it lands, and adds no mark', () => {
    expect(pasteInto(SONG, 1, '3.5.4{d} 2.4.4{d} |')).toContain('3.5.8 |\n3.5.4{d} 2.4.4{d} | 2.5.4{d} 1.4.4{d} |\n\\ks C');
  });
});

describe('Paste of whole bars over bars of the same meter', () => {
  it('over the Verse: the bar keeps its label and is in E, and the bar after gets back its C', () => {
    expect(pasteInto(SONG, 2, FIRST_BAR, false)).toContain('\\section "Verse" 3.5.8 2.4.8 3.5.8 0.3.8 2.4.8 3.5.8 | \\ks C 0.1.2{d} |');
  });
});

describe('a paste that isn\'t whole bars at a bar line', () => {
  it('takes the key, meter and tempo where it lands, brings no labels, and leaves the marks on their bars', () => {
    const copy = writePart(sliceClip(SONG, [1, 3]));
    const out = pasteInto(SONG, 0, copy);
    expect(out.match(/\\section/g)).toHaveLength(2);
    expect(out.match(/\\ks/g)).toHaveLength(2);
    expect(out).toMatch(/^\\ts \(6 8\)\n\\ks E \\section "Intro" \\tempo \(72 "Slowly"\)/);
  });
});
