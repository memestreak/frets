/**
 * How chords roll in playback (issue #385): Downstroke and Upstroke strum a little, Strum down or up
 * and Rolled chords roll by the amount set, each can be off, and a written length wins.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { type Part, partOf } from '@/features/tab/clip';
import { DEFAULT_SOUND, perform } from '@/features/tab/playback';
import { DEFAULT_PLAYBACK, parsePlaybackSettings, rollsOf } from '@/features/tab/PlaybackFooter';
import { DEFAULT_ROLLS, type Rolls } from '@/features/tab/rolls';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

/** alphaTab's ticks: 960 to a quarter note. */
const Q = 960;

/** Each note's start, in ticks from the first note, by MIDI key, in the order the notes start. */
function onsets(text: string, rolls: Rolls = DEFAULT_ROLLS): { key: number; at: number }[] {
  const { midi } = perform(alphaTab, clipOf(text), DEFAULT_SOUND, { clicks: false, rolls });
  const ons = midi.events.filter((e): e is alphaTab.midi.NoteOnEvent => e instanceof alphaTab.midi.NoteOnEvent);
  const first = Math.min(...ons.map(e => e.tick));
  return ons.map(e => ({ key: e.noteKey, at: e.tick - first })).sort((a, b) => a.at - b.at || a.key - b.key);
}

/** An open E major chord, low E to high e, as one quarter note (strings 6 to 1). */
const E = '(0.6 2.5 2.4 1.3 0.2 0.1).4';
const keysLowToHigh = [40, 47, 52, 56, 59, 64];

const span = (notes: { at: number }[]) => Math.max(...notes.map(n => n.at)) - Math.min(...notes.map(n => n.at));

describe('chord rolls', () => {
  it('strums a Downstroke chord low string first, over its share of the chord', () => {
    const notes = onsets(`${E}{sd} |`);
    expect(notes.map(n => n.key)).toEqual(keysLowToHigh);
    // 3% of a quarter note, a fifth of it between each string.
    expect(span(notes)).toBe(Math.floor(0.03 * Q / 5) * 5);
    expect(span(notes)).toBeGreaterThan(0);
  });

  it('strums an Upstroke chord high string first', () => {
    expect(onsets(`${E}{su} |`).map(n => n.key)).toEqual([...keysLowToHigh].reverse());
  });

  it('takes the amount set, as a share of the chord’s own length', () => {
    expect(span(onsets(`${E}{sd} |`, { ...DEFAULT_ROLLS, strokes: 0.25 }))).toBe(240);
    expect(span(onsets(`(0.6 2.5 2.4 1.3 0.2 0.1).2{sd} |`, { ...DEFAULT_ROLLS, strokes: 0.25 }))).toBe(480);
  });

  it('leaves a single note with a Downstroke as it is', () => {
    expect(onsets('0.6.4{sd} 0.6.4 |').map(n => n.at)).toEqual([0, Q]);
  });

  it('plays a Downstroke chord at once with Downstroke strums off', () => {
    expect(span(onsets(`${E}{sd} |`, { ...DEFAULT_ROLLS, strokes: 0 }))).toBe(0);
  });

  it('plays a chord with no mark at once', () => {
    expect(span(onsets(`${E} |`, { strokes: 0.5, strums: 0.5, rolledChords: 0.5 }))).toBe(0);
  });

  it('rolls a Strum and a Rolled chord by their own amounts, each changing only its own kind', () => {
    const rolls = { strokes: 0.1, strums: 0.25, rolledChords: 0.5 };
    expect(span(onsets(`${E}{bd} |`, rolls))).toBe(240);
    expect(span(onsets(`${E}{au} |`, rolls))).toBe(480);
    expect(span(onsets(`${E}{sd} |`, rolls))).toBe(Math.floor(96 / 5) * 5);
    expect(onsets(`${E}{bu} |`, rolls).map(n => n.key)).toEqual([...keysLowToHigh].reverse());
    // A Strum takes over from a Downstroke on the same chord: one strum, at the Strum's length.
    expect(span(onsets(`${E}{sd bd} |`, rolls))).toBe(240);
  });

  it('plays a Strum and a Rolled chord at once when each is off', () => {
    const off = { strokes: 0.1, strums: 0, rolledChords: 0 };
    expect(span(onsets(`${E}{bd} |`, off))).toBe(0);
    expect(span(onsets(`${E}{ad} |`, off))).toBe(0);
  });

  it('keeps a length written in the clip over the setting', () => {
    expect(span(onsets(`${E}{bd 100} |`, { strokes: 0, strums: 0, rolledChords: 0 }))).toBe(100);
    expect(span(onsets(`${E}{ad 400} |`))).toBe(400);
  });

  it('rolls a chord in another Voice of the bar', () => {
    const notes = onsets(`\\voice 0.1.4 0.1.4 0.1.4 0.1.4 | \\voice (0.6 2.5 2.4).4{su} r.4 r.2 |`, { ...DEFAULT_ROLLS, strokes: 0.5 });
    expect(notes.filter(n => n.key !== 64).map(n => n.key)).toEqual([52, 47, 40]);
  });
});

describe('roll settings', () => {
  it('plays the rolls set, off as at once', () => {
    expect(rollsOf(DEFAULT_PLAYBACK)).toEqual(DEFAULT_ROLLS);
    expect(rollsOf({ ...DEFAULT_PLAYBACK, strokes: false, strumsRoll: 12.5 })).toEqual({ ...DEFAULT_ROLLS, strokes: 0, strums: 0.125 });
  });

  it('reads each saved roll, rejecting bad values', () => {
    const saved = parsePlaybackSettings({ strokes: false, strokesRoll: 3.5, strums: false, strumsRoll: 50, rolledChords: false, rolledChordsRoll: 100 });
    expect(saved).toMatchObject({ strokes: false, strokesRoll: 3.5, strums: false, strumsRoll: 50, rolledChords: false, rolledChordsRoll: 100 });
    for (const bad of [0, -1, 101, 2.3, '5', null]) {
      const read = parsePlaybackSettings({ strokesRoll: bad, strumsRoll: bad, rolledChordsRoll: bad });
      expect(read).toMatchObject({ strokesRoll: 3, strumsRoll: 5, rolledChordsRoll: 20 });
    }
    expect(parsePlaybackSettings({ strokes: 'no' }).strokes).toBe(true);
  });
});
