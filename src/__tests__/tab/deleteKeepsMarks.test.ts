/**
 * Delete keeps the marks of a Column's time (issue #393): the rest left where notes were deleted keeps
 * the text, chord name, fermata, wah, hairpin, octave line and kept alphaTex; the notes' own marks go.
 * Only taking the time away (Ctrl/⌘+Delete) removes them.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { partOf, type Part } from '@/features/tab/clip';
import { clearNote, deleteColumns, type Cursor } from '@/features/tab/editing';
import { clearToRests } from '@/features/tab/noteEdits';
import { deleteAtLine } from '@/features/tab/editorKeys';
import { rewrite } from '@/features/tab/rewrite';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}
const bars = (clip: Part) => writeBars(clip).join('\n');
const at = (bar: number, column: number, string = 0): Cursor => ({ bar, column, string });
/** An edit as the page makes it: the edit, then the bars whose rhythm changed written by the meter. */
const edited = (before: Part, edit: (clip: Part) => Part) => rewrite(before, edit(before));
const deleted = (clip: Part, from: number, to: number) => edited(clip, c => clearToRests(c, { anchor: from, focus: to }).clip);

const marked = '\\ts (4 4)\n3.6.4 5.6.4{txt "slowly" ch "Am"} 7.6.4 8.6.4 |';

describe('Delete keeps the marks of the time it leaves as rests (issue #393)', () => {
  it('one picked note keeps its column\'s text and chord name on the rest', () => {
    expect(bars(edited(clipOf(marked), c => clearNote(c, at(0, 1, 5))))).toBe('3.6.4 r.4{ch "Am" txt "slowly"} 7.6.4 8.6.4 |');
  });

  it('a selection over the column, or the column picked by itself, keeps them', () => {
    expect(bars(deleted(clipOf(marked), 1, 1))).toBe('3.6.4 r.4{ch "Am" txt "slowly"} 7.6.4 8.6.4 |');
    expect(bars(deleted(clipOf(marked), 1, 2))).toBe('3.6.4 r.4{ch "Am" txt "slowly"} r.4 8.6.4 |');
  });

  it('a chord, deleted from an empty string of its column, keeps them', () => {
    const chord = clipOf('\\ts (4 4)\n3.6.4 (5.6 7.5).4{txt "slowly" ch "Am"} 7.6.4 8.6.4 |');
    expect(bars(deleted(chord, 1, 1))).toBe('3.6.4 r.4{ch "Am" txt "slowly"} 7.6.4 8.6.4 |');
  });

  it('a bar emptied whole is the fewest rests but for a marked one, which starts where it did', () => {
    // On beat 2: q rest, the marked q rest, a half rest.
    expect(bars(deleted(clipOf(marked), 0, 3))).toBe('r.4 r.4{ch "Am" txt "slowly"} r.2 |');
    // On beat 1: one Whole-bar rest that carries it.
    expect(bars(deleted(clipOf('\\ts (4 4)\n3.6.4{txt "slowly"} 5.6.4 7.6.2 |'), 0, 2))).toBe('r.1{txt "slowly"} |');
    // On beat 3 of 4/4: a half rest, then the marked half.
    expect(bars(deleted(clipOf('\\ts (4 4)\n3.6.2 5.6.4{txt "slowly"} 7.6.4 |'), 0, 2))).toBe('r.2 r.2{txt "slowly"} |');
    // No marks: the one Whole-bar rest, as before (issue #290).
    expect(bars(deleted(clipOf('\\ts (4 4)\n3.6.4 5.6.4 7.6.2 |'), 0, 2))).toBe('r.1 |');
  });

  it('keeps a fermata, wah, hairpin and octave line too', () => {
    const clip = clipOf('\\ts (4 4)\n3.6.4 5.6.4{fermata (medium 0) waho cre ot 8va} 7.6.2 |');
    const rest = deleted(clip, 1, 1).bars[0].columns[1];
    expect(rest.notes.every(n => n === null)).toBe(true);
    expect(rest).toMatchObject({ wah: 'open', hairpin: 'crescendo', ottava: '8va' });
    expect(rest.fermata).toBeDefined();
  });

  it('the notes\' own marks go with them: no pick stroke or tremolo is left on a rest', () => {
    const clip = clipOf('\\ts (4 4)\n3.6.4 5.6.4{sd tp 16 txt "slowly"} 7.6.2 |');
    for (const after of [deleted(clip, 1, 1), edited(clip, c => clearNote(c, at(0, 1, 5)))]) {
      const rest = after.bars[0].columns[1];
      expect(rest.text).toBe('slowly');
      expect(rest.stroke).toBeUndefined();
      expect(rest.tremolo).toBeUndefined();
    }
  });

  it('Delete off the tab, at the playback line, keeps them', () => {
    const cut = deleteAtLine(clipOf(marked), 2, null);
    expect(bars(rewrite(clipOf(marked), cut!.clip))).toBe('3.6.4 r.4{ch "Am" txt "slowly"} 7.6.4 8.6.4 |');
  });

  it('Ctrl/⌘+Delete, taking the time away, takes them with it', () => {
    const clip = clipOf(marked);
    expect(bars(deleteColumns(clip, [1, 1]).clip)).not.toContain('slowly');
    expect(deleteAtLine(clip, 2, null, true)!.clip.bars[0].columns.some(c => c.text || c.chord)).toBe(false);
  });

  it('a tempo and a section stay with their bar, even emptied whole', () => {
    const clip = clipOf('\\ts (4 4)\n\\tempo (90 "Slowly")\n\\section "Verse"\n3.6.4 5.6.4 7.6.2 |');
    const after = deleted(clip, 0, 2);
    expect(after.bars[0].columns).toHaveLength(1);
    expect(writeBars(after)[0]).toContain('r.1');
    expect(JSON.stringify(after)).toContain('Verse');
    expect(JSON.stringify(after)).toContain('Slowly');
  });
});
