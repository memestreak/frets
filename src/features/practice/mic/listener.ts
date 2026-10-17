import { detectPitch, freqToMidi, levelOf, rms } from './pitch';
import { trackHold, type Hold } from './hold';

/** Why the mic would not start. */
export type MicError = 'insecure' | 'denied' | 'missing' | 'failed';

/** What the mic hears now. */
export interface MicReading {
  /** Meter level, 0–1. */
  level: number;
  /** The pitch heard as a fractional MIDI note, or null. */
  pitch: number | null;
  /** The nearest note to it, or null. */
  midi: number | null;
  /** The note held, steadied over the last few readings. */
  hold: Hold | null;
}

export const SILENT: MicReading = { level: 0, pitch: null, midi: null, hold: null };

/** Samples per analysis: over two periods of the low E at 48 kHz. */
const WINDOW = 4096;
/** Analyse at most this often; animation frames come faster. */
const ANALYSE_EVERY_MS = 30;

/** Sort a failure from getUserMedia, or a page without it, into a MicError. */
export function micError(e: unknown): MicError {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure';
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing';
  return 'failed';
}

/** Has the browser already granted this page the mic? */
export async function micGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state === 'granted';
  } catch {
    return false;
  }
}

/**
 * Listens to the microphone and reports, many times a second, the note it
 * hears. Readings go to subscribers, outside React, so only what draws
 * them redraws.
 */
export class MicListener {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private frame = 0;
  /** Bumped by every start and stop, so a start that lost the race backs out. */
  private generation = 0;
  private reading = SILENT;
  private readonly subscribers = new Set<() => void>();

  /** Asks for the mic and starts listening; resolves to null or why not. */
  async start(): Promise<MicError | null> {
    this.stop();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia) return micError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      return micError(e);
    }
    if (generation !== this.generation) {
      stream.getTracks().forEach(t => t.stop());
      return null;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = WINDOW;
    ctx.createMediaStreamSource(stream).connect(analyser);
    this.stream = stream;
    this.ctx = ctx;
    // Without a click on this page yet, the browser may hold the audio
    // back until there is one.
    if (ctx.state === 'suspended') {
      const resume = () => void ctx.resume();
      document.addEventListener('pointerdown', resume, { once: true });
      document.addEventListener('keydown', resume, { once: true });
      void ctx.resume();
    }

    const buf = new Float32Array(WINDOW);
    let last = -Infinity;
    const tick = (now: number) => {
      this.frame = requestAnimationFrame(tick);
      if (now - last < ANALYSE_EVERY_MS) return;
      last = now;
      analyser.getFloatTimeDomainData(buf);
      const loud = rms(buf);
      const pitch = detectPitch(buf, ctx.sampleRate);
      const midi = pitch ? freqToMidi(pitch.hz) : null;
      const hold = trackHold(this.reading.hold, { midi, rms: loud, at: now });
      this.publish({
        level: levelOf(loud), pitch: midi, midi: midi == null ? null : Math.round(midi), hold,
      });
    };
    this.frame = requestAnimationFrame(tick);
    return null;
  }

  /** Stops listening and lets the browser drop its recording indicator. */
  stop() {
    this.generation++;
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach(t => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.ctx = null;
    this.publish(SILENT);
  }

  get listening(): boolean {
    return this.ctx != null;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.subscribers.add(fn);
    return () => { this.subscribers.delete(fn); };
  };

  getReading = (): MicReading => this.reading;

  private publish(reading: MicReading) {
    if (reading === this.reading) return;
    this.reading = reading;
    this.subscribers.forEach(fn => fn());
  }
}
