/** The technique popover's words (issue #501): what each name and short form finds, in the palette's order. */
import { TECHNIQUES, techniquesFor } from '@/features/tab/techniques';

const names = (typed: string) => techniquesFor(typed).map(t => t.name);

describe('techniquesFor', () => {
  it.each([
    ['lr', 'Let ring'], ['lv', 'Let ring'], ['let ring', 'Let ring'], ['LET RING', 'Let ring'],
    ['pm', 'Palm mute'], ['p.m.', 'Palm mute'], ['vib', 'Vibrato'], ['wide vib', 'Wide vibrato'],
    ['ho', 'Hammer-on or pull-off'], ['po', 'Hammer-on or pull-off'], ['bend', 'Bend'], ['pre-bend', 'Pre-bend'],
    ['pb', 'Pre-bend'], ['gliss', 'Slide'], ['o', 'Natural harmonic'], ['ph', 'Pinch harmonic'], ['x', 'Dead note'],
    ['tap', 'Tap'], ['arp', 'Rolled chord down'], ['trem', 'Tremolo picking in sixteenths'], ['trem 32', 'Tremolo picking in thirty-seconds'],
    ['>', 'Accent'], ['marcato', 'Heavy accent'], ['stacc', 'Staccato'],
  ])('puts %s’s technique first: %s', (typed, name) => {
    expect(names(typed)[0]).toBe(name);
  });

  it('finds a technique by any of its words’ starts', () => {
    expect(names('ring')).toEqual(['Let ring']);
    expect(names('harm')).toEqual(['Natural harmonic', 'Pinch harmonic']);
  });

  it('offers every technique for nothing typed, and none for what names nothing', () => {
    expect(techniquesFor('  ')).toBe(TECHNIQUES);
    expect(names('fog machine')).toEqual([]);
  });

  it('gives each technique a name of its own and a palette tool or an edit', () => {
    expect(new Set(TECHNIQUES.map(t => t.name)).size).toBe(TECHNIQUES.length);
    for (const t of TECHNIQUES) expect(!!t.tool !== !!t.edit).toBe(true);
  });
});
