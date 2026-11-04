/**
 * A loop comes round with no gap (issue #346): the player's real synthesizer and soundfont, played
 * through the real output into a stand-in AudioContext, and the sound it hands the speakers measured.
 */
import { readFileSync } from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { type Part, partOf } from '@/features/tab/clip';
import { TabPlayer, type PlayerView } from '@/features/tab/playback';
import { fakeAudio, outputBuffer } from './fakeAudio';

const RATE = 44100;
/** The frames the audio node asks for at a time, as `audioOutput.ts` makes it. */
const BLOCK = 4096;
/** The clean electric guitar: the smallest of the sounds' soundfonts. */
const SOUND = 27;
/** A beat at 120 bpm, in ms. */
const BEAT = 500;

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

/** Bars of four quarter notes at 120 bpm, a fret for each bar, on the high E string. */
function bars(...frets: number[]): Part {
  return clipOf(`\\tempo 120\n.\n:4 ${frets.map(f => `${f}.1 `.repeat(4)).join('| ')}|`);
}

/**
 * The player, loaded once from the soundfonts in `public/` (decoding them takes a few seconds),
 * playing into a stand-in AudioContext.
 */
const audio = fakeAudio();
let player: TabPlayer;
/** What the player has told the view, and when (ms of sound rendered). */
let views: (Partial<PlayerView> & { ms: number })[] = [];
let frames = 0;

beforeAll(async () => {
  vi.stubGlobal('AudioContext', audio.FakeContext);
  vi.stubGlobal('fetch', async (url: string) => {
    const bytes = readFileSync(`public${url}`);
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  });
  player = await TabPlayer.create(view => views.push({ ...view, ms: (frames / RATE) * 1000 }));
  await player.setSound(SOUND);
}, 60_000);

afterAll(() => {
  player.destroy();
  vi.unstubAllGlobals();
});

/**
 * Runs every audio node playing for `seconds`, a block at a time, the clock moving with them; what
 * they hand the speakers, from the start of the test: the main sound and the dry one (the clicks).
 */
function render(seconds: number) {
  for (let n = 0; n < (seconds * RATE) / BLOCK; n++) {
    const block = { main: new Float32Array(BLOCK), dry: new Float32Array(BLOCK) };
    for (const node of audio.nodes.filter(m => m.kind === 'script' && !m.disconnected)) {
      const { channels, buffer } = outputBuffer(BLOCK);
      (node.onaudioprocess as ((e: unknown) => void) | null)?.({ outputBuffer: buffer, playbackTime: frames / RATE });
      for (let i = 0; i < BLOCK; i++) {
        block.main[i] += channels[0][i];
        block.dry[i] += channels[2][i];
      }
    }
    heard.main.push(...block.main);
    heard.dry.push(...block.dry);
    frames += BLOCK;
    vi.advanceTimersByTime((BLOCK / RATE) * 1000);
  }
  return heard;
}
let heard = { main: [] as number[], dry: [] as number[] };

/** When each sound starts, in ms: the first sample over `level` after at least 50 ms quieter than it. */
function starts(samples: number[], level: number): number[] {
  const found: number[] = [];
  let quiet = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > level) {
      if (quiet >= 0.05 * RATE) found.push((i / RATE) * 1000);
      quiet = 0;
    } else quiet++;
  }
  return found;
}

/** The time between each start and the next. */
const gaps = (times: number[]) => times.slice(1).map((t, i) => t - times[i]);

/**
 * How far each start is from a beat counted on from the first: a loop coming round late puts every
 * start after it off the beat. The synthesizer starts a note within 64 frames (1.5 ms) of its time.
 */
const offBeat = (times: number[]) => times.map((t, k) => Math.abs(t - times[0] - k * BEAT));

/** The longest run of silence after the first sound, in ms. */
function longestSilence(samples: number[]): number {
  let longest = 0;
  let run = 0;
  let begun = false;
  for (const v of samples) {
    if (Math.abs(v) > 1e-4) {
      begun = true;
      run = 0;
    } else if (begun) longest = Math.max(longest, ++run);
  }
  return (longest / RATE) * 1000;
}

describe('a loop coming round', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    player.setMetronome(false);
    player.setCountIn(false, 1);
    player.setLoopPause(0);
    views = [];
    frames = 0;
    heard = { main: [], dry: [] };
  });
  afterEach(() => {
    player.halt();
    // The stopped sound's last blocks fade out on their own nodes.
    render(0.5);
    vi.useRealTimers();
  });

  it('starts again on the beat after its last note, with no gap and nothing cut short', async () => {
        player.setMetronome(true);
    await player.play(bars(5), 0, 'whole', 1, SOUND);
    const { main, dry } = render(5);
    const clicks = starts(dry, 0.01);
    // Ten beats in five seconds, the loop's start twice among them, every one a beat after the last.
    expect(clicks.length).toBeGreaterThanOrEqual(9);
    // On the beat to within the time the synthesizer places a note in, not alphaTab's ~45 ms late.
    for (const off of offBeat(clicks)) expect(off).toBeLessThan(3);
    // The guitar sounds all the way round: its last note rings up to the next one.
    expect(longestSilence(main)).toBeLessThan(5);
  });

  it('goes round a selected bar from the bar before it, the playhead back to its start', async () => {
        player.setMetronome(true);
    // Bar 2 of 3 (its columns 4 to 7), from the start of bar 1.
    await player.play(bars(5, 7, 5), 0, [4, 7], 1, SOUND);
    const { dry } = render(8);
    const clicks = starts(dry, 0.01);
    expect(clicks.length).toBeGreaterThanOrEqual(13);
    for (const off of offBeat(clicks)) expect(off).toBeLessThan(3);
    // The playhead goes 0 to 7, then round bar 2 again and again, never into bar 3.
    const columns = views.map(v => v.column).filter((c): c is number => typeof c === 'number');
    const changes = columns.filter((c, i) => i === 0 || c !== columns[i - 1]);
    expect(changes.slice(0, 16)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 4, 5, 6, 7, 4, 5, 6, 7]);
    // And it comes back to the loop's start when that is heard, at 4 s (bar 1, then bar 2 once).
    const back = views.find((v, i) => i > 0 && v.column === 4 && v.ms > 3000)!;
    expect(back.ms).toBeGreaterThan(4000 - 100);
    expect(back.ms).toBeLessThan(4000 + 200);
  });

  it('plays the loop\'s first bar, not the count-in, when it comes round after one', async () => {
        player.setCountIn(true, 1);
    // Bars 1 and 2 looped, from bar 2: the count-in takes bar 1's place the first time only.
    await player.play(bars(5, 7), 4, [0, 7], 1, SOUND);
    const { main } = render(8);
    const notes = starts(main, 0.02);
    // Count-in (2 s), bar 2, then bars 1 and 2 round and round: a note on every beat from 2 s on.
    expect(notes[0]).toBeGreaterThan(2000 - 50);
    expect(longestSilence(main)).toBeLessThan(5);
  });

  it('still rests between loops when a rest is set', async () => {
        player.setMetronome(true);
    player.setLoopPause(1);
    await player.play(bars(5), 0, 'whole', 1, SOUND);
    const { dry } = render(7);
    const clicks = starts(dry, 0.01);
    const long = gaps(clicks).filter(gap => gap > BEAT + 100);
    // The beat before the loop's start again lasts the beat and the rest (to within an audio block or two).
    expect(long.length).toBeGreaterThanOrEqual(2);
    for (const gap of long) expect(Math.abs(gap - (BEAT + 1000))).toBeLessThan(200);
  });
});
