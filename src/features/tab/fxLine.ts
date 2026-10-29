/**
 * The clip's FX as one comment line at the top of its alphaTex (Jeremy, 2026-10-29), so they travel
 * with the arrangement. alphaTex has no room for settings of its own: an unknown tag or property
 * stops alphaTab reading the file, but a comment is part of its grammar and other tools skip it.
 *
 *   // frets:fx on; distortion on drive=0.5 tone=0.5; reverb on amount=0.3 decay=1.5
 *
 * The first word is the FX button's light switch, then each effect's own switch and settings. A part
 * or setting missing or wrong takes its default. Pure; reading the comments out of the text is
 * `alphatexRead.ts`.
 */
import { parseEffects, type FxSettings } from './effects';

/** What a comment starts with to be the FX line, after `//` and any spaces. */
const MARK = 'frets:fx';

/** Settings are written to two decimal places, as the knobs show them. */
const written = (value: number) => String(Math.round(value * 100) / 100);
const onOff = (on: boolean) => (on ? 'on' : 'off');

/** The FX as their comment line. */
export function fxLine(fx: FxSettings): string {
  return `// ${MARK} ${onOff(fx.on)}; `
    + `distortion ${onOff(fx.distortionOn)} drive=${written(fx.drive)} tone=${written(fx.tone)}; `
    + `reverb ${onOff(fx.reverbOn)} amount=${written(fx.reverb)} decay=${written(fx.decay)}`;
}

/** The FX in a comment's text (what follows `//`), or null when the comment isn't the FX line. */
export function readFxLine(comment: string): FxSettings | null {
  const text = comment.trim();
  if (!text.toLowerCase().startsWith(MARK)) return null;
  const [main, ...parts] = text.slice(MARK.length).split(';').map(part => part.trim().split(/\s+/).filter(Boolean));
  const switchOf = (word: string | undefined) => ({ on: true, off: false })[word?.toLowerCase() ?? ''];
  // Each effect's part: its name, its switch, then name=value settings.
  const part = (name: string) => {
    const words = parts.find(p => p[0]?.toLowerCase() === name) ?? [];
    const settings = new Map(words.slice(1).flatMap(w => {
      const [key, value] = w.split('=');
      return value === undefined ? [] : [[key.toLowerCase(), Number(value)] as const];
    }));
    return { on: switchOf(words[1]), get: (key: string) => settings.get(key) };
  };
  const distortion = part('distortion');
  const reverb = part('reverb');
  return parseEffects({
    on: switchOf(main?.[0]),
    distortionOn: distortion.on,
    drive: distortion.get('drive'),
    tone: distortion.get('tone'),
    reverbOn: reverb.on,
    reverb: reverb.get('amount'),
    decay: reverb.get('decay'),
  });
}
