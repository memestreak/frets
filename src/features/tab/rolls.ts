/**
 * How chords roll in playback (issue #385): a chord marked Downstroke or Upstroke (⊓ / V, alphaTex
 * `sd` / `su`) is strummed a little, low string first for a Downstroke; a Strum down or up (`bd` /
 * `bu`) and a Rolled chord (`ad` / `au`) roll by the amount set. Each kind can be turned off, and then
 * plays its notes at once. A length written in the clip (`{bd 60}`, in alphaTab's ticks) wins over
 * the setting for that chord. Dorico, MuseScore and Guitar Pro 8 play ⊓ / V unrolled; rolling them is
 * Frets' own choice (Jeremy, 2026-11-06: "the same type of effect used for the bd/bu — but maybe
 * slightly more subtle").
 */
import type * as AlphaTabModule from '@coderline/alphatab';
import type { Column, Part } from './clip';

type AlphaTab = typeof AlphaTabModule;
type Score = AlphaTabModule.model.Score;

/**
 * How long each kind of chord takes to roll, from its first note to its last, as a share of the
 * chord's own length (0.05 is 5%: 25 ms for a quarter note at 120 bpm); 0 plays the notes at once.
 */
export interface Rolls {
  /** Downstroke and Upstroke (`sd` / `su`). */
  strokes: number;
  /** Strum down and up (`bd` / `bu`). */
  strums: number;
  /** Rolled chords (`ad` / `au`). */
  rolledChords: number;
}

/**
 * A little less than a Strum for a Downstroke or Upstroke (Jeremy: "slightly more subtle"); a Strum and a Rolled chord near
 * alphaTab's own lengths for a chord of four to six notes (a quarter, and all, of the chord's length,
 * divided by how many notes it has).
 */
export const DEFAULT_ROLLS: Rolls = { strokes: 0.03, strums: 0.05, rolledChords: 0.2 };

/** Whether two Rolls are the same. */
export function sameRolls(a: Rolls, b: Rolls): boolean {
  return a.strokes === b.strokes && a.strums === b.strums && a.rolledChords === b.rolledChords;
}

/** A Strum or Rolled chord with its length written (`bd 60`, `au (120)`), which the settings leave as it is. */
const WRITTEN_LENGTH = /^(bd|bu|ad|au)\b\s*\S/;

/**
 * Sets each chord's roll in alphaTab's score before it becomes MIDI. A Column with one note is left
 * as it is; so is a written length.
 */
export function rollChords(at: AlphaTab, score: Score, clip: Part, rolls: Rolls) {
  const { BrushType, PickStroke } = at.model;
  for (const track of score.tracks) for (const staff of track.staves) for (const bar of staff.bars) {
    for (const voice of bar.voices) {
      const columns = columnsOf(clip, bar.index, voice.index);
      voice.beats.forEach((beat, k) => {
        const column = columns && columns.length === voice.beats.length ? columns[k] : undefined;
        if (column?.extra?.some(e => WRITTEN_LENGTH.test(e))) return;
        if (beat.brushType === BrushType.BrushDown || beat.brushType === BrushType.BrushUp) {
          beat.brushDuration = rolls.strums * beat.playbackDuration;
        } else if (beat.brushType === BrushType.ArpeggioDown || beat.brushType === BrushType.ArpeggioUp) {
          beat.brushDuration = rolls.rolledChords * beat.playbackDuration;
        } else if (beat.pickStroke !== PickStroke.None && beat.notes.length > 1 && rolls.strokes > 0) {
          beat.brushType = beat.pickStroke === PickStroke.Down ? BrushType.BrushDown : BrushType.BrushUp;
          beat.brushDuration = rolls.strokes * beat.playbackDuration;
        }
      });
    }
  }
}

/** A Voice's Columns in a bar of the part: its own, or another Voice it carries. */
function columnsOf(clip: Part, bar: number, voice: number): readonly Column[] | undefined {
  const own = clip.bars[bar];
  if (!own) return undefined;
  if (voice === (clip.voice ?? 0)) return own.columns;
  return own.otherVoices?.find(o => o.voice === voice)?.columns;
}
