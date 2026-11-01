import { playReference, setBuiltInRecordings } from '@/components/tuner/reference';

/* The MCP App's built-in recordings (#283): played from the data: URL, never fetched. */

const decoded: number[][] = [];
class FakeAudioContext {
  sampleRate = 44100;
  destination = {};
  resume() { return Promise.resolve(); }
  decodeAudioData(data: ArrayBuffer) {
    decoded.push([...new Uint8Array(data)]);
    return Promise.resolve({ duration: 1 });
  }
  createBufferSource() {
    return { buffer: null, playbackRate: { value: 1 }, connect() {}, start() {} };
  }
}

beforeEach(() => {
  decoded.length = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => {
  vi.unstubAllGlobals();
  setBuiltInRecordings({});
});

it('plays a built-in recording without fetching it', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  // "abc" in base64.
  setBuiltInRecordings({ '/sounds/acoustic/A2.mp3': 'data:audio/mpeg;base64,YWJj' });
  await playReference(45, 'acoustic');
  expect(fetch).not.toHaveBeenCalled();
  expect(decoded).toEqual([[97, 98, 99]]);
});
