import { Note } from 'tonal';

/*
 * Notes and pitch classes. Notes are spelled in ASCII as tonal and alphaTex
 * write them ("F#", "Bb", "E##"); anything shown to the user goes through
 * `prettyNote` for real ♭ ♯ 𝄪 𝄫 glyphs.
 */

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** Each pitch class spelled with sharps: "C", "C#", … "B". */
export const SHARP_NOTES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;
/** Each pitch class spelled with flats: "C", "Db", … "B". */
export const FLAT_NOTES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
] as const;

/** The seven letters, C first: a letter's index is its place in this string. */
export const LETTERS = 'CDEFGAB';
/** Pitch class of each letter, C first. */
export const LETTER_PCS = [0, 2, 4, 5, 7, 9, 11] as const;

/**
 * A note name's pitch class, 0–11, in either spelling: "F#" and "F♯" 6,
 * "Bb" 10, "E#" 5, "Cbb" 10. Case doesn't matter for the letter.
 */
export function pitchClassOf(name: string): number {
  const letter = LETTERS.indexOf(name[0].toUpperCase());
  let shift = 0;
  for (const c of name.slice(1)) {
    if (c === '#' || c === '♯') shift += 1;
    else if (c === 'b' || c === '♭') shift -= 1;
    else if (c === '𝄪') shift += 2;
    else if (c === '𝄫') shift -= 2;
  }
  return mod12(LETTER_PCS[letter] + shift);
}

/** A note moved up by a tonal interval, spelled: ("D", "5P") → "A". */
export const transposeNote = (note: string, interval: string): string =>
  Note.transpose(note, interval);

/** "F##" → "F𝄪", "Bb" → "B♭": tonal's ASCII spelling with real glyphs. */
export function prettyNote(note: string): string {
  const acc = note.slice(1)
    .replace('##', '𝄪').replace('bb', '𝄫')
    .replace('#', '♯').replace('b', '♭');
  return note[0] + acc;
}
