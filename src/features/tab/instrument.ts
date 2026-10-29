/**
 * The clip's instrument (Jeremy, 2026-10-29): the Sound it plays in, stored as alphaTex's own
 * `\instrument`, a General MIDI program, so it travels with the arrangement and other apps play
 * the right kind of sound. Frets has three sounds (`SOUND_FAMILIES` in `playback.ts`); a clip may
 * name any of the 128. One Frets doesn't have is kept as written and played by the nearest of the
 * three, which the Sound list says with a ⚠. Pure; reading is `alphatexRead.ts`.
 * See `docs/specs/2026-10-29-tab-sound-and-fx-in-clip-design.md`.
 */

/** The General MIDI instrument names, by program number. */
const GM_NAMES = [
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano', 'Electric Piano 1',
  'Electric Piano 2', 'Harpsichord', 'Clavinet', 'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba',
  'Xylophone', 'Tubular Bells', 'Dulcimer', 'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ',
  'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion', 'Nylon Guitar', 'Steel Guitar', 'Jazz Electric Guitar',
  'Clean Electric Guitar', 'Muted Electric Guitar', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  'Acoustic Bass', 'Fingered Electric Bass', 'Picked Electric Bass', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2',
  'Synth Bass 1', 'Synth Bass 2', 'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings',
  'Orchestral Harp', 'Timpani', 'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2',
  'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit', 'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet',
  'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2', 'Soprano Sax', 'Alto Sax', 'Tenor Sax',
  'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet', 'Piccolo', 'Flute', 'Recorder', 'Pan Flute',
  'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina', 'Square Lead', 'Sawtooth Lead', 'Calliope Lead', 'Chiff Lead',
  'Charang Lead', 'Voice Lead', 'Fifths Lead', 'Bass and Lead', 'New Age Pad', 'Warm Pad', 'Polysynth Pad',
  'Choir Pad', 'Bowed Pad', 'Metallic Pad', 'Halo Pad', 'Sweep Pad', 'Rain', 'Soundtrack', 'Crystal', 'Atmosphere',
  'Brightness', 'Goblins', 'Echoes', 'Sci-fi', 'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe', 'Fiddle',
  'Shanai', 'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum',
  'Reverse Cymbal', 'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter',
  'Applause', 'Gunshot',
];

/** A General MIDI program's name, e.g. 30 "Distortion Guitar". */
export function instrumentName(program: number): string {
  return GM_NAMES[program] ?? `Instrument ${program}`;
}

/** The three sounds: the piano, the steel guitar (alphaTex's default) and the clean electric. */
const PIANO = 0;
const STEEL = 25;
const ELECTRIC = 27;

/**
 * The sound Frets plays a program with: itself when Frets has it, else the nearest by family.
 * Electric guitars (jazz, muted, overdriven, distortion, harmonics) play as the clean electric;
 * pianos, keys and organs as the piano; everything else as the steel guitar.
 */
export function soundFor(program: number | undefined): number {
  if (program === undefined) return STEEL;
  if (program === PIANO || program === STEEL || program === ELECTRIC) return program;
  if (program >= 26 && program <= 31) return ELECTRIC;
  if (program <= 7 || (program >= 16 && program <= 23)) return PIANO;
  return STEEL;
}

/** What the Sound list's ⚠ says when the clip asks for a sound Frets doesn't have; null when it has it. */
export function substituteNote(program: number | undefined): string | null {
  const sound = soundFor(program);
  if (program === undefined || program === sound) return null;
  return `This arrangement asks for ${instrumentName(program)}; Frets plays ${instrumentName(sound)}.`;
}

/** alphaTex's names for the three sounds, as Frets writes them. */
const TEX_NAMES: Record<number, string> = {
  [PIANO]: 'acousticgrandpiano', [STEEL]: 'acousticguitarsteel', [ELECTRIC]: 'electricguitarclean',
};

/** The `\instrument` tag for one of Frets' sounds. */
export function instrumentTag(sound: number): string {
  return `\\instrument ${TEX_NAMES[sound] ?? sound}`;
}

/**
 * Whether a program leaves alphaTab's six-string standard tuning in place: the guitars do (24 to
 * 31). The others bring their own strings (four for a bass or a violin) or none (a piano), so a clip
 * naming one writes its tuning even when it is standard, or its tab wouldn't read back.
 */
export function keepsGuitarTuning(program: number): boolean {
  return program >= 24 && program <= 31;
}

/** Standard tuning as alphaTex writes it, high string first. */
export const STANDARD_TUNING_TEX = '\\tuning (E4 B3 G3 D3 A2 E2)';
