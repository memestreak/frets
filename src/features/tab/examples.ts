/**
 * The Tab page's example clips: a small library showing each thing Frets
 * draws, written in alphaTex as an agent would write it. Opening one never
 * touches the saved clip, and its edits are not saved. Each is also a
 * test: it must read with no warnings and write back exactly as here
 * (`src/__tests__/tab/examples.test.ts`). A feature Frets learns to draw
 * gets an example here.
 */

export interface TabExample {
  /** In the link: /tab#example=<id>. */
  id: string;
  title: string;
  /** What it shows, one line in the Examples dialog. */
  shows: string;
  /** The clip, in the canonical alphaTex Frets writes. */
  text: string;
}

export const TAB_EXAMPLES: TabExample[] = [
  {
    id: 'durations',
    title: 'Durations and rests',
    shows: 'Whole to sixteenth notes, rests, dotted and double-dotted notes',
    text: [
      '\\title "Durations and rests"',
      '\\ts (4 4)',
      '0.6.1 | 3.6.2 r.2 | 0.5.4 2.5.4 r.4 3.5.4 |',
      '0.4.8 2.4.8 3.4.8 2.4.8 0.4.16 2.4.16 3.4.16 5.4.16 r.4 |',
      '5.3.4{d} 7.3.8 5.3.4{d} 7.3.8 | 5.3.2{dd} 7.3.8 |',
    ].join('\n') + '\n',
  },
  {
    id: 'short-notes',
    title: 'Triplets and short notes',
    shows: 'Triplets, thirty-seconds and sixty-fourths, and how they beam',
    text: [
      '\\title "Triplets and short notes"',
      '\\ts (4 4)',
      '7.3.8{tu 3} 5.3.8{tu 3} 7.3.8{tu 3} r.4 5.3.16{d} 7.3.32 r.8 5.2.32 7.2.32',
      '  8.2.32 7.2.32 5.1.64 7.1.64 8.1.64 10.1.64 8.1.64 7.1.64 5.1.64 7.1.64 |',
    ].join('\n') + '\n',
  },
  {
    id: 'tuplets',
    title: 'Tuplets',
    shows: 'Triplets; five, six and seven sixteenths in the time of four; nine and twelve thirty-seconds in the time of eight; three eighths in the time of four',
    text: [
      '\\title "Tuplets"',
      '\\ts (4 4)',
      '5.3.8{tu 3} 7.3.8{tu 3} 8.3.8{tu 3} 5.3.8{tu 3} 7.3.8{tu 3} 8.3.8{tu 3} 7.2.4',
      '  5.2.4 |',
      '5.2.16{tu 5} 7.2.16{tu 5} 8.2.16{tu 5} 7.2.16{tu 5} 5.2.16{tu 5} 5.1.16{tu 6}',
      '  7.1.16{tu 6} 8.1.16{tu 6} 7.1.16{tu 6} 5.1.16{tu 6} 7.1.16{tu 6} 8.1.16{tu 7}',
      '  7.1.16{tu 7} 5.1.16{tu 7} 8.2.16{tu 7} 7.2.16{tu 7} 5.2.16{tu 7} 7.3.16{tu 7}',
      '  5.3.4 |',
      '5.1.32{tu 9} 7.1.32{tu 9} 8.1.32{tu 9} 10.1.32{tu 9} 12.1.32{tu 9} 10.1.32{tu 9}',
      '  8.1.32{tu 9} 7.1.32{tu 9} 5.1.32{tu 9} 5.2.32{tu 12} 7.2.32{tu 12}',
      '  8.2.32{tu 12} 7.2.32{tu 12} 5.2.32{tu 12} 7.2.32{tu 12} 8.2.32{tu 12}',
      '  10.2.32{tu 12} 8.2.32{tu 12} 7.2.32{tu 12} 5.2.32{tu 12} 7.2.32{tu 12}',
      '  5.3.8{tu (3 4)} 7.3.8{tu (3 4)} 9.3.8{tu (3 4)} |',
    ].join('\n') + '\n',
  },
  {
    id: 'grace-tremolo',
    title: 'Grace notes and tremolo picking',
    shows: 'Grace notes hammered and slid into, and tremolo picking in eighths, sixteenths and thirty-seconds',
    text: [
      '\\title "Grace notes and tremolo picking"',
      '\\ts (4 4)',
      '5.3{h}.8{gr} 7.3.4 5.3.4 7.4{sl}.8{gr} 9.4.4 5.2.16{gr} 7.2{h}.16{gr} 8.2.4 |',
      '12.1.4{tp 8} 12.1.4{tp 16} 12.1.2{tp 32} |',
    ].join('\n') + '\n',
  },
  {
    id: 'joins',
    title: 'Hammer-ons, slides and ties',
    shows: 'Hammer-ons, pull-offs, slides from the note before or from nowhere, and ties',
    text: [
      '\\title "Hammer-ons, slides and ties"',
      '\\ts (4 4)',
      '5.3{h}.8 7.3.8 7.3{h}.8 5.3.8 5.3{sl}.8 7.3.8 7.3{ss}.8 9.3.8 |',
      '5.4{sib}.4 9.4{sia}.4 -.4.2 |',
    ].join('\n') + '\n',
  },
  {
    id: 'bends',
    title: 'Bends and vibrato',
    shows: 'Quarter, half and full bends, releases, pre-bends and vibrato',
    text: [
      '\\title "Bends and vibrato"',
      '\\ts (4 4)',
      '7.3{b (0 4)}.4 7.3{b (0 4 0)}.4 8.2{b (0 2)}.4 8.2{b (0 1)}.4 |',
      '7.3{b (4 4)}.4 7.3{b (4 4 0)}.4 5.1{v}.2 |',
    ].join('\n') + '\n',
  },
  {
    id: 'techniques',
    title: 'Palm mute, dead notes, harmonics, tap',
    shows: 'Palm-muted and dead notes, natural harmonics and a tapped note',
    text: [
      '\\title "Palm mute, dead notes, harmonics, tap"',
      '\\ts (4 4)',
      '0.6{pm}.8 0.6{pm}.8 0.6{pm}.8 x.6.8 12.3{nh}.8 12.2{nh}.8 12.1.8{tt} 5.1.8 |',
    ].join('\n') + '\n',
  },
  {
    id: 'accents',
    title: 'Accents, ghost notes and staccato',
    shows: 'Accents and heavy accents, ghost notes in brackets, staccato dots',
    text: [
      '\\title "Accents, ghost notes and staccato"',
      '\\ts (4 4)',
      '0.6{ac}.8 0.6{g}.16 0.6{g}.16 3.6{st}.8 3.6{st}.8 5.5{hac}.4 x.5{g}.8',
      '  5.5{ac}.8 |',
      '(5.2{hac} 7.3{hac} 5.4{hac}).4{sd} (5.2{st} 7.3{st} 5.4{st}).8{su} r.8',
      '  (5.2{ac} 7.3{ac} 5.4{ac}).2{sd} |',
    ].join('\n') + '\n',
  },
  {
    id: 'let-ring',
    title: 'Let ring',
    shows: 'An arpeggio left to ring, then a note that stops it',
    text: [
      '\\title "Let ring"',
      '\\ts (3 4)',
      '0.5{lr}.8 2.4{lr}.8 2.3{lr}.8 1.2{lr}.8 0.1{lr}.8 1.2.8 |',
      '(0.1 1.2 2.3 2.4 0.5).2{d} |',
    ].join('\n') + '\n',
  },
  {
    id: 'lead',
    title: 'Pinch harmonics, wide vibrato, slides out',
    shows: 'A pinch harmonic with wide vibrato, and notes slid out down and up',
    text: [
      '\\title "Pinch harmonics, wide vibrato, slides out"',
      '\\ts (4 4)',
      '3.3{vw ph}.2 5.2{sod}.4 r.4 | 7.3{sou}.4 r.4 12.1{vw}.2 |',
    ].join('\n') + '\n',
  },
  {
    id: 'strumming',
    title: 'Strummed chords',
    shows: 'Chords with down and up strokes, a chord let ring with ties',
    text: [
      '\\title "Strummed chords"',
      '\\ts (4 4)',
      '(0.1 1.2 0.3 2.4 3.5).4{sd} (0.1 1.2 0.3 2.4 3.5).8{sd}',
      '  (0.1 1.2 0.3 2.4 3.5).8{su} r.8 (0.1 1.2 0.3 2.4 3.5).8{su}',
      '  (0.1 1.2 0.3 2.4 3.5).4{sd} |',
      '(0.1 1.2 2.3 2.4 0.5).2{sd} (-.1 -.2 -.3 -.4 -.5).2 |',
    ].join('\n') + '\n',
  },
  {
    id: 'song-form',
    title: 'Sections, tempo and chord names',
    shows: 'Chord names over the strums, a capo, sections, a change of tempo and text over a beat',
    text: [
      '\\title "Sections, tempo and chord names"',
      '\\ts (4 4)',
      '\\capo 2',
      '\\section "Verse" \\tempo 92 (0.1 1.2 0.3 2.4 3.5).2{ch "C" sd}',
      '  (0.1 1.2 2.3 2.4 0.5).2{ch "Am" sd} |',
      '(1.1 1.2 2.3 3.4 3.5 1.6).2{ch "F" sd} (3.1 0.2 0.3 0.4 2.5 3.6).2{ch "G" sd} |',
      '\\section ("A" "Chorus") \\tempo (100 "A little faster")',
      '  (1.1 1.2 2.3 3.4 3.5 1.6).4{ch "F" sd} (1.1 1.2 2.3 3.4 3.5 1.6).4{su}',
      '  (3.1 0.2 0.3 0.4 2.5 3.6).4{ch "G" sd} (3.1 0.2 0.3 0.4 2.5 3.6).4{su} |',
      '(0.1 1.2 0.3 2.4 3.5).1{ch "C" txt "slowing, let ring" sd} |',
    ].join('\n') + '\n',
  },
  {
    id: 'repeats',
    title: 'Repeats and endings',
    shows: 'A repeat with first and second endings, and one played three times',
    text: [
      '\\title "Repeats and endings"',
      '\\ts (4 4)',
      '\\ro 0.6.8 0.6.8 3.6.8 0.6.8 2.5.4 0.5.4 | \\ae 1 \\rc 2 3.6.2 5.6.2 |',
      '\\ae 2 (0.1 0.2 1.3 2.4 2.5 0.6).1 | \\ro \\rc 3 2.4.4 4.4.4 5.4.4 4.4.4 |',
    ].join('\n') + '\n',
  },
  {
    id: 'compound-time',
    title: 'Six-eight time',
    shows: 'Compound time: eighths beamed in threes',
    text: [
      '\\title "Six-eight time"',
      '\\ts (6 8)',
      '0.6.8 2.4.8 2.3.8 0.5.8 2.4.8 2.3.8 | 3.6.4{d} 2.5.4{d} |',
    ].join('\n') + '\n',
  },
  {
    id: 'time-changes',
    title: 'Changing time',
    shows: 'A new time signature at the start of a bar: 4/4, then 3/4, 7/8 and back to 4/4',
    text: [
      '\\title "Changing time"',
      '\\ts (4 4)',
      '0.6.4 3.6.4 5.6.4 3.6.4 | \\ts (3 4) 0.5.4 2.5.4 3.5.4 |',
      '\\ts (7 8) 0.4.8 2.4.8 3.4.8 0.4.8 2.4.8 0.4.8 2.4.8 | \\ts (4 4) 0.6.1 |',
    ].join('\n') + '\n',
  },
  {
    id: 'drop-d',
    title: 'Drop D',
    shows: 'A tuning other than standard, its string names left of the lines',
    text: [
      '\\title "Drop D"',
      '\\ts (4 4)',
      '\\tuning (E4 B3 G3 D3 A2 D2)',
      '(0.4 0.5 0.6).8 (0.4 0.5 0.6).8 (3.4 3.5 3.6).8 (0.4 0.5 0.6).8 (5.4 5.5 5.6).4',
      '  (3.4 3.5 3.6).4 |',
    ].join('\n') + '\n',
  },
];

export function exampleById(id: string): TabExample | undefined {
  return TAB_EXAMPLES.find(e => e.id === id);
}
