/**
 * The Web Worker that decodes a soundfont's Ogg Vorbis samples for the Tab page's player, off the
 * main thread (`SoundDecoder` in `soundDecoder.ts`). alphaTab's own worker code also listens here
 * once alphaTab loads; it ignores messages with this `cmd`.
 */
import * as alphaTab from '@coderline/alphatab';
import { DECODE_CMD, decodeSoundFont, transferables, type DecodeAnswer, type DecodeRequest } from './soundDecode';

self.addEventListener('message', (e: MessageEvent<DecodeRequest>) => {
  if (e.data?.cmd !== DECODE_CMD) return;
  const { decodeId, bytes } = e.data;
  let answer: DecodeAnswer;
  try {
    answer = { decodeId, decoded: decodeSoundFont(alphaTab, bytes) };
  } catch (error) {
    answer = { decodeId, error: String(error) };
  }
  (self as unknown as Worker).postMessage(answer, 'decoded' in answer ? transferables(answer.decoded) : []);
});
