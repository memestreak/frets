import type { ChordInfo } from '@/lib/chords/chordTypes';

/** "A, C, E and G" */
function listNotes(notes: string[]): string {
  return notes.length < 2 ? notes.join('') : `${notes.slice(0, -1).join(', ')} and ${notes.at(-1)}`;
}

/** What the neck shows with the arpeggio on: "Arpeggio · every A, C, E and G up to fret 15" */
export const arpeggioCaption = (chord: ChordInfo, maxFret: number): string =>
  `Arpeggio · every ${listNotes(chord.notes)} up to fret ${maxFret}`;
