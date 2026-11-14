/**
 * A metronome sound heard once, as it is picked in Tab › Metronome or the Metronome toggle's menu
 * (issue #477), so it can be judged, as the Metronome page's Sound does. Plain Web Audio, apart
 * from the player: it sounds even before the first Play.
 */
import { clickSoundWaves, type ClickSound } from '@/lib/clickSounds';

let context: AudioContext | null = null;
const buffers = new Map<ClickSound, AudioBuffer>();

/** Plays a sound's high click (beat one's) at `level`, 0 to 1. */
export function previewClick(sound: ClickSound, level: number) {
  if (typeof AudioContext === 'undefined' || level <= 0) return;
  context ??= new AudioContext();
  const ctx = context;
  void ctx.resume();
  let buffer = buffers.get(sound);
  if (!buffer) {
    const [high] = clickSoundWaves(sound, ctx.sampleRate);
    buffer = ctx.createBuffer(1, high.length, ctx.sampleRate);
    buffer.copyToChannel(new Float32Array(high), 0);
    buffers.set(sound, buffer);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = level;
  source.connect(gain).connect(ctx.destination);
  source.start(ctx.currentTime + 0.01);
}
