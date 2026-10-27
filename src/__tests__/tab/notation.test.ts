import { barHeads, keySigns, openStrings, spell, staffStep } from '@/features/tab/notation';
import type { Clip } from '@/features/tab/clip';

const name = (midi: number, fifths: number, minor = false) => {
  const n = spell(midi, minor ? { fifths, minor: true } : { fifths });
  return `${'CDEFGAB'[n.letter]}${['bb', 'b', '', '#', '##'][n.accidental + 2]}${n.octave}`;
};

describe('openStrings', () => {
  it('gives standard tuning, high e first', () => {
    expect(openStrings(['E', 'A', 'D', 'G', 'B', 'E'])).toEqual([64, 59, 55, 50, 45, 40]);
  });
  it('puts a retuned string in the octave nearest its standard one', () => {
    expect(openStrings(['D', 'A', 'D', 'G', 'B', 'E'])[5]).toBe(38);
    expect(openStrings(['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'])[0]).toBe(63);
  });
});

describe('spell', () => {
  it('spells the key\'s own notes as the key does', () => {
    expect(name(66, 1)).toBe('F#4');
    expect(name(70, -1)).toBe('Bb4');
    expect(name(65, 6)).toBe('E#4');
    expect(name(71, -7)).toBe('Cb5');
  });
  it('raises the seventh of a minor key on its own letter', () => {
    expect(name(68, 0, true)).toBe('G#4');
    expect(name(61, -1, true)).toBe('C#4');
  });
  it('sharpens other notes in sharp keys and C, flattens them in flat keys', () => {
    expect(name(61, 0)).toBe('C#4');
    expect(name(63, 1)).toBe('D#4');
    expect(name(63, -1)).toBe('Eb4');
    expect(name(66, -2)).toBe('Gb4');
  });
});

describe('staffStep', () => {
  it('counts half spaces up from the bottom line, E4', () => {
    expect(staffStep(spell(64, { fifths: 0 }))).toBe(0);
    expect(staffStep(spell(77, { fifths: 0 }))).toBe(8);
    // The low E string, written an octave up (E3), hangs under three ledger lines.
    expect(staffStep(spell(52, { fifths: 0 }))).toBe(-7);
  });
});

describe('keySigns', () => {
  it('writes sharps F C G and flats B E in their usual places', () => {
    expect(keySigns({ fifths: 3 })).toEqual([{ step: 8, sharp: true }, { step: 5, sharp: true }, { step: 9, sharp: true }]);
    expect(keySigns({ fifths: -2 }).map(k => k.step)).toEqual([4, 7]);
  });
});

describe('barHeads', () => {
  const note = (fret: number, tie = false) => ({ fret, ...(tie ? { tie: true as const } : {}) });
  const column = (s: number, fret: number, tie = false) => {
    const notes: (ReturnType<typeof note> | null)[] = Array(6).fill(null);
    notes[s] = note(fret, tie);
    return { duration: { value: 4 as const, dots: 0 as const }, notes };
  };
  const clip = (key: Clip['bars'][0]['key'], ...columns: ReturnType<typeof column>[]): Clip => ({
    name: '', time: { beats: 4, value: 4 }, tuning: ['E', 'A', 'D', 'G', 'B', 'E'], bars: [{ columns, ...(key ? { key } : {}) }],
  });

  it('shows an accidental once in a bar, and a natural after it', () => {
    // G string: fret 1 is G#, fret 1 again, fret 0 is G natural.
    const heads = barHeads(clip(undefined, column(3, 1), column(3, 1), column(3, 0)), 0);
    expect(heads.map(h => h[0].shows)).toEqual([1, null, 0]);
  });

  it('shows nothing the key signature already says', () => {
    const heads = barHeads(clip({ fifths: 1 }, column(4, 9), column(4, 8)), 0);
    // A string: fret 9 is F#, in G major; fret 8 is F natural.
    expect(heads.map(h => h[0].shows)).toEqual([null, 0]);
  });

  it('shows no sign on a tied note', () => {
    const heads = barHeads(clip(undefined, column(3, 1), column(3, 1, true)), 0);
    expect(heads.map(h => h[0].shows)).toEqual([1, null]);
  });
});

describe('a press on the staff', () => {
  it('puts the cursor on the tab note under the head pressed', async () => {
    const alphaTab = await import('@coderline/alphatab');
    const { readAlphaTexWith } = await import('@/features/tab/alphatexRead');
    const { hitTest, layoutClip, stepY } = await import('@/features/tab/layout');
    const read = readAlphaTexWith(alphaTab, '\\ts (4 4)\n(0.1 3.4).4 r.4 r.2 |\n');
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const layout = layoutClip(read.clip, 900, 'both');
    const placed = layout.systems[0].bars[0].columns[0];
    const [low, high] = placed.heads;
    const score = layout.rows.score!;
    expect(hitTest(layout, placed.x, stepY(score, high.step))).toEqual({ bar: 0, column: 0, string: 0 });
    expect(hitTest(layout, placed.x + 2, stepY(score, low.step) + 2)).toEqual({ bar: 0, column: 0, string: 3 });
    // Staff alone has no tab to put a cursor on; its presses land nowhere.
    const staffOnly = layoutClip(read.clip, 900, 'staff');
    expect(hitTest(staffOnly, placed.x, stepY(staffOnly.rows.score!, high.step))).toBeNull();
  });
});

describe('a key change at the start of a line', () => {
  it('is drawn once, as the line’s own key signature', async () => {
    const alphaTab = await import('@coderline/alphatab');
    const { readAlphaTexWith } = await import('@/features/tab/alphatexRead');
    const { layoutClip } = await import('@/features/tab/layout');
    const read = readAlphaTexWith(alphaTab, '\\ts (4 4)\n\\ks G 3.3.1 |\n\\ks F 3.3.1 |\n');
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const wide = layoutClip(read.clip, 900, 'both');
    expect(wide.systems[0].bars[1].keyX).not.toBeNull();
    const narrow = layoutClip(read.clip, 160, 'both');
    expect(narrow.systems[1].bars[0].index).toBe(1);
    expect(narrow.systems[1].bars[0].keyX).toBeNull();
  });
});

describe('time signatures with the staff shown', () => {
  it('are pressed on the staff, not the tab', async () => {
    const alphaTab = await import('@coderline/alphatab');
    const { readAlphaTexWith } = await import('@/features/tab/alphatexRead');
    const { layoutClip, stringY, textAt } = await import('@/features/tab/layout');
    const read = readAlphaTexWith(alphaTab, '\\ts (4 4)\n3.3.1 |\n');
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const both = layoutClip(read.clip, 900, 'both');
    const x = both.systems[0].timeX!;
    const score = both.rows.score!;
    expect(textAt(both, x, (score.top + score.bottom) / 2)).toEqual({ kind: 'time', bar: 0 });
    expect(textAt(both, x, stringY(both.rows, 2))).toBeNull();
    // After the clef, not in front of the lines as on the tab alone.
    expect(x).toBeGreaterThan(both.systems[0].keyX);
    const tab = layoutClip(read.clip, 900, 'tab');
    expect(tab.systems[0].timeX!).toBeLessThan(tab.systems[0].lineStart);
    expect(textAt(tab, tab.systems[0].timeX!, stringY(tab.rows, 2))).toEqual({ kind: 'time', bar: 0 });
  });
});

describe('the clef', () => {
  it('opens the key signature, even with none drawn', async () => {
    const alphaTab = await import('@coderline/alphatab');
    const { readAlphaTexWith } = await import('@/features/tab/alphatexRead');
    const { layoutClip, textAt } = await import('@/features/tab/layout');
    const read = readAlphaTexWith(alphaTab, '\\ts (4 4)\n3.3.1 |\n');
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const both = layoutClip(read.clip, 900, 'both');
    const score = both.rows.score!;
    expect(textAt(both, both.systems[0].lineStart + 12, (score.top + score.bottom) / 2)).toEqual({ kind: 'key', bar: 0 });
  });
});

describe('the bracket joining the staff and the tab', () => {
  it('has room in front of the lines in Both only', async () => {
    const alphaTab = await import('@coderline/alphatab');
    const { readAlphaTexWith } = await import('@/features/tab/alphatexRead');
    const { BRACKET_WIDTH, layoutClip } = await import('@/features/tab/layout');
    const read = readAlphaTexWith(alphaTab, '\\ts (4 4)\n3.3.1 |\n');
    if (!read.ok) throw new Error(read.errors.join('\n'));
    expect(layoutClip(read.clip, 900, 'both').systems[0].lineStart).toBeGreaterThan(BRACKET_WIDTH);
    expect(layoutClip(read.clip, 900, 'staff').systems[0].lineStart).toBeLessThan(BRACKET_WIDTH);
  });
});
