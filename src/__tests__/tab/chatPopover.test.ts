import { WHOLE, aboutBars, aboutThing, noteWords, pickedWords, scopedPrompt } from '@/features/tab/chat/about';
import { describeArrangement } from '@/features/tab/chat/arrangementTools';
import { readAscii } from '@/features/tab/ascii';
import type { Clip } from '@/features/tab/clip';

// `docs/specs/2026-11-15-tab-chat-popover-design.md` (issue #488).
describe('what the Chat popover’s prompt is about', () => {
  it('names one bar, several bars, or the whole arrangement', () => {
    expect(aboutBars([4, 4]).label).toBe('Bar 5');
    expect(aboutBars([2, 3]).label).toBe('Bars 3–4');
    expect(WHOLE.label).toBe('Whole arrangement');
  });

  it('puts what it is about before the prompt, and nothing for the whole arrangement', () => {
    expect(scopedPrompt('Add fingering', aboutBars([4, 4]))).toBe('About the selected bar 5: Add fingering');
    expect(scopedPrompt('Add fingering', aboutBars([2, 3]))).toBe('About the selected bars 3 to 4: Add fingering');
    expect(scopedPrompt('Add fingering', WHOLE)).toBe('Add fingering');
  });

  it('names a picked mark or the cursor’s note, short in the chip and whole in the prompt', () => {
    const mark = aboutThing(pickedWords({ kind: 'mark', mark: 'palmMute', index: 0, string: 0 }, 1));
    expect(mark.label).toBe('Palm mute mark in bar 2');
    expect(scopedPrompt('Why here?', mark)).toBe('About the palm mute mark in bar 2: Why here?');
    const note = aboutThing(noteWords(7, 2, 1, 0));
    expect(note.label).toBe('Note at fret 7 on string 3 in bar 2');
    expect(note.words).toBe('the note at fret 7 on string 3 (counted from the highest) in bar 2, its column 1');
    expect(noteWords(null, 5, 0, 3)).toBe('the dead note (x) on string 6 (counted from the highest) in bar 1, its column 4');
  });
});

describe('what is picked, in words', () => {
  it('names a word, a bar line and a mark, with its bar', () => {
    expect(pickedWords({ kind: 'chord', index: 0 }, 0)).toBe('the chord name in bar 1');
    expect(pickedWords({ kind: 'repeatEnd', bar: 3 }, 3)).toBe('the repeat end in bar 4');
    expect(pickedWords({ kind: 'mark', mark: 'letRing', index: 2, string: 0 } as never, 1)).toBe('the let ring mark in bar 2');
  });

  it('goes with the arrangement the model reads', () => {
    const { clip } = readAscii('e|--0--|\nB|-----|\nG|-----|\nD|-----|\nA|-----|\nE|-----|') as { clip: Clip };
    const said = describeArrangement(clip, { track: 0, cursorBar: 0, selectedBars: null, picked: 'the chord name in bar 1' });
    expect(said).toContain('Picked: the chord name in bar 1 of track 1.');
    expect(describeArrangement(clip, { track: 0, cursorBar: 0, selectedBars: null })).not.toContain('Picked:');
  });
});
