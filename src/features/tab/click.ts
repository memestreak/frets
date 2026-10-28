/**
 * The metronome's click (issue #148): a short wood-block-like tick, synthesized, so it needs no
 * recording and the stand-alone Metronome page (issue #149) can play the very same sound. Beat one
 * has its own, higher click.
 *
 * `clickWave` makes the samples; `clickSoundFont` wraps both clicks in a tiny SoundFont 2 file, so
 * alphaTab's synthesizer plays them in time with the clip (`playback.ts`).
 */

/** The sample rate the clicks are made at: the synthesizer's (`audioOutput.ts`). */
export const CLICK_SAMPLE_RATE = 44100;
/** How long a click lasts, in seconds; it has died away to silence by then. */
const CLICK_SECONDS = 0.06;
/** The click's pitch, in hertz: beat one's, and every other beat's. */
const ACCENT_HZ = 2100;
const BEAT_HZ = 1400;
/**
 * A wood block's ring is not harmonic: two partials above the fundamental, as ratios of it, and
 * how loud each is. The decay (in seconds, to about a third) keeps it short and dry.
 */
const PARTIALS: readonly (readonly [ratio: number, level: number])[] = [[1, 1], [2.41, 0.35], [3.93, 0.15]];
const DECAY_SECONDS = 0.011;
/** The attack, in seconds: a cut straight into the wave would itself click. */
const ATTACK_SECONDS = 0.0008;

/** The click's samples, mono, from -1 to 1: beat one's (`accent`), or any other beat's. */
export function clickWave(accent: boolean, sampleRate = CLICK_SAMPLE_RATE): Float32Array {
  const pitch = accent ? ACCENT_HZ : BEAT_HZ;
  const length = Math.round(CLICK_SECONDS * sampleRate);
  const wave = new Float32Array(length);
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / ATTACK_SECONDS);
    // The last few milliseconds fade to exactly nothing, so the end makes no click either.
    const tail = Math.min(1, (length - 1 - i) / (0.005 * sampleRate));
    let x = 0;
    for (const [ratio, level] of PARTIALS) x += level * Math.sin(2 * Math.PI * pitch * ratio * t);
    wave[i] = x * attack * tail * Math.exp(-t / DECAY_SECONDS);
    peak = Math.max(peak, Math.abs(wave[i]));
  }
  // Beat one a little louder than the others.
  const level = (accent ? 0.9 : 0.7) / peak;
  for (let i = 0; i < length; i++) wave[i] *= level;
  return wave;
}

/* — the clicks as a SoundFont 2 file, for alphaTab's synthesizer — */

/** The SoundFont bank and program the clicks are in: a bank no General MIDI sound uses. */
export const CLICK_BANK = 120;
export const CLICK_PROGRAM = 0;
/** The keys that play the clicks: General MIDI's high and low wood block. */
export const ACCENT_KEY = 76;
export const BEAT_KEY = 77;

// SoundFont 2 generator numbers (SF2.04, section 8.1.2).
const GEN_INSTRUMENT = 41;
const GEN_KEY_RANGE = 43;
const GEN_SAMPLE_ID = 53;
/** sampleType: a mono sample. */
const MONO = 1;
/** Zero samples the format wants after each sample. */
const SAMPLE_PAD = 46;

class Bytes {
  private parts: Uint8Array[] = [];
  length = 0;
  push(bytes: Uint8Array) {
    this.parts.push(bytes);
    this.length += bytes.length;
    return this;
  }
  /** Little-endian numbers, each of `size` bytes (1, 2 or 4). */
  numbers(size: 1 | 2 | 4, ...values: number[]) {
    const out = new Uint8Array(size * values.length);
    const view = new DataView(out.buffer);
    values.forEach((v, i) => {
      if (size === 1) view.setUint8(i, v & 0xff);
      else if (size === 2) view.setUint16(i * 2, v & 0xffff, true);
      else view.setUint32(i * 4, v >>> 0, true);
    });
    return this.push(out);
  }
  /** Text in a fixed number of bytes, zero-padded. */
  text(value: string, size: number) {
    const out = new Uint8Array(size);
    for (let i = 0; i < Math.min(value.length, size - 1); i++) out[i] = value.charCodeAt(i) & 0x7f;
    return this.push(out);
  }
  bytes(): Uint8Array {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const part of this.parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }
}

/** A RIFF chunk: its tag, size and body. Every body here has an even size, as alphaTab's reader needs. */
function chunk(tag: string, body: Uint8Array): Uint8Array {
  return new Bytes().push(new TextEncoder().encode(tag)).numbers(4, body.length).push(body).bytes();
}

function list(kind: string, ...chunks: Uint8Array[]): Uint8Array {
  const body = new Bytes().push(new TextEncoder().encode(kind));
  for (const c of chunks) body.push(c);
  return chunk('LIST', body.bytes());
}

/**
 * Both clicks as a SoundFont 2 file: one preset (`CLICK_BANK`, `CLICK_PROGRAM`) whose `ACCENT_KEY`
 * plays beat one's click and `BEAT_KEY` the others', each at its own pitch whatever the key.
 */
export function clickSoundFont(): Uint8Array {
  const waves = [clickWave(true), clickWave(false)];
  const keys = [ACCENT_KEY, BEAT_KEY];

  const smpl = new Bytes();
  const shdr = new Bytes();
  let start = 0;
  waves.forEach((wave, i) => {
    const pcm = new Int16Array(wave.length + SAMPLE_PAD);
    wave.forEach((x, j) => (pcm[j] = Math.round(Math.max(-1, Math.min(1, x)) * 32767)));
    smpl.push(new Uint8Array(pcm.buffer));
    const end = start + wave.length;
    shdr.text(i === 0 ? 'Click accent' : 'Click', 20).numbers(4, start, end, start, end, CLICK_SAMPLE_RATE)
      .numbers(1, keys[i], 0).numbers(2, 0, MONO);
    start = end + SAMPLE_PAD;
  });
  shdr.text('EOS', 20).numbers(4, 0, 0, 0, 0, 0).numbers(1, 0, 0).numbers(2, 0, 0);

  // The preset: one zone, the instrument.
  const phdr = new Bytes().text('Metronome', 20).numbers(2, CLICK_PROGRAM, CLICK_BANK, 0).numbers(4, 0, 0, 0)
    .text('EOP', 20).numbers(2, 0, 0, 1).numbers(4, 0, 0, 0);
  const pbag = new Bytes().numbers(2, 0, 0, 1, 0);
  const pgen = new Bytes().numbers(2, GEN_INSTRUMENT, 0, 0, 0);
  // The instrument: a zone per click, its key range first and its sample last, as the format orders them.
  const inst = new Bytes().text('Metronome', 20).numbers(2, 0).text('EOI', 20).numbers(2, keys.length);
  const ibag = new Bytes();
  const igen = new Bytes();
  keys.forEach((key, i) => {
    ibag.numbers(2, i * 2, 0);
    igen.numbers(2, GEN_KEY_RANGE, key | (key << 8), GEN_SAMPLE_ID, i);
  });
  ibag.numbers(2, keys.length * 2, 0);
  igen.numbers(2, 0, 0);
  const noModulators = new Uint8Array(10);

  const riff = new Bytes().push(new TextEncoder().encode('sfbk'))
    .push(list('INFO',
      chunk('ifil', new Bytes().numbers(2, 2, 1).bytes()),
      chunk('isng', new Bytes().text('EMU8000', 8).bytes()),
      chunk('INAM', new Bytes().text('Frets metronome', 16).bytes())))
    .push(list('sdta', chunk('smpl', smpl.bytes())))
    .push(list('pdta',
      chunk('phdr', phdr.bytes()), chunk('pbag', pbag.bytes()), chunk('pmod', noModulators), chunk('pgen', pgen.bytes()),
      chunk('inst', inst.bytes()), chunk('ibag', ibag.bytes()), chunk('imod', noModulators), chunk('igen', igen.bytes()),
      chunk('shdr', shdr.bytes())));
  return chunk('RIFF', riff.bytes());
}
