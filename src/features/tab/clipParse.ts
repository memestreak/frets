/**
 * A Clip read back from storage, checked field by field: `parseClip` and the validators it uses.
 * Split from `clip.ts` (health check, #442). Pure; no React.
 */
import { isKey } from '@/lib/theory/keys';
import { isChordDef } from './chordSet';
import { parseEffects } from './effects';
import {
  BEND_QUARTERS, DYNAMICS, FERMATAS, isBarsPerLine, isTimeSignature, isWhammy, MAX_BPM, MAX_CAPO, MAX_VOICES, MIN_BPM, NOTE_VALUES,
  OTTAVAS, SLIDES, STRING_COUNT, TREMOLO_VALUES, TUPLET_SPANS, tupletFields,
  type BendQuarters, type Clip, type Column, type Duration, type MasterBar, type Note, type NoteValue, type Ottava, type Roll, type Slide,
  type TremoloValue, type Track, type TrackBar,
} from './clip';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const optBool = (v: unknown) => v === undefined || typeof v === 'boolean';
const optOneOf = (v: unknown, values: readonly string[]) => v === undefined || values.includes(v as string);
const optString = (v: unknown) => v === undefined || typeof v === 'string';
const optStrings = (v: unknown) => v === undefined || (Array.isArray(v) && v.every(x => typeof x === 'string'));

function isBpm(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= MIN_BPM && (v as number) <= MAX_BPM;
}

function isCapo(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_CAPO;
}

function isDuration(v: unknown): v is Duration {
  return isObj(v) && NOTE_VALUES.includes(v.value as NoteValue)
    && (v.dots === 0 || v.dots === 1 || v.dots === 2) && isTuplet(v);
}

/** No tuplet, or one `tupletFields` would make: the span written only when it isn't the usual one. */
function isTuplet(v: Record<string, unknown>): boolean {
  if (v.tuplet === undefined) return v.tupletSpan === undefined;
  const fields = tupletFields(v.tuplet as number, (v.tupletSpan ?? TUPLET_SPANS[v.tuplet as number]) as number);
  return fields !== null && fields.tupletSpan === v.tupletSpan;
}

function isNote(v: unknown): v is Note {
  if (!isObj(v)) return false;
  const fretOk = v.fret === null || (Number.isInteger(v.fret) && (v.fret as number) >= 0 && (v.fret as number) <= 24);
  const bendOk = v.bend === undefined || (isObj(v.bend)
    && BEND_QUARTERS.includes(v.bend.quarters as BendQuarters)
    && typeof v.bend.pre === 'boolean' && typeof v.bend.release === 'boolean'
    && (v.bend.from === undefined || (v.bend.pre === true && BEND_QUARTERS.includes(v.bend.from as BendQuarters)
      && (v.bend.from as number) < (v.bend.quarters as number)))
    && (v.bend.to === undefined || (v.bend.release === true && BEND_QUARTERS.includes(v.bend.to as BendQuarters)
      && (v.bend.to as number) < (v.bend.quarters as number))));
  return fretOk && bendOk
    && (v.legato === undefined || v.legato === 'h' || v.legato === 'p')
    && (v.slide === undefined || SLIDES.includes(v.slide as Slide))
    && optOneOf(v.slideOut, ['down', 'up']) && optOneOf(v.vibrato, ['slight', 'wide'])
    && optOneOf(v.harmonic, ['natural', 'pinch', 'artificial'])
    && (v.harmonicFret === undefined || (Number.isInteger(v.harmonicFret) && (v.harmonicFret as number) > 0 && (v.harmonicFret as number) <= 24)) && optOneOf(v.accent, ['normal', 'heavy']) && optOneOf(v.mordent, ['upper', 'lower'])
    && optBool(v.tie) && optBool(v.tap) && optBool(v.palmMute) && optBool(v.letRing) && optBool(v.ghost) && optBool(v.staccato)
    && optStrings(v.extra);
}

/** A column's Lyrics as stored: at least one syllable, strings only, the last not empty. */
function isLyrics(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every(l => typeof l === 'string') && v[v.length - 1] !== '';
}

function isRoll(v: unknown): v is Roll {
  return isObj(v) && (v.sign === 'strum' || v.sign === 'rolled') && (v.direction === 'down' || v.direction === 'up')
    && (v.length === undefined || (Number.isInteger(v.length) && (v.length as number) >= 0));
}

function isColumn(v: unknown): v is Column {
  return isObj(v) && isDuration(v.duration)
    && Array.isArray(v.notes) && v.notes.length === STRING_COUNT
    && v.notes.every(n => n === null || isNote(n))
    && (v.stroke === undefined || v.stroke === 'down' || v.stroke === 'up')
    && (v.roll === undefined || isRoll(v.roll))
    && (v.chord === undefined || typeof v.chord === 'string')
    && (v.text === undefined || typeof v.text === 'string')
    && (v.lyrics === undefined || isLyrics(v.lyrics))
    && optOneOf(v.grace, ['before', 'on'])
    && (v.tremolo === undefined || TREMOLO_VALUES.includes(v.tremolo as TremoloValue))
    && (v.ottava === undefined || OTTAVAS.includes(v.ottava as Ottava))
    && optOneOf(v.wah, ['open', 'closed']) && optOneOf(v.hairpin, ['crescendo', 'decrescendo'])
    && optOneOf(v.dynamic, DYNAMICS)
    && optOneOf(v.fermata, FERMATAS) && optOneOf(v.beam, ['break', 'join'])
    && (v.whammy === undefined || isWhammy(v.whammy))
    && optStrings(v.extra);
}

function isMasterBar(v: unknown): v is MasterBar {
  return isObj(v)
    && (v.time === undefined || (isObj(v.time) && isTimeSignature(v.time.beats, v.time.value)))
    && (v.key === undefined || isKey(v.key))
    && optBool(v.repeatStart)
    && (v.repeatEnd === undefined || (Number.isInteger(v.repeatEnd) && (v.repeatEnd as number) >= 2))
    && optBool(v.doubleBar)
    && optBool(v.freeTime)
    && (v.pickup === undefined || (Number.isInteger(v.pickup) && (v.pickup as number) > 0))
    && (v.beatGroups === undefined || (Array.isArray(v.beatGroups) && v.beatGroups.length > 0 && v.beatGroups.every(n => Number.isInteger(n) && n >= 1)))
    && (v.ending === undefined || (Number.isInteger(v.ending) && (v.ending as number) >= 1))
    && (v.tempo === undefined || (isObj(v.tempo) && isBpm(v.tempo.bpm) && optString(v.tempo.label)))
    && (v.section === undefined || (isObj(v.section) && typeof v.section.text === 'string' && optString(v.section.marker)));
}

function isTrackBar(v: unknown): v is TrackBar {
  return isObj(v) && Array.isArray(v.voices) && v.voices.length >= 1 && v.voices.length <= MAX_VOICES
    && v.voices.every(voice => Array.isArray(voice) && voice.every(isColumn)) && optStrings(v.extra);
}

function isInstrument(v: unknown): boolean {
  return v === undefined || (isObj(v) && Number.isInteger(v.program)
    && (v.program as number) >= 0 && (v.program as number) <= 127 && optString(v.tag));
}

function isTrack(v: unknown, bars: number): v is Track {
  return isObj(v) && typeof v.name === 'string' && optString(v.tag) && optStrings(v.header)
    && Array.isArray(v.tuning) && v.tuning.length === STRING_COUNT && v.tuning.every(n => typeof n === 'string')
    && (v.capo === undefined || isCapo(v.capo)) && isInstrument(v.instrument)
    && (v.chords === undefined || (Array.isArray(v.chords) && v.chords.every(isChordDef)))
    && Array.isArray(v.bars) && v.bars.length === bars && v.bars.every(isTrackBar);
}

/** A stored clip, checked field by field; null when anything is off. */
export function parseClip(v: unknown): Clip | null {
  if (!isObj(v) || typeof v.name !== 'string') return null;
  const time = v.time;
  if (!isObj(time) || !isTimeSignature(time.beats, time.value)) return null;
  if (!Array.isArray(v.masterBars) || v.masterBars.length === 0 || !v.masterBars.every(isMasterBar)) return null;
  const bars = v.masterBars.length;
  if (!Array.isArray(v.tracks) || v.tracks.length === 0 || !v.tracks.every(t => isTrack(t, bars))) return null;
  if (!optStrings(v.header)) return null;
  if (!optBool(v.multiBarRests)) return null;
  if (v.systemsLayout !== undefined && !(Array.isArray(v.systemsLayout) && v.systemsLayout.every(isBarsPerLine))) return null;
  if (v.defaultSystemsLayout !== undefined && !isBarsPerLine(v.defaultSystemsLayout)) return null;
  // Each track's FX, each setting checked on its own, as the FX line's are.
  const tracks = (v.tracks as Track[]).map(track => (track.fx === undefined ? track : { ...track, fx: parseEffects(track.fx) }));
  return { ...v, tracks } as unknown as Clip;
}
