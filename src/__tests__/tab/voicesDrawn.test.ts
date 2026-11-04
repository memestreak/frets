/**
 * Every Voice drawn, exported and edited (step 9, `docs/specs/2026-11-04-tab-voices-drawn-edited-design.md`):
 * the layout's shared time line, the stems, rests and heads by Voice, ASCII and MusicXML, and the pure edits
 * of `voices.ts`. The page's keys and presses are in `page/voicesEdited.test.tsx`.
 */
import * as alphaTab from '@coderline/alphatab';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAscii } from '@/features/tab/ascii';
import { partOf, type Clip, type Part } from '@/features/tab/clip';
import { clipAction } from '@/features/tab/clipState';
import { setFret } from '@/features/tab/editing';
import { layoutClip, type PlacedColumn } from '@/features/tab/layout';
import { writeMusicXml } from '@/features/tab/musicxml';
import { tabSvg } from '@/features/tab/exportTab';
import { TabClip } from '@/features/tab/TabClip';
import {
  clashMessage, moveToVoice, pasteVoices, perVoice, sliceVoices, stepAcrossVoices, voiceSelections,
} from '@/features/tab/voices';
import { writePart } from '@/features/tab/alphatex';
import { clearToRests } from '@/features/tab/noteEdits';
import { stepDuration } from '@/features/tab/noteEdits';
import { MUTED_VOICE_INK } from '@/features/tab/TabClip';

function read(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, `\\voiceMode barWise\n\\ts (4 4)\n${text}`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

/** The bars of track 1 as alphaTex, one bar a line, Voices marked as the writer marks them. */
function bars(clip: Clip): string[] {
  const body = writeAlphaTex(clip).split('\n').filter(l => !/^\\(title|voiceMode|ts) /.test(l) && l !== '\\voiceMode barWise').join(' ');
  return (body.match(/[^|]*\|/g) ?? []).map(b => b.trim().replace(/\s+/g, ' '));
}

/** Every placed column of a bar, the part's own Voice's and the others', with its Voice. */
function placed(part: Part, parts: 'staff' | 'tab' | 'both' = 'both', bar = 0): { voice: number; at: PlacedColumn }[] {
  const layout = layoutClip(part, 800, parts);
  const b = layout.systems.flatMap(s => s.bars).find(x => x.index === bar)!;
  return [...b.columns.map(at => ({ voice: part.voice ?? 0, at })), ...(b.voices ?? []).flatMap(v => v.columns.map(at => ({ voice: v.voice, at })))];
}

/** Voice 1 a half note and two quarters; Voice 2 four quarters under it. */
const HALF_OVER_QUARTERS = '\\voice 5.2.2 5.2.4 7.2.4 \\voice 3.5.4 5.5.4 3.5.4 5.5.4 |';

describe('the layout', () => {
  it('lays a one-Voice clip out as before: no other Voices, no stems by Voice', () => {
    const part = partOf(read('5.2.4 7.2.4 5.3.2 |'));
    const bar = layoutClip(part, 800, 'both').systems[0].bars[0];
    expect(bar.voices ?? []).toEqual([]);
    expect(bar.columns.every(c => c.voiceUp === undefined && !c.headShift)).toBe(true);
  });

  it('puts every Voice on one time line: the second spot at Voice 2\'s second quarter, notes starting together sharing an x', () => {
    const all = placed(partOf(read(HALF_OVER_QUARTERS)));
    const xs = (voice: number) => all.filter(p => p.voice === voice).map(p => p.at.x);
    const [half, third, fourth] = xs(0);
    const quarters = xs(1);
    expect(quarters[0]).toBeCloseTo(half);
    expect(quarters[2]).toBeCloseTo(third);
    expect(quarters[3]).toBeCloseTo(fourth);
    // Voice 2's second quarter has a spot of its own, between the half note and Voice 1's third note.
    expect(quarters[1]).toBeGreaterThan(half);
    expect(quarters[1]).toBeLessThan(third);
  });
});

describe('the staff', () => {
  it('stems Voice 1 up and Voice 2 down in a two-Voice bar, and by pitch in a bar of Voice 1 alone', () => {
    const part = partOf(read(`${HALF_OVER_QUARTERS}\n17.1.4 17.1.4 17.1.2 |`));
    const two = placed(part);
    expect(two.filter(p => p.voice === 0).every(p => p.at.voiceUp === true)).toBe(true);
    expect(two.filter(p => p.voice === 1).every(p => p.at.voiceUp === false)).toBe(true);
    // High notes alone stem down, by pitch, as before.
    const alone = placed(part, 'both', 1);
    expect(alone.every(p => p.at.voiceUp === undefined && !p.at.stemUp)).toBe(true);
  });

  it('stems Voice 3 up and Voice 4 down', () => {
    const four = placed(partOf(read('\\voice 12.1.1 \\voice 0.6.1 \\voice 10.2.1 \\voice 2.5.1 |')));
    expect(four.map(p => [p.voice, p.at.voiceUp])).toEqual(expect.arrayContaining([[0, true], [1, false], [2, true], [3, false]]));
  });

  it('moves Voice 2\'s rests down and Voice 1\'s up; an absent Voice draws no rest; a Whole-bar rest only for Voice 1', () => {
    const part = partOf(read('\\voice 5.2.2 r.2 \\voice r.2 3.5.2 |\nr.1 |\n\\voice r.1 \\voice 3.5.1 |'));
    const { container } = render(createElement(TabClip, { clip: part, width: 800, parts: 'staff', title: 'Voices' }));
    const restSteps = (voice: number) => [...container.querySelectorAll(voice === 0 ? '[data-testid="staff-bar"] [data-step]' : `[data-testid="other-voice"][data-voice="${voice + 1}"] [data-step]`)]
      .map(el => Number(el.getAttribute('data-step')));
    const own = restSteps(0);
    const second = restSteps(1);
    expect(second.length).toBeGreaterThan(0);
    // Voice 1's rests sit higher than the middle line (step 4), Voice 2's lower.
    expect(own.every(step => step > 4)).toBe(true);
    expect(second.every(step => step < 4)).toBe(true);
    // Bar 2 has Voice 1 alone: its Whole-bar rest sits where it always did, and Voice 2 draws nothing there.
    expect(container.querySelectorAll('[data-testid="other-voice"] [data-testid="whole-rest"]')).toHaveLength(0);
  });

  it('sets heads a second apart side by side, the up-stem one right; shares one head of the same pitch and kind; a white and a black head sit side by side', () => {
    // Voice 1 G (string 3 open) over Voice 2 F (string 4, fret 3): a second apart.
    const second = placed(partOf(read('\\voice 0.3.4 r.4 r.2 \\voice 3.4.4 r.4 r.2 |')), 'staff');
    const up = second.find(p => p.voice === 0 && p.at.column.notes.some(Boolean))!;
    const down = second.find(p => p.voice === 1 && p.at.column.notes.some(Boolean))!;
    expect((up.at.headShift ?? 0) - (down.at.headShift ?? 0)).toBeGreaterThan(0);
    // The same pitch, both quarters: one head, drawn once.
    const same = placed(partOf(read('\\voice 0.3.4 r.4 r.2 \\voice 5.4.4 r.4 r.2 |')), 'staff');
    const shared = same.filter(p => p.at.sharedHeads && p.at.sharedHeads.size > 0);
    expect(shared).toHaveLength(1);
    // A half note (white) and a quarter (black) at the same pitch: side by side, nothing shared.
    const kinds = placed(partOf(read('\\voice 0.3.2 r.2 \\voice 5.4.4 r.4 r.2 |')), 'staff');
    expect(kinds.some(p => p.at.sharedHeads && p.at.sharedHeads.size > 0)).toBe(false);
    expect(kinds.some(p => (p.at.headShift ?? 0) !== 0)).toBe(true);
  });
});

describe('the tab with the staff off', () => {
  it('stems Voice 1 above the tab and Voice 2 below in a two-Voice bar; a Voice 1-only bar\'s stems stay below', () => {
    const two = render(createElement(TabClip, { clip: partOf(read(HALF_OVER_QUARTERS)), width: 800, parts: 'tab', title: 'Voices' }));
    expect(two.container.querySelectorAll('[data-testid="stems-over"]').length).toBeGreaterThan(0);
    const one = render(createElement(TabClip, { clip: partOf(read('5.2.4 7.2.4 5.3.2 |')), width: 800, parts: 'tab', title: 'Voices' }));
    expect(one.container.querySelectorAll('[data-testid="stems-over"]')).toHaveLength(0);
  });
});

describe('the exports', () => {
  it('ASCII writes both Voices\' frets, sharing a column where they start together', () => {
    const ascii = writeAscii(partOf(read('\\voice 5.2.2 7.2.2 \\voice 3.5.4 5.5.4 3.5.4 5.5.4 |')));
    const lines = ascii.split('\n');
    const b = lines.find(l => l.startsWith('B'))!;
    const a = lines.find(l => l.startsWith('A'))!;
    // The half note's 5 sits over Voice 2's first 3, and the second half note's 7 over its third quarter.
    expect(b.indexOf('5')).toBe(a.indexOf('3'));
    expect(b.indexOf('7')).toBe(a.lastIndexOf('3'));
    expect(a.match(/\d/g)).toEqual(['3', '5', '3', '5']);
  });

  it('PNG and SVG draw every Voice in ink, never muted', () => {
    const svg = tabSvg(partOf(read(HALF_OVER_QUARTERS)), { width: 800, transparent: false, name: true }, 'Voices', 'both');
    expect(svg).toContain('data-testid="other-voice"');
    expect(svg).not.toContain('data-muted');
    expect(svg).not.toContain(MUTED_VOICE_INK);
  });

  it('MusicXML writes voice 1, a backup, then voice 2 on the staff, stems up then down; the tab staff\'s are 5 and 6', () => {
    const xml = writeMusicXml(read(HALF_OVER_QUARTERS));
    const measure = xml.slice(xml.indexOf('<measure'), xml.indexOf('</measure>'));
    const voices = [...measure.matchAll(/<voice>(\d)<\/voice>/g)].map(m => Number(m[1]));
    expect([...new Set(voices)]).toEqual([1, 2, 5, 6]);
    const firstTwo = measure.indexOf('<voice>2</voice>');
    expect(measure.lastIndexOf('<backup>', firstTwo)).toBeGreaterThan(measure.lastIndexOf('<voice>1</voice>', firstTwo));
    const stems = [...measure.matchAll(/<stem>(up|down)<\/stem>/g)].map(m => m[1]);
    expect(stems).toEqual(['up', 'up', 'up', 'down', 'down', 'down', 'down']);
  });
});

describe('the edits', () => {
  /** Voice 1 a melody on string 2, Voice 2 a held bass on string 5, in bar 1. */
  const MELODY_OVER_BASS = '\\voice 5.2.4 7.2.4 8.2.4 7.2.4 \\voice 3.5.2 5.5.2 |\n5.2.1 |';

  it('says which Voice a string is sounding in when an edit would put a second Voice on it', () => {
    const clip = read(MELODY_OVER_BASS);
    const part = partOf(clip);
    // A note on string 5 in Voice 1 while the bass sounds there.
    const typed = setFret(part, { bar: 0, column: 0, string: 4 }, 7);
    expect(clashMessage(part, typed)).toBe('String 5 is sounding in voice 2 there.');
    expect(clashMessage(part, setFret(part, { bar: 0, column: 0, string: 3 }, 7))).toBeNull();
    // A clash an import brought in stops nothing that adds no new one.
    const imported = partOf(read('\\voice 3.2.1 \\voice r.4 5.2.4 r.2 |'));
    expect(clashMessage(imported, imported)).toBeNull();
  });

  it('moves selected Voice 1 notes into Voice 2: a Gap left, Voice 2 written over at the same time, a Tie chain whole, a join dropped', () => {
    const clip = read('\\voice 5.2.4 7.2{h}.4 9.2.4 -.2.4 \\voice 3.5.4 r.4 r.2 |');
    const part = partOf(clip);
    // The third and fourth quarters, a Tie chain (written as one half note); its hammer-on from the 7 left behind goes.
    const moved = moveToVoice(clip, 0, part, { cursor: { bar: 0, column: 2, string: 1 }, selection: { anchor: 2, focus: 3 }, columnOnly: false }, 1)!;
    expect(bars(moved.clip)).toEqual(['\\voice 5.2.4 7.2.4 r.2 \\voice 3.5.4 r.4 9.2.2 |']);
    // Selected in Voice 2 now: its half note.
    expect(moved.selection).toEqual({ anchor: 2, focus: 2 });
    // A selection of the chain's first note alone takes the whole chain.
    const first = moveToVoice(clip, 0, part, { cursor: { bar: 0, column: 2, string: 1 }, selection: { anchor: 2, focus: 2 }, columnOnly: false }, 1)!;
    expect(bars(first.clip)).toEqual(bars(moved.clip));
    // Moving the 7 alone: the 9 it hammered on to, left behind, loses its hammer-on.
    const one = moveToVoice(clip, 0, part, { cursor: { bar: 0, column: 1, string: 1 }, selection: null, columnOnly: false }, 1)!;
    expect(bars(one.clip)).toEqual(['\\voice 5.2.4 r.4 9.2.2 \\voice 3.5.4 7.2.4 r.2 |']);
  });

  it('runs an edit on every Voice in a selection\'s time: Delete makes rests in both, the length keys lay each run out again', () => {
    const clip = read(MELODY_OVER_BASS);
    const part = partOf(clip);
    const selection = { anchor: 0, focus: 1 };
    expect([...voiceSelections(part, selection)]).toEqual([[1, [0, 0]]]);
    const cleared = perVoice(clip, 0, part, selection, (p, run) => clearToRests(p, run).clip);
    expect(bars(cleared)[0]).toBe('\\voice r.2 8.2.4 7.2.4 \\voice r.2 5.5.2 |');
    const shorter = perVoice(clip, 0, part, selection, (p, run) => stepDuration(p, { cursor: { bar: 0, column: 0, string: 0 }, selection: run }, -1));
    expect(bars(shorter)[0]).toBe('\\voice 5.2.8 7.2.8 r.4 8.2.4 7.2.4 \\voice 3.5.4 r.4 5.5.2 |');
  });

  it('copies two Voices with \\voice and pastes each back into its own Voice; one Voice copies by itself', () => {
    const clip = read(MELODY_OVER_BASS);
    const part = partOf(clip);
    const both = writePart(sliceVoices(part, [0, 1]));
    expect(both).toMatch(/\\voice/);
    const target = read('r.1 |\nr.1 |');
    const put = read(both.replace(/^\\title.*\n/, '').replace(/^\\voiceMode barWise\n/, ''));
    const pasted = pasteVoices(target, 0, partOf(target), { bar: 1, column: 0, string: 0 }, put, false);
    expect(bars(pasted.clip)).toEqual(['r.1 |', '\\voice 5.2.4 7.2.4 r.2 \\voice 3.5.2 r.2 |']);
    // Bar 2 has Voice 1 alone.
    expect(writePart(sliceVoices(part, [4, 4]))).not.toMatch(/\\voice/);
  });

  it('steps Alt+→ by time across Voices, Voice 1 first at the same time', () => {
    const part = partOf(read(HALF_OVER_QUARTERS));
    // From Voice 1's half note: Voice 2's first quarter starts at the same time, so it comes next.
    expect(stepAcrossVoices(part, { bar: 0, column: 0, string: 1 }, 1)).toEqual({ voice: 1, bar: 0, column: 0 });
    const second = partOf(read(HALF_OVER_QUARTERS), 0, 1);
    // From there, Voice 2's second quarter, before Voice 1's next note.
    expect(stepAcrossVoices(second, { bar: 0, column: 0, string: 4 }, 1)).toBeNull();
    // From Voice 2's second quarter, Voice 1's third note comes at the same time as Voice 2's third: Voice 1 first.
    expect(stepAcrossVoices(second, { bar: 0, column: 1, string: 4 }, 1)).toEqual({ voice: 0, bar: 0, column: 1 });
  });

  it('typing in an absent Voice 2 makes it present with its rests; taking its last note away makes it absent again', () => {
    const clip = read('5.2.1 |');
    const voice2 = partOf(clip, 0, 1);
    const typed = setFret(voice2, { bar: 0, column: 0, string: 4 }, 3);
    const withNote = (clipAction(clip, { type: 'replacePart', part: typed }) as { clip: Clip }).clip;
    expect(bars(withNote)).toEqual(['\\voice 5.2.1 \\voice 3.5.1 |']);
    const back = partOf(withNote, 0, 1);
    const emptied = clearToRests(back, { anchor: 0, focus: 0 }).clip;
    const gone = (clipAction(withNote, { type: 'replacePart', part: emptied }) as { clip: Clip }).clip;
    expect(gone.tracks[0].bars[0].voices).toHaveLength(1);
  });
});
