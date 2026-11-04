/**
 * Voices in the Clip and in alphaTex: read both ways, written bar-wise, carried through the part,
 * edits, copy, playback and Guitar Pro (`docs/specs/2026-11-03-tab-voices-design.md`).
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import {
  barErrors, parseClip, partOf, stringClashes, unevenMessage, withPart, type Clip, type Column,
} from '@/features/tab/clip';
import { deleteColumns } from '@/features/tab/editing';
import { clearToRests } from '@/features/tab/noteEdits';
import { writeGuitarProWith } from '@/features/tab/guitarPro';
import { multiRests } from '@/features/tab/layout';
import { DEFAULT_SOUND, perform } from '@/features/tab/playback';
import { readVoice } from '@/features/tab/sounding';

function read(text: string) {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result;
}
const clipOf = (text: string): Clip => read(text).clip;

/** A Voice's Columns as frets and lengths: "3.3:1" a whole note on string 3, "r:4" a quarter rest. */
const shown = (columns: Column[]) => columns.map(c => {
  const notes = c.notes.flatMap((n, s) => (n ? [`${n.tie ? '-' : n.fret}.${s + 1}`] : []));
  return `${notes.length ? notes.join('+') : 'r'}:${c.duration.value}`;
}).join(' ');

const BAR_WISE = '\\voiceMode barWise\n\\ts (4 4)\n\\voice 3.3.4 5.3.4 r.2 \\voice 0.6.2 0.6.2 |\n1.1.1 |';
const STAFF_WISE = '\\ts (4 4)\n\\voice 3.3.4 5.3.4 r.2 | 1.1.1 |\n\\voice 0.6.2 0.6.2 | r.1 |';

describe('reading Voices', () => {
  it('reads bar-wise and staff-wise text to the same clip, a Voice with no notes absent from its bar', () => {
    const a = clipOf(BAR_WISE);
    const b = clipOf(STAFF_WISE);
    expect(a.tracks).toEqual(b.tracks);
    const [one, two] = a.tracks[0].bars;
    expect(one.voices.map(shown)).toEqual(['3.3:4 5.3:4 r:2', '0.6:2 0.6:2']);
    expect(two.voices.map(shown)).toEqual(['1.1:1']);
  });

  it('reads a Voice 2 of only rests in a bar as absent there', () => {
    const clip = clipOf('\\voiceMode barWise \\ts (4 4) \\voice 1.1.1 \\voice r.1 |');
    expect(clip.tracks[0].bars[0].voices).toHaveLength(1);
  });

  it('reads up to 4 Voices and refuses 5', () => {
    const four = '\\voiceMode barWise \\ts (4 4) \\voice 1.1.1 \\voice 1.2.1 \\voice 1.3.1 \\voice 1.4.1 |';
    expect(clipOf(four).tracks[0].bars[0].voices.map(shown)).toEqual(['1.1:1', '1.2:1', '1.3:1', '1.4:1']);
    const five = four.replace(' |', ' \\voice 1.5.1 |');
    const result = readAlphaTexWith(alphaTab, five);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual(['Frets reads up to 4 voices; this has 5.']);
  });

  it('no longer warns of a second Voice: every Voice is drawn (step 9, Q15)', () => {
    const second = read('\\voiceMode barWise \\ts (4 4) 1.1.1 | 1.1.1 | \\voice 1.1.1 \\voice 0.6.1 | \\voice 1.1.1 \\voice 0.6.1 | 1.1.1 |');
    expect(second.warnings).toEqual([]);
    const more = read('\\voiceMode barWise \\ts (4 4) \\voice 1.1.1 \\voice 0.6.1 \\voice 0.5.1 | 1.1.1 |');
    expect(more.warnings).toEqual([]);
  });

  it('warns of two Voices on one string at once, strings numbered as tab numbers them', () => {
    const result = read('\\voiceMode barWise \\ts (4 4) \\voice 3.2.1 \\voice r.4 5.2.4 r.2 |');
    expect(result.warnings).toContain('Bar 1 has two voices on string 2.');
    // One after the other on a string is no clash.
    const after = read('\\voiceMode barWise \\ts (4 4) \\voice 3.2.2 r.2 \\voice r.2 5.2.2 |');
    expect(after.warnings.filter(w => w.includes('two voices'))).toEqual([]);
  });

  it('names a Voice 2 bar that doesn\'t add up, in the line and the bar\'s ⚠', () => {
    const result = read('\\voiceMode barWise \\ts (4 4) \\voice 1.1.1 \\voice 0.6.2{d} | 1.1.1 |');
    expect(result.warnings).toContain("Bar 1's voice 2 doesn't add up to 4/4: 1 beat short.");
    const part = partOf(result.clip);
    expect(unevenMessage(part)).toBe("Bar 1's voice 2 doesn't add up to 4/4: 1 beat short.");
    expect(barErrors(part).get(0)).toBe("Bar 1's voice 2 doesn't add up to 4/4: 1 beat short.");
  });

  it('joins a hammer-on in Voice 2 from Voice 2\'s previous note on the string, not Voice 1\'s', () => {
    const clip = clipOf('\\voiceMode barWise \\ts (4 4) \\voice 5.3.2 r.2 \\voice 2.3{h}.4 4.3.4 r.2 |');
    const [v1, v2] = clip.tracks[0].bars[0].voices;
    expect(v1[0].notes[2]).toEqual({ fret: 5 });
    expect(v2[1].notes[2]).toEqual({ fret: 4, legato: 'h' });
  });

  it('keeps each Track\'s own Voices', () => {
    const clip = clipOf('\\voiceMode barWise \\track "A" \\ts (4 4) \\voice 3.3.1 \\voice 0.6.1 | 1.1.1 |\n\\track "B"\n1.1.1 | \\voice 2.2.1 \\voice 0.5.1 |');
    expect(clip.tracks[0].bars.map(b => b.voices.length)).toEqual([2, 1]);
    expect(clip.tracks[1].bars.map(b => b.voices.length)).toEqual([1, 2]);
    expect(clipOf(writeAlphaTex(clip)).tracks).toEqual(clip.tracks);
  });
});

describe('writing Voices', () => {
  it('writes \\voiceMode barWise once and each bar\'s Voices together, and reads back the same', () => {
    const clip = clipOf(STAFF_WISE);
    const text = writeAlphaTex(clip);
    expect(text).toBe('\\voiceMode barWise\n\\ts (4 4)\n\\voice 3.3.4 5.3.4 r.2 \\voice 0.6.2 0.6.2 | 1.1.1 |\n');
    expect(text.match(/\\voiceMode/g)).toHaveLength(1);
    expect(clipOf(text).tracks).toEqual(clip.tracks);
  });

  it('writes no \\voice or \\voiceMode for one Voice', () => {
    const text = writeAlphaTex(clipOf('\\ts (4 4) 3.3.4 5.3.4 r.2 |'));
    expect(text).not.toMatch(/\\voice/);
  });

  it('writes an absent Voice 2 between Voices 1 and 3 as rests the bar\'s length, read back absent', () => {
    const clip = clipOf('\\voiceMode barWise \\ts (3 4) \\voice 1.1.2{d} \\voice r.2{d} \\voice 0.6.2{d} |');
    expect(clip.tracks[0].bars[0].voices.map(shown)).toEqual(['1.1:2', '', '0.6:2']);
    const text = writeAlphaTex(clip);
    expect(text).toContain('\\voice 1.1.2{d} \\voice r.2{d} \\voice 0.6.2{d} |');
    expect(clipOf(text).tracks).toEqual(clip.tracks);
  });
});

describe('a part is one Voice', () => {
  const clip = clipOf(BAR_WISE);

  it('gives Voice 2\'s Columns with partOf(clip, 0, 1), and withPart puts them back, Voice 1 untouched', () => {
    const two = partOf(clip, 0, 1);
    expect(two.voice).toBe(1);
    expect(shown(two.bars[0].columns)).toBe('0.6:2 0.6:2');
    expect(two.bars[0].otherVoices?.map(o => o.voice)).toEqual([0]);
    const edited = { ...two, bars: two.bars.map((bar, b) => (b === 0 ? { ...bar, columns: [{ ...bar.columns[0], duration: { value: 1 as const, dots: 0 as const } }] } : bar)) };
    const back = withPart(clip, edited);
    expect(back.tracks[0].bars[0].voices.map(shown)).toEqual(['3.3:4 5.3:4 r:2', '0.6:1']);
  });

  it('reads the part\'s own Voice as Sounding notes', () => {
    expect(readVoice(partOf(clip, 0, 1)).notes.map(n => [n.voice, n.string, n.start])).toEqual([[1, 5, 0], [1, 5, 1774080]]);
    expect(readVoice(partOf(clip)).voice).toBe(0);
  });

  it('gives a bar an edit adds no other Voices', () => {
    const part = partOf(clip);
    const added = { ...part, bars: [...part.bars, { columns: [] }] };
    expect(withPart(clip, added).tracks[0].bars[2].voices).toEqual([[]]);
  });

  it('keeps a bar taken away while a hidden Voice has notes in it, Voice 1 as rests', () => {
    const part = partOf(clip);
    const back = withPart(clip, { ...part, bars: part.bars.slice(1) });
    expect(back.tracks[0].bars).toHaveLength(2);
    expect(back.tracks[0].bars[0].voices.map(shown)).toEqual(['r:1', '0.6:2 0.6:2']);
    // A bar with nothing hidden goes.
    const gone = withPart(clip, { ...part, bars: part.bars.slice(0, 1) });
    expect(gone.tracks[0].bars).toHaveLength(1);
  });

  it('leaves Voice 2 alone on cut and Delete of Voice 1 by itself, and pulls it back with Ctrl/⌘+Delete', () => {
    const part = partOf(clip);
    const cut = clearToRests(part, { anchor: 0, focus: 2 }).clip;
    expect(withPart(clip, cut).tracks[0].bars[0].voices[1]).toEqual(clip.tracks[0].bars[0].voices[1]);
    // Taking time moves every Voice of the Track, so Voice 2 keeps its place against Voice 1 (step 4, Q2).
    const deleted = deleteColumns(part, [0, 1]).clip;
    expect(withPart(clip, deleted).tracks[0].bars[0].voices.map(shown)).toEqual(['r:2 1.1:2', '0.6:2 r:2']);
  });

  it('gathers a bar into a multi-bar rest only when every Voice rests in it', () => {
    const rests = clipOf('\\multiBarRest \\voiceMode barWise \\ts (4 4) r.1 | r.1 | \\voice r.1 \\voice 0.6.1 | r.1 | r.1 | 1.1.1 |');
    expect([...multiRests(partOf(rests))]).toEqual([[0, 2], [3, 2]]);
  });

  it('finds no two Voices on one string in the part shown', () => {
    expect(stringClashes(partOf(clip))).toEqual([]);
  });
});

describe('stored clips', () => {
  const clip = clipOf(BAR_WISE);

  it('checks voices: 1 to 4, each of Columns', () => {
    expect(parseClip(JSON.parse(JSON.stringify(clip)))).toEqual(clip);
    const withVoices = (voices: unknown) => ({ ...clip, tracks: [{ ...clip.tracks[0], bars: clip.tracks[0].bars.map(() => ({ voices })) }] });
    expect(parseClip(withVoices([]))).toBeNull();
    expect(parseClip(withVoices([[], [], [], [], []]))).toBeNull();
    expect(parseClip(withVoices([[], [], [], []]))).not.toBeNull();
    expect(parseClip(withVoices([[{ duration: { value: 3, dots: 0 }, notes: [] }]]))).toBeNull();
  });
});

describe('playback and Guitar Pro hold every Voice', () => {
  const noteEvents = (text: string) => {
    const { midi } = perform(alphaTab, partOf(clipOf(text)), DEFAULT_SOUND, { clicks: false });
    return midi.events
      .filter(e => e instanceof alphaTab.midi.NoteOnEvent || e instanceof alphaTab.midi.NoteOffEvent)
      .map(e => `${e instanceof alphaTab.midi.NoteOnEvent ? 'on' : 'off'} ${e.tick} ${(e as alphaTab.midi.NoteOnEvent).noteKey}`);
  };

  it('plays both Voices', () => {
    // E2 (40) in Voice 2 under G4 (67) in Voice 1.
    expect(noteEvents('\\voiceMode barWise \\ts (4 4) \\voice 3.1.1 \\voice 0.6.1 |')).toEqual(
      expect.arrayContaining(['on 0 67', 'on 0 40']),
    );
  });

  it('cuts a Voice 1 note off where Voice 2 plays on its string', () => {
    // G3 held on string 3 in Voice 1; Voice 2 plays A3 on string 3 on beat 2, a quarter in.
    expect(noteEvents('\\voiceMode barWise \\ts (4 4) \\voice 0.3.1 \\voice r.4 2.3.4 r.2 |')).toEqual([
      'on 0 55', 'off 960 55', 'on 960 57', 'off 1920 57',
    ]);
  });

  it('writes both Voices into the Guitar Pro file', () => {
    const bytes = writeGuitarProWith(alphaTab, clipOf(BAR_WISE));
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, new alphaTab.Settings());
    const bar = score.tracks[0].staves[0].bars[0];
    expect(bar.voices.filter(v => !v.isEmpty)).toHaveLength(2);
    expect(bar.voices[1].beats.map(b => b.notes.map(n => n.fret))).toEqual([[0], [0]]);
  });
});
