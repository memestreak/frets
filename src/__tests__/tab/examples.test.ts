/**
 * The Tab page's example clips must read with no warnings and write back
 * exactly as written, so each one is a check of the reader, the writer and
 * the features it shows.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { unevenMessage } from '@/features/tab/clip';
import { exampleById, TAB_EXAMPLES } from '@/features/tab/examples';

describe('the example clips', () => {
  it.each(TAB_EXAMPLES.map(e => [e.id, e] as const))('%s reads with no warnings, every bar full, and writes back as written', (_, example) => {
    const result = readAlphaTexWith(alphaTab, example.text);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.warnings).toEqual([]);
    expect(result.clip.name).toBe(example.title);
    expect(unevenMessage(result.clip)).toBeNull();
    expect(writeAlphaTex(result.clip)).toBe(example.text);
  });

  it('have different ids, safe in a link', () => {
    const ids = TAB_EXAMPLES.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(exampleById('bends')?.title).toBe('Bends and vibrato');
    expect(exampleById('nope')).toBeUndefined();
  });
});
