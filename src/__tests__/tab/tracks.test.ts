/**
 * A clip of several tracks (issue #237): read, kept, written and stored with every track,
 * while the page shows, edits and plays one of them as a part (#243).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex, writePart } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { setSection } from '@/features/tab/barEdits';
import { asClip, emptyClip, parseClip, partOf, trackName, withPart, type Clip } from '@/features/tab/clip';
import { clipAction, sameMusic } from '@/features/tab/clipState';
import { deleteColumns, indexOf, insertBar, removeEmptyBar, setFret } from '@/features/tab/editing';
import { perform } from '@/features/tab/playback';

/** Two guitars: the first with the repeat, section and tempo every track shares; the second in drop D, capo 2. */
const TWO = [
  '\\title "Two"',
  '\\track "Gtr I"',
  '\\instrument electricguitarclean',
  '\\ts (4 4)',
  '\\section "Riff" \\tempo 90 \\ro 5.3.2 7.3.2 | \\rc 2 8.3.1 |',
  '\\track "Gtr II"',
  '\\tuning (E4 B3 G3 D3 A2 D2)',
  '\\capo 2',
  '0.6.1 | 3.6.1 |',
  '',
].join('\n');

function read(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(result.warnings).toEqual([]);
  return result.clip;
}

/** Each track's notes, a bar a line, as alphaTex writes them. */
const notes = (clip: Clip) => clip.tracks.map((_, t) => writePart({ ...partOf(clip, t), bars: partOf(clip, t).bars.map(b => ({ columns: b.columns })) })
  .split('\n').filter(l => l && !l.startsWith('\\')).join(' '));

describe('reading and writing tracks', () => {
  const clip = read(TWO);

  it('keeps every track, each with its own name, tuning, capo and sound', () => {
    expect(clip.tracks.map(t => t.name)).toEqual(['Gtr I', 'Gtr II']);
    expect(clip.tracks[0].instrument).toEqual({ program: 27, tag: '\\instrument electricguitarclean' });
    expect(clip.tracks[1].instrument).toBeUndefined();
    expect(clip.tracks[1].tuning).toEqual(['D', 'A', 'D', 'G', 'B', 'E']);
    expect(clip.tracks[1].capo).toBe(2);
    expect(clip.tracks[0].capo).toBeUndefined();
  });

  it('gives the bar marks to the clip, once for every track', () => {
    expect(clip.masterBars).toEqual([{ section: { text: 'Riff' }, tempo: { bpm: 90 }, repeatStart: true }, { repeatEnd: 2 }]);
    expect(partOf(clip, 1).bars[0]).toMatchObject({ section: { text: 'Riff' }, repeatStart: true, columns: [{ notes: [null, null, null, null, null, { fret: 0 }] }] });
    expect(clip.tracks.every(t => t.bars.length === 2)).toBe(true);
  });

  it('writes the clip back as it was written, the marks in the first track only', () => {
    expect(writeAlphaTex(clip)).toBe(TWO);
  });

  it('writes a \\track for each track that has none, once there is more than one', () => {
    const second = { ...clip.tracks[1], tag: undefined, name: '' };
    const first = { ...clip.tracks[0], tag: undefined };
    const text = writeAlphaTex({ ...clip, tracks: [first, second] });
    expect(text).toContain('\\track "Gtr I"\n');
    expect(text).toMatch(/\n\\track\n/);
    expect(read(text).tracks).toHaveLength(2);
  });

  it('writes one track with no \\track as before', () => {
    expect(writeAlphaTex(read('\\ts (4 4)\n5.3.1 |\n'))).toBe('\\ts (4 4)\n5.3.1 |\n');
  });

  it('keeps a track\'s own kept lines after its \\track, and the clip\'s before it', () => {
    const text = '\\title "Kept"\n\\artist "Me"\n\\track "A"\n\\staff {score tabs}\n\\ts (4 4)\n5.3.1 |\n\\track "B"\n\\staff {tabs}\n7.3.1 |\n';
    const result = readAlphaTexWith(alphaTab, text);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.clip.header).toEqual(['\\artist "Me"']);
    expect(result.clip.tracks.map(t => t.header)).toEqual([['\\staff {score tabs}'], ['\\staff {tabs}']]);
    expect(writeAlphaTex(result.clip)).toBe(text);
  });

  it('names the track a bar that doesn\'t add up is in', () => {
    const result = readAlphaTexWith(alphaTab, '\\track "A"\n5.3.1 |\n\\track "B"\n7.3.2 |\n');
    expect(result.ok && result.warnings).toEqual(['B: Bar 1 doesn\'t add up to 4/4: 2 beats short.']);
  });
});

describe('the first track as a part', () => {
  const clip = read(TWO);
  const part = partOf(clip);

  it('carries its tuning, capo and sound, and the clip\'s bar marks', () => {
    expect(part.tuning).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
    expect(part.capo).toBeUndefined();
    expect(part.instrument?.program).toBe(27);
    expect(part.bars.map(b => b.columns.length)).toEqual([2, 1]);
    expect(part.bars[1].repeatEnd).toBe(2);
  });

  it('puts an edit back with the other tracks as they were', () => {
    const edited = withPart(clip, setFret(part, { bar: 1, column: 0, string: 2 }, 10));
    expect(notes(edited)).toEqual(['5.3.2 7.3.2 | 10.3.1 |', '0.6.1 | 3.6.1 |']);
    expect(edited.tracks[1]).toBe(clip.tracks[1]);
  });

  it('gives the other tracks a bar of rests where an edit adds one, and takes theirs away with it', () => {
    const added = withPart(clip, insertBar(part, { bar: 0, column: 0, string: 0 }, 'after').clip);
    expect(notes(added)).toEqual(['5.3.2 7.3.2 | r.1 | 8.3.1 |', '0.6.1 | r.1 | 3.6.1 |']);
    expect(added.masterBars).toEqual([clip.masterBars[0], {}, clip.masterBars[1]]);
    const shown = partOf(added);
    const emptied = deleteColumns(shown, [indexOf(shown, 1, 0), indexOf(shown, 1, 0)]).clip;
    const gone = withPart(added, removeEmptyBar(emptied, 1).clip);
    expect(notes(gone)).toEqual(['5.3.2 7.3.2 | 8.3.1 |', '0.6.1 | 3.6.1 |']);
  });

  it('keeps a bar an edit empties while another track has music in it, as rests in the edited track', () => {
    const added = withPart(clip, insertBar(part, { bar: 0, column: 0, string: 0 }, 'after').clip);
    const shown = partOf(added);
    // Bars 1 and 2 go from Gtr I: Gtr II has only rests in the first, a note in the other.
    const gone = withPart(added, deleteColumns(shown, [indexOf(shown, 0, 0), indexOf(shown, 1, 0)]).clip);
    expect(notes(gone)).toEqual(['r.1 | 8.3.1 |', '0.6.1 | 3.6.1 |']);
    expect(gone.masterBars).toEqual(clip.masterBars);
    // From Gtr II, which shares the bars with Gtr I's music, nothing goes but its notes.
    const second = partOf(clip, 1);
    const cleared = withPart(clip, deleteColumns(second, [0, 1]).clip, 1);
    expect(notes(cleared)).toEqual(['5.3.2 7.3.2 | 8.3.1 |', 'r.1 | r.1 |']);
    expect(cleared.masterBars).toEqual(clip.masterBars);
  });

  it('edits any track, the others kept', () => {
    const second = partOf(clip, 1);
    expect(second.tuning).toEqual(clip.tracks[1].tuning);
    const edited = withPart(clip, setFret(second, { bar: 0, column: 0, string: 5 }, 2), 1);
    expect(notes(edited)).toEqual(['5.3.2 7.3.2 | 8.3.1 |', '2.6.1 | 3.6.1 |']);
    expect(edited.tracks[0]).toBe(clip.tracks[0]);
    const action = clipAction(clip, { type: 'replacePart', part: setFret(second, { bar: 0, column: 0, string: 5 }, 2) }, 1);
    expect(action.type === 'replace' && notes(action.clip)).toEqual(notes(edited));
  });

  it('makes a bar mark set on it every track\'s', () => {
    const marked = withPart(clip, setSection(part, 1, 'Out'));
    expect(marked.masterBars[1]).toEqual({ repeatEnd: 2, section: { text: 'Out' } });
    expect(partOf(marked, 1).bars[1].section).toEqual({ text: 'Out' });
  });

  it('keeps its bars the same for a new sound, so playback carries on', () => {
    const louder = withPart(clip, { ...part, instrument: { program: 25 } });
    expect(louder.masterBars).toBe(clip.masterBars);
    expect(sameMusic(partOf(louder), part)).toBe(true);
    expect(sameMusic(louder, clip)).toBe(true);
  });

  it('goes back into the whole clip through the page\'s actions, a preview too', () => {
    const edited = setFret(part, { bar: 0, column: 0, string: 2 }, 3);
    const action = clipAction(clip, { type: 'replacePart', part: edited, from: part });
    expect(action.type === 'replace' && action.clip.tracks[1]).toBe(clip.tracks[1]);
    expect(action.type === 'replace' && action.from?.masterBars).toBe(clip.masterBars);
    expect(clipAction(clip, { type: 'previewPart', part: edited })).toMatchObject({ type: 'preview' });
    expect(clipAction(clip, { type: 'undo' })).toEqual({ type: 'undo' });
  });

  it('is played alone', () => {
    const played = perform(alphaTab, part, undefined, { clicks: false });
    const notesOn = played.midi.events.filter(e => e.type === alphaTab.midi.MidiEventType.NoteOn);
    // Its three notes, the repeat playing them twice; none of the second track's.
    expect(notesOn).toHaveLength(6);
  });

  it('is a clip of one track by itself, for the clipboard', () => {
    const alone = asClip(part);
    expect(alone.tracks).toHaveLength(1);
    expect(alone.tracks[0].tag).toBeUndefined();
    expect(writeAlphaTex(alone)).not.toContain('\\track');
  });
});

describe('a stored clip of several tracks', () => {
  const clip = read(TWO);

  it('keeps every track', () => {
    expect(parseClip(JSON.parse(JSON.stringify(clip)))).toEqual(clip);
  });

  it('is refused with no tracks, or a track short of bars', () => {
    expect(parseClip({ ...clip, tracks: [] })).toBeNull();
    expect(parseClip({ ...clip, tracks: [clip.tracks[0], { ...clip.tracks[1], bars: [clip.tracks[1].bars[0]] }] })).toBeNull();
    expect(parseClip(emptyClip())).not.toBeNull();
  });
});

describe('a track\'s name', () => {
  it('is its own, else its number', () => {
    const clip = read(TWO);
    expect(trackName(clip, 1)).toBe('Gtr II');
    expect(trackName({ ...clip, tracks: [clip.tracks[0], { ...clip.tracks[1], name: ' ' }] }, 1)).toBe('Track 2');
  });
});

describe('the tracks in tab-alphatex.txt', () => {
  it('read as the guide says, two tracks of two bars each, with no warnings', () => {
    const doc = readFileSync(join(__dirname, '../../../public/tab-alphatex.txt'), 'utf8');
    const snippet = doc.split('\nTracks. ')[1].split('\n\n')[1].split('\n').map(l => l.slice(4)).join('\n');
    const clip = read(snippet);
    expect(clip.tracks.map(t => [t.name, t.bars.length])).toEqual([['Gtr I', 2], ['Gtr II', 2]]);
    expect(clip.masterBars[1].repeatEnd).toBe(2);
    expect(`${writeAlphaTex(clip)}`).toBe(`${snippet}\n`);
  });
});
