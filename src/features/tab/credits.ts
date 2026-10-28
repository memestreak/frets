/**
 * What a score prints under its title, as Guitar Pro and guitar books do: the artist, who wrote the
 * words and music (alphaTex's `\artist`, `\words` and `\music`, kept as written in the clip's header),
 * and the tuning when it isn't standard ("Tune down 1/2 step", then each string). Pure.
 */
import { STANDARD_TUNING, STRING_COUNT, type Clip } from './clip';
import { openStrings, tuningShift } from './notation';

/** A header tag's text: `\artist "Guns N' Roses"` gives "Guns N' Roses"; null when the header has no such tag. */
export function headerValue(clip: Clip, tag: string): string | null {
  const pattern = new RegExp(`^\\\\${tag}\\s+(["'])((?:\\\\.|(?!\\1).)*)\\1`, 'i');
  for (const line of clip.header ?? []) {
    const m = pattern.exec(line.trim());
    if (m) return m[2].replace(/\\(.)/g, '$1').trim() || null;
  }
  return null;
}

export interface Credits {
  artist: string | null;
  /** "Words & Music by …" when one set of people wrote both; otherwise "Words by …" and "Music by …". */
  lines: string[];
}

export function creditsOf(clip: Clip): Credits {
  const words = headerValue(clip, 'words');
  const music = headerValue(clip, 'music');
  const lines =
    words && words === music
      ? [`Words & Music by ${words}`]
      : [words && `Words by ${words}`, music && `Music by ${music}`].filter((l): l is string => !!l);
  return { artist: headerValue(clip, 'artist'), lines };
}

/** ① to ⑥, a string's number as tuning notes print it. */
export const circled = (n: number) => String.fromCharCode(0x2460 + n - 1);

const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** "1/2 step", "1 step", "1 1/2 steps": a shift in semitones as tuning instructions say it. */
function steps(semitones: number): string {
  const whole = Math.floor(semitones / 2);
  const half = semitones % 2 === 1;
  const amount = whole === 0 ? '1/2' : half ? `${whole} 1/2` : `${whole}`;
  return `${amount} ${semitones <= 2 ? 'step' : 'steps'}`;
}

export interface TuningBlock {
  /** "Tune down 1/2 step" when every string is tuned alike; null otherwise. */
  heading: string | null;
  /** The strings to retune, as printed: ① is the high e. All six under a heading; otherwise only those tuned away from standard. */
  strings: { number: number; name: string }[];
}

/** The tuning as a score prints it over the music; null for standard tuning. */
export function tuningBlock(tuning: readonly string[]): TuningBlock | null {
  const open = openStrings(tuning);
  const standard = openStrings(STANDARD_TUNING);
  if (open.every((p, s) => p === standard[s])) return null;
  const shift = tuningShift(tuning);
  const strings = Array.from({ length: STRING_COUNT }, (_, s) => {
    const by = open[s] - standard[s];
    // A string tuned down is named with a flat, one tuned up with a sharp, as tuning notes have it.
    const name = (by < 0 ? FLAT_NAMES : SHARP_NAMES)[((open[s] % 12) + 12) % 12];
    return { number: s + 1, name, by };
  });
  return {
    heading: shift === 0 ? null : `Tune ${shift < 0 ? 'down' : 'up'} ${steps(Math.abs(shift))}`,
    strings: strings.filter(s => shift !== 0 || s.by !== 0).map(({ number, name }) => ({ number, name })),
  };
}
