/**
 * The stand-in host's presets (`mcp/preview/`): a few ready-made arguments for each tool, picked from
 * the Preset list under the Tool list. Each tool's first preset is what its arguments box starts with.
 * `src/__tests__/mcp/previewPresets.test.ts` calls the real server with every one.
 */
import { TOOL_NAME as METRONOME } from '@/features/metronome/mcp/tool';
import { TOOL_NAME as TAB } from '@/features/tab/mcp/tool';
import { TOOL_NAME as TUNER } from '@/features/tuner/mcp/tool';

export interface Preset {
  name: string;
  args: Record<string, unknown>;
  /** The server should refuse it: a preset for seeing what a failed check tells the model. */
  fails?: true;
}

/** A tab note on a string (1 the high e, 6 the low E) and fret. */
const at = (string: number, fret: number, more: Record<string, unknown> = {}) => ({ string, fret, ...more });
/** A column of one duration (4 a quarter, 8 an eighth…) holding `notes`. */
const col = (value: number, notes: object[], more: Record<string, unknown> = {}) => ({ duration: { value }, notes, ...more });

export const PRESETS: Record<string, Preset[]> = {
  [METRONOME]: [
    { name: '7/8 grouped 2+2+3, 92 bpm', args: { bpm: 92, beats: 7, groups: '2+2+3' } },
    { name: 'Shuffle in 4/4, 100 bpm', args: { bpm: 100, beats: 4, swing: 67 } },
    { name: '6/8 grouped 3+3, 60 bpm', args: { bpm: 60, beats: 6, groups: '3+3' } },
    { name: 'Sixteenths in 4/4, 140 bpm', args: { bpm: 140, beats: 4, subdivision: 4 } },
  ],
  [TAB]: [
    {
      name: 'Phrase by pitch, then a bend',
      args: {
        bpm: 90,
        bars: [
          { columns: [8, 8, 8, 8, 8, 8, 4].map((value, i) => col(value, [{ pitch: ['A3', 'C4', 'D4', 'E4', 'G4', 'E4', 'D4'][i] }])) },
          { columns: [col(2, [at(3, 2, { bend: { quarters: 4 } })], { chord: 'Am' }), col(2, [at(5, 0)])] },
        ],
      },
    },
    {
      name: 'Pentatonic run, bars 2–3 looped',
      args: {
        bpm: 100,
        bars: [
          { columns: [[6, 5], [6, 8], [5, 5], [5, 7], [4, 5], [4, 7], [3, 5], [3, 7]].map(([s, f]) => col(8, [at(s, f)])) },
          { columns: [col(8, [at(2, 5)]), col(8, [at(2, 8)]), col(4, [at(1, 5)]), col(2, [at(1, 8, { vibrato: 'slight' })])] },
          {
            columns: [
              col(16, [at(1, 8)]), col(16, [at(1, 5, { legato: 'p' })]), col(16, [at(2, 8)]), col(16, [at(2, 5, { legato: 'p' })]),
              col(16, [at(3, 7)]), col(16, [at(3, 5, { legato: 'p' })]), col(16, [at(4, 7)]), col(16, [at(4, 5, { legato: 'p' })]),
              col(2, [at(5, 7, { vibrato: 'wide' })]),
            ],
          },
        ],
        loop: { start: { bar: 2 }, end: { bar: 3 } },
      },
    },
    {
      name: 'Waltz chords in 3/4, capo 2',
      args: {
        bpm: 84,
        time: [3, 4],
        capo: 2,
        bars: [
          { columns: [col(4, [at(5, 3)], { chord: 'C' }), col(4, [at(4, 2), at(3, 0), at(2, 1)]), col(4, [at(4, 2), at(3, 0), at(2, 1)])] },
          { columns: [col(4, [at(6, 3)], { chord: 'G' }), col(4, [at(4, 0), at(3, 0), at(2, 0)]), col(4, [at(4, 0), at(3, 0), at(2, 0)])] },
          { columns: [col(4, [at(5, 0)], { chord: 'Am' }), col(4, [at(4, 2), at(3, 2), at(2, 1)]), col(4, [at(4, 2), at(3, 2), at(2, 1)])] },
          { columns: [{ duration: { value: 2, dots: 1 }, notes: [at(5, 3), at(4, 2), at(3, 0), at(2, 1), at(1, 0)], chord: 'C' }] },
        ],
      },
    },
    {
      name: 'Melody in 6/8, staff only',
      args: {
        bpm: 72,
        time: [6, 8],
        view: 'staff',
        bars: [
          { columns: ['E3', 'G3', 'B3', 'E4', 'B3', 'G3'].map(pitch => col(8, [{ pitch }])) },
          { columns: [{ duration: { value: 4, dots: 1 }, notes: [{ pitch: 'E4' }] }, ...['D4', 'B3', 'G3'].map(pitch => col(8, [{ pitch }]))] },
          { columns: [{ duration: { value: 2, dots: 1 }, notes: [{ pitch: 'E3' }] }] },
        ],
      },
    },
    {
      name: 'A bar a beat short (fails the check)',
      fails: true,
      args: { bars: [{ columns: [col(4, [at(5, 3)]), col(4, [at(4, 2)]), col(4, [at(3, 0)])] }] },
    },
  ],
  // show_tuner takes no input (standard tuning only, #287), so it has nothing to vary.
  [TUNER]: [{ name: 'Standard tuning', args: {} }],
};
