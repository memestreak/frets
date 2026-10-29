/**
 * What a score prints under its title, as Guitar Pro and guitar books do: the artist, who wrote the
 * words and music (alphaTex's `\artist`, `\words` and `\music`, kept as written in the clip's header),
 * and the tuning when it isn't standard ("Tune down 1/2 step", then each string). Pure.
 */
import { quoted } from './alphatex';
import { STANDARD_TUNING, STRING_COUNT, type Clip } from './clip';
import { openStrings, tuningShift } from './notation';
import { presetOf } from './tuning';

/** A header tag's text: `\artist "Guns N' Roses"` gives "Guns N' Roses"; null when the header has no such tag. */
export function headerValue(clip: Clip, tag: string): string | null {
  const pattern = new RegExp(`^\\\\${tag}\\s+(["'])((?:\\\\.|(?!\\1).)*)\\1`, 'i');
  for (const line of clip.header ?? []) {
    const m = pattern.exec(line.trim());
    if (m) return m[2].replace(/\\(.)/g, '$1').trim() || null;
  }
  return null;
}

/** The credit tags, in the order a score prints them and new ones are written. */
export const CREDIT_TAGS = ['artist', 'words', 'music'] as const;
export type CreditTag = (typeof CREDIT_TAGS)[number];

/** The header line's tag: `\\artist "…"` gives "artist". */
function tagOf(line: string): string | null {
  return /^\\([a-z]+)/i.exec(line.trim())?.[1].toLowerCase() ?? null;
}

/**
 * The clip with a credit set (issue #202): an empty value takes its tag away; a new one is written
 * after the credits before it in `CREDIT_TAGS`; every other header line stays as written, and so
 * does this one when its value doesn't change.
 */
export function setCredit(clip: Clip, tag: CreditTag, value: string): Clip {
  const text = value.trim();
  if ((headerValue(clip, tag) ?? '') === text) return clip;
  const header = [...(clip.header ?? [])];
  const at = header.findIndex(line => tagOf(line) === tag);
  if (at >= 0 && !text) header.splice(at, 1);
  else if (at >= 0) header[at] = `\\${tag} ${quoted(text)}`;
  else {
    const before = CREDIT_TAGS.slice(0, CREDIT_TAGS.indexOf(tag)) as readonly string[];
    const last = header.findLastIndex(line => before.includes(tagOf(line) ?? ''));
    header.splice(last + 1, 0, `\\${tag} ${quoted(text)}`);
  }
  const next: Clip = { ...clip, header };
  if (header.length === 0) delete next.header;
  return next;
}

/**
 * The score's head, as both the page (`ScoreHead.tsx`) and the exported image draw it, in the
 * drawing's units (zoomed with it): the title, then the artist and credits, centred; then the tuning,
 * indented from the left, in two columns.
 */
export const HEAD = {
  titleSize: 30,
  titleLine: 40,
  artistSize: 16,
  artistLine: 22,
  creditSize: 13,
  creditLine: 18,
  /** Room between the credits and the tuning, and after the tuning. */
  gap: 12,
  tuningIndent: 40,
  /** From one tuning column's start to the next, and each column's own width. */
  tuningColumn: 72,
  tuningColumnWidth: 60,
  /** The first bar's tempo ("♩ = 92"), in bold under the tuning: its line, room for the note's stem included. */
  tempoLine: 22,
} as const;

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
  /**
   * "Tune down 1/2 step" when every string is tuned alike; else the common tuning's name ("Drop D
   * tuning", Jeremy, 2026-10-29); null for a tuning of its own.
   */
  heading: string | null;
  /** The strings to retune, as printed: ① is the high e. All six under a heading; otherwise only those tuned away from standard. */
  strings: { number: number; name: string }[];
}

/** "Drop D tuning": the name of the common tuning this is, or null. */
function presetName(tuning: readonly string[]): string | null {
  const preset = presetOf(tuning);
  return preset ? `${preset.name} tuning` : null;
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
    heading: shift !== 0 ? `Tune ${shift < 0 ? 'down' : 'up'} ${steps(Math.abs(shift))}` : presetName(tuning),
    strings: strings.filter(s => shift !== 0 || s.by !== 0).map(({ number, name }) => ({ number, name })),
  };
}
