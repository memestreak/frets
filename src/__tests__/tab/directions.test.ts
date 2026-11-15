/**
 * Directions (issue #496, `docs/specs/2026-11-15-tab-song-directions-design.md`): read from and written
 * as alphaTex's `\jump`, placed over their bars, stacked clear of each other, turned on and off, written
 * to MusicXML, and played as alphaTab plays them, the playhead following the jumps.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex, writePart } from '@/features/tab/alphatex';
import { parseClip, partOf, withPart, type Clip, type Part } from '@/features/tab/clip';
import {
  DIRECTION_LOOKS, directionName, directionParts, OFFERED_DIRECTIONS, placeDirections, setDirection, startsForm, toggleDirection, directionsFor, directionNamed,
} from '@/features/tab/directions';
import { layoutClip, multiRests } from '@/features/tab/layout';
import { directionY, textAt, textBox } from '@/features/tab/layoutText';
import { elementsOf } from '@/features/tab/elements';
import { pasteOver } from '@/features/tab/editing';
import { writeMusicXml } from '@/features/tab/musicxml';
import { columnAtTick, perform, tickOf, DEFAULT_SOUND } from '@/features/tab/playback';
import { pickedWords } from '@/features/tab/chat/about';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(result.warnings).toEqual([]);
  return result.clip;
}
const partFrom = (text: string): Part => partOf(clipOf(text));

/** Four one-note bars, with a D.S. al Coda form: bar 2 has the Segno, bar 3 To Coda, bar 4 the jump, bar 5 the Coda. */
const FORM = [
  '\\ts (4 4)',
  '0.6.1 |',
  '\\jump segno 2.6.1 |',
  '\\jump dacoda 3.6.1 |',
  '\\jump dalsegnoalcoda 5.6.1 |',
  '\\jump coda 7.6.1 |',
].join('\n');

describe('reading and writing \\jump', () => {
  it('reads each bar\'s Directions, several to a bar, and lists none as kept', () => {
    const read = readAlphaTexWith(alphaTab, '\\jump segno \\jump fine 0.6.1 | \\jump dacapoalfine 0.6.1 |');
    if (!read.ok) throw new Error();
    expect(read.clip.masterBars.map(b => b.directions)).toEqual([['fine', 'segno'], ['dacapoalfine']]);
    expect(read.clip.tracks[0].bars.every(b => !b.extra)).toBe(true);
    expect(read.warnings).toEqual([]);
  });

  it('writes them back in alphaTab\'s order, before the tempo', () => {
    const clip = clipOf('\\jump segno \\jump fine 0.6.1 |');
    expect(writeAlphaTex(clip)).toContain('\\jump fine \\jump segno 0.6.1 |');
    const tempo = clipOf('\\tempo 90 \\jump coda 0.6.1 |');
    expect(writeAlphaTex(tempo)).toContain('\\jump coda \\tempo 90 0.6.1 |');
  });

  it('reads every name alphaTex has, and writes each back the same', () => {
    for (const name of Object.keys(DIRECTION_LOOKS)) {
      const clip = clipOf(`\\jump ${name} 0.6.1 |`);
      expect(clip.masterBars[0].directions).toEqual([name]);
      expect(writeAlphaTex(clip)).toContain(`\\jump ${name} 0.6.1 |`);
    }
  });

  it('keeps them in a saved clip, and refuses a repeated or unknown one', () => {
    const clip = clipOf(FORM);
    expect(parseClip(JSON.parse(JSON.stringify(clip)))?.masterBars[1].directions).toEqual(['segno']);
    const bad = (directions: unknown) => parseClip({ ...clip, masterBars: [{ directions }, ...clip.masterBars.slice(1)] });
    expect(bad(['segno', 'segno'])).toBeNull();
    expect(bad(['repeat'])).toBeNull();
    expect(bad([])).toBeNull();
  });

  it('goes with its bar between a part and the clip', () => {
    const clip = clipOf(FORM);
    const part = partOf(clip);
    expect(part.bars[3].directions).toEqual(['dalsegnoalcoda']);
    const back = withPart(clip, setDirection(part, 0, 'fine', true));
    expect(back.masterBars[0].directions).toEqual(['fine']);
  });
});

describe('the direction popover\'s words', () => {
  it('finds a Direction by its name or Dorico\'s words, dots and case not counting, the one named exactly first', () => {
    expect(directionsFor('ds al coda')[0]).toBe('dalsegnoalcoda');
    expect(directionsFor('D.S.')[0]).toBe('dalsegno');
    expect(directionsFor('tocoda')).toEqual(['dacoda']);
    expect(directionsFor('dc al fine')[0]).toBe('dacapoalfine');
    expect(directionsFor('coda')[0]).toBe('coda');
    expect(directionsFor('bridge')).toEqual([]);
    // Nothing typed lists them all, the panel's first.
    expect(directionsFor('').slice(0, 3)).toEqual(['segno', 'coda', 'fine']);
    expect(directionsFor('')).toHaveLength(19);
  });

  it('reads a listed name back as its Direction', () => {
    expect(directionNamed('D.S. al Coda')).toBe('dalsegnoalcoda');
    expect(directionNamed('Segno')).toBe('segno');
    expect(directionNamed('Bridge')).toBeNull();
  });
});

describe('the edits', () => {
  it('turns one on and off, keeping the others in alphaTab\'s order; the last off leaves no field', () => {
    let part = partFrom('0.6.1 |');
    part = toggleDirection(part, 0, 'segno');
    part = toggleDirection(part, 0, 'fine');
    expect(part.bars[0].directions).toEqual(['fine', 'segno']);
    part = toggleDirection(part, 0, 'fine');
    expect(part.bars[0].directions).toEqual(['segno']);
    part = toggleDirection(part, 0, 'segno');
    expect('directions' in part.bars[0]).toBe(false);
  });

  it('changes nothing when it is already so, or past the last bar', () => {
    const part = partFrom('\\jump segno 0.6.1 |');
    expect(setDirection(part, 0, 'segno', true)).toBe(part);
    expect(setDirection(part, 0, 'coda', false)).toBe(part);
    expect(setDirection(part, 5, 'coda', true)).toBe(part);
  });

  it('isn\'t brought by a paste: a Direction labels its place, as a section does', () => {
    const into = partFrom('0.6.1 | 0.6.1 |');
    const pasted = pasteOver(into, { bar: 1, column: 0, string: 0 }, partFrom('\\jump segno 3.6.1 |'));
    expect(pasted.clip.bars.every(b => !b.directions)).toBe(true);
  });
});

describe('how they look and where they go', () => {
  it('names and draws them as guitar books print them', () => {
    expect(directionName('dacoda')).toBe('To Coda');
    expect(directionName('dalsegnoalcoda')).toBe('D.S. al Coda');
    expect(directionName('segno')).toBe('Segno');
    expect(DIRECTION_LOOKS.coda.parts).toEqual([{ sign: 'coda' }, { words: 'Coda' }]);
    expect(DIRECTION_LOOKS.dacoda.parts).toEqual([{ words: 'To Coda' }, { sign: 'coda' }]);
    expect(OFFERED_DIRECTIONS).toEqual(['segno', 'coda', 'fine', 'dacoda', 'dalsegno', 'dalsegnoalcoda', 'dalsegnoalfine', 'dacapo', 'dacapoalcoda', 'dacapoalfine']);
  });

  it('puts Segno and Coda at the bar\'s start, the jumps and Fine right-aligned to its end', () => {
    expect(['segno', 'segnosegno', 'coda', 'doublecoda'].every(n => startsForm(n as never))).toBe(true);
    const { placed } = placeDirections([{ bar: 0, x0: 100, x1: 400, directions: ['fine', 'segno'] }]);
    const segno = placed.find(p => p.name === 'segno')!;
    const fine = placed.find(p => p.name === 'fine')!;
    expect(segno.x).toBe(104);
    expect(fine.x + fine.width).toBe(396);
    expect(placed.map(p => p.top)).toEqual([0, 0]);
  });

  it('moves one that would touch the one before it up a level, as sections and Text are', () => {
    // "⊕ Coda" at a narrow bar's start runs past it, into the next bar's D.S. at its end: the D.S. goes up.
    const { placed, rows } = placeDirections([
      { bar: 0, x0: 0, x1: 40, directions: ['coda'] },
      { bar: 1, x0: 40, x1: 80, directions: ['dalsegno'] },
    ]);
    expect(rows).toBe(2);
    const coda = placed.find(p => p.name === 'coda')!;
    const ds = placed.find(p => p.name === 'dalsegno')!;
    // Rows count from the top: the moved D.S. is on top, the Coda on the row by the music.
    expect([ds.top, coda.top]).toEqual([0, 1]);
    // A jump at one bar's end and a Coda at the next one's start sit side by side, the bar line between them.
    expect(placeDirections([
      { bar: 0, x0: 0, x1: 300, directions: ['dalsegnoalcoda'] },
      { bar: 1, x0: 300, x1: 600, directions: ['coda'] },
    ]).rows).toBe(1);
  });

  it('gives a line its row only when it has a Direction, over the endings', () => {
    const plain = layoutClip(partFrom('0.6.1 | 0.6.1 |'), 800);
    expect(plain.systems[0].rows.directions).toBeNull();
    const part = partFrom('\\ro \\ae 1 \\jump segno 0.6.1 | \\rc 2 \\ae 2 \\jump fine 0.6.1 |');
    const { rows } = layoutClip(part, 800).systems[0];
    expect(rows.directions).not.toBeNull();
    expect(rows.directions!).toBeLessThan(rows.endings!);
  });

  it('is picked by a press on it, and its box is where it is drawn', () => {
    const part = partFrom(FORM);
    const layout = layoutClip(part, 1200);
    const system = layout.systems[0];
    const placed = system.directions.find(d => d.name === 'dacoda')!;
    const y = system.top + directionY(system, placed)!;
    expect(textAt(layout, placed.x + placed.width / 2, y)).toEqual({ kind: 'direction', bar: 2, name: 'dacoda' });
    const box = textBox(layout, { kind: 'direction', bar: 2, name: 'dacoda' })!;
    expect(box.x).toBeLessThan(placed.x);
    expect(box.x + box.width).toBeGreaterThan(placed.x + placed.width);
    expect(textBox(layout, { kind: 'direction', bar: 2, name: 'segno' })).toBeNull();
  });

  it('is a stop for Ctrl/⌘+Alt+← →: a start one before the bar\'s notes, end ones after them as drawn', () => {
    const part = partFrom('\\jump segno \\jump fine \\jump dacapoalfine 0.6.1 |');
    const kinds = elementsOf(part, layoutClip(part, 800)).map(e => (e.kind === 'direction' ? e.name : e.kind));
    // Fine, written first, is nearest the bar line.
    expect(kinds).toEqual(['time', 'segno', 'note', 'dacapoalfine', 'fine']);
  });

  it('ends a run of bars drawn as one multi-bar rest where it is drawn', () => {
    const rest = (tag = '') => `${tag} r.1 |`;
    const part = partFrom(`\\multiBarRest\n${rest()}${rest()}${rest('\\jump dalsegno')}${rest()}${rest('\\jump segno')}${rest()}`);
    // A jump closes a run (it is at its bar's end); a Segno opens one.
    expect([...multiRests(part)]).toEqual([[0, 3], [4, 2]]);
  });

  it('names a picked one for the Chat popover', () => {
    expect(pickedWords({ kind: 'direction', bar: 3, name: 'dalsegnoalcoda' }, 3)).toBe('the D.S. al Coda direction in bar 4');
  });

  it('measures words and signs side by side', () => {
    const { parts, width } = directionParts('dacoda');
    expect(parts.map(p => ('words' in p ? 'words' : 'sign'))).toEqual(['words', 'sign']);
    expect(parts[1].x).toBeGreaterThan(parts[0].x + parts[0].width);
    expect(width).toBe(parts[1].x + parts[1].width);
  });
});

describe('MusicXML', () => {
  it('writes Segno and Coda at the bar\'s start, the jumps after its notes, each with the sound that plays it', () => {
    const doc = new DOMParser().parseFromString(writeMusicXml(clipOf(FORM)), 'application/xml');
    const measures = [...doc.querySelectorAll('part measure')];
    const segno = measures[1].querySelector('direction')!;
    expect(segno.querySelector('direction-type segno')).not.toBeNull();
    expect(segno.querySelector('sound')!.getAttribute('segno')).toBe('segno');
    // The jumps come after the bar's notes.
    const ds = [...measures[3].children].filter(c => c.tagName === 'direction').pop()!;
    expect(ds.previousElementSibling?.tagName).toBe('note');
    expect(ds.querySelector('words')!.textContent).toBe('D.S. al Coda');
    expect(ds.querySelector('sound')!.getAttribute('dalsegno')).toBe('segno');
    const toCoda = [...measures[2].querySelectorAll('direction')].pop()!;
    expect([...toCoda.querySelectorAll('direction-type > *')].map(e => e.tagName)).toEqual(['words', 'coda']);
    expect(toCoda.querySelector('sound')!.getAttribute('tocoda')).toBe('coda');
    expect(measures[4].querySelector('direction coda')).not.toBeNull();
    const fine = new DOMParser().parseFromString(writeMusicXml(clipOf('\\jump fine 0.6.1 | \\jump dacapoalfine 0.6.1 |')), 'application/xml');
    expect(fine.querySelector('sound[fine="yes"]')).not.toBeNull();
    expect(fine.querySelector('sound[dacapo="yes"]')).not.toBeNull();
  });
});

describe('playback', () => {
  const plain = (part: Part) => perform(alphaTab, part, DEFAULT_SOUND, { clicks: false });
  const Q = 960;

  it('plays the jumps: D.S. al Coda goes back to the Segno, then from To Coda to the Coda, repeats not played again', () => {
    const part = partFrom(FORM);
    const played = plain(part);
    expect(played.lookup.masterBars.map(b => b.masterBar.index)).toEqual([0, 1, 2, 3, 1, 2, 4]);
    // The playhead follows: the fifth bar played is bar 2 again, then the Coda.
    const at = (k: number) => columnAtTick(part, played, played.start + k * 4 * Q + 10);
    expect([0, 1, 2, 3, 4, 5, 6].map(at)).toEqual([0, 1, 2, 3, 1, 2, 4]);
    // Play from a bar, and a Loop, start the first time it is played.
    expect(tickOf(part, played, 1)).toBe(played.start + 4 * Q);
  });

  it('plays D.C. al Fine to the Fine, and writes the jumps for alphaTab as the clip has them', () => {
    const part = partFrom('0.6.1 | \\jump fine 2.6.1 | \\jump dacapoalfine 3.6.1 |');
    expect(writePart(part)).toContain('\\jump dacapoalfine');
    expect(plain(part).lookup.masterBars.map(b => b.masterBar.index)).toEqual([0, 1, 2, 0, 1]);
  });
});
