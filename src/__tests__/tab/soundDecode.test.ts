/**
 * Decoding a sound's samples off the main thread: the worker's decoding makes the same samples as
 * alphaTab's synthesizer does itself, the synthesizer takes them as its own, and the page side of
 * the worker answers, fails and starts again. The worker itself needs a browser.
 * See docs/specs/2026-10-29-tab-sound-decoding-design.md.
 */
import { readFileSync } from 'node:fs';
import * as alphaTab from '@coderline/alphatab';
import { decodeOnMainThread, decodeSoundFont, DECODE_CMD, lastFont, silentOutput, transferables, useDecoded, vorbisSamples, type DecodeAnswer, type DecodeRequest } from '@/features/tab/soundDecode';
import { SoundDecoder } from '@/features/tab/soundDecoder';

/** The smallest of the sounds' own soundfonts, an .sf3 of Ogg Vorbis samples. */
const ELECTRIC = 'public/soundfont/guitar-electric-karoryfer.sf3';
const electric = () => new Uint8Array(readFileSync(ELECTRIC));

/** A synthesizer that plays nothing, holding a soundfont, as the Tab page's player holds one. */
function synthWith(bytes: Uint8Array) {
  const synth = new alphaTab.synth.AlphaSynth(silentOutput(), 500);
  synth.loadSoundFont(bytes, false);
  return synth;
}

/** A sample's bits, to compare long samples quickly. */
const bitsOf = (samples: Float32Array) => Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);

describe('decoding a soundfont', () => {
  const decoded = decodeSoundFont(alphaTab, electric());

  it('decodes every Ogg Vorbis sample', () => {
    const font = lastFont(synthWith(electric()));
    expect(decoded.map(d => [d.start, d.end])).toEqual(vorbisSamples(font).map(s => [s.start, s.end]));
    expect(decoded.length).toBeGreaterThan(0);
    expect(decoded.every(d => d.samples.length > 0)).toBe(true);
  });

  it('makes the same samples as the synthesizer decodes itself, to the bit', () => {
    const font = lastFont(synthWith(electric()));
    for (const { start, end, samples } of decoded) expect(bitsOf(samples).equals(bitsOf(font.decodeSamples(start, end, true)))).toBe(true);
  });

  it('hands the synthesizer samples it then uses as its own, without decoding them again', () => {
    const font = lastFont(synthWith(electric()));
    useDecoded(font, decoded);
    // The very arrays handed over: the key they were kept under is the one alphaTab looks up.
    for (const { start, end, samples } of decoded) expect(font.decodeSamples(start, end, true)).toBe(samples);
  });

  it('decodes on the main thread too, where no worker can be made', async () => {
    const font = lastFont(synthWith(electric()));
    await decodeOnMainThread(font);
    expect(font._sampleCache.size).toBe(decoded.length);
  });

  it('transfers each sample buffer once', () => {
    const buffers = transferables(decoded);
    expect(new Set(buffers).size).toBe(buffers.length);
    expect(buffers.length).toBeGreaterThan(0);
  });
});

/** A stand-in for the browser's Worker: records what it is sent, and answers when told. */
class FakeWorker {
  static made: FakeWorker[] = [];
  sent: { message: DecodeRequest; transfer: Transferable[] }[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<DecodeAnswer>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  constructor(readonly url: URL, readonly options: WorkerOptions) {
    FakeWorker.made.push(this);
  }
  postMessage(message: DecodeRequest, transfer: Transferable[]) {
    this.sent.push({ message, transfer });
  }
  terminate() {
    this.terminated = true;
  }
  answer(data: DecodeAnswer) {
    this.onmessage?.({ data } as MessageEvent<DecodeAnswer>);
  }
  fail(message: string) {
    this.onerror?.({ message, preventDefault() {} } as ErrorEvent);
  }
}

describe('the decoder on the page', () => {
  beforeEach(() => {
    FakeWorker.made = [];
    vi.stubGlobal('Worker', FakeWorker);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the bytes to the worker, moved rather than copied, and gives back its samples', async () => {
    const decoder = new SoundDecoder();
    const bytes = new Uint8Array([1, 2, 3]);
    const decoding = decoder.decode(bytes);
    const [worker] = FakeWorker.made;
    expect(worker.options).toEqual({ type: 'module' });
    const { message, transfer } = worker.sent[0];
    expect(message.cmd).toBe(DECODE_CMD);
    expect(message.bytes).toBe(bytes);
    expect(transfer).toEqual([bytes.buffer]);
    const samples = new Float32Array([0.5]);
    worker.answer({ decodeId: message.decodeId, decoded: [{ start: 0, end: 3, samples }] });
    await expect(decoding).resolves.toEqual([{ start: 0, end: 3, samples }]);
  });

  it('matches each answer to its ask', async () => {
    const decoder = new SoundDecoder();
    const first = decoder.decode(new Uint8Array(1));
    const second = decoder.decode(new Uint8Array(1));
    const [worker] = FakeWorker.made;
    expect(FakeWorker.made).toHaveLength(1);
    const [a, b] = worker.sent.map(s => s.message.decodeId);
    worker.answer({ decodeId: b, error: 'bad soundfont' });
    worker.answer({ decodeId: a, decoded: [] });
    await expect(first).resolves.toEqual([]);
    await expect(second).rejects.toThrow('bad soundfont');
  });

  it('starts the worker before there is anything to decode, and only once', () => {
    const decoder = new SoundDecoder();
    decoder.start();
    decoder.start();
    void decoder.decode(new Uint8Array(1));
    expect(FakeWorker.made).toHaveLength(1);
  });

  it('fails what a broken worker was asked, and makes a new one for the next ask', async () => {
    const decoder = new SoundDecoder();
    const decoding = decoder.decode(new Uint8Array(1));
    FakeWorker.made[0].fail('it broke');
    await expect(decoding).rejects.toThrow('it broke');
    expect(FakeWorker.made[0].terminated).toBe(true);
    void decoder.decode(new Uint8Array(1));
    expect(FakeWorker.made).toHaveLength(2);
  });

  it('fails what is waiting when closed', async () => {
    const decoder = new SoundDecoder();
    const decoding = decoder.decode(new Uint8Array(1));
    decoder.destroy();
    await expect(decoding).rejects.toThrow();
    expect(FakeWorker.made[0].terminated).toBe(true);
  });

  it('rejects where there are no workers, so the player decodes on the main thread', async () => {
    vi.stubGlobal('Worker', undefined);
    await expect(new SoundDecoder().decode(new Uint8Array(1))).rejects.toThrow();
  });
});
