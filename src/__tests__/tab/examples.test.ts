/**
 * The built-in arrangements (but the samples) must read with no warnings and write back exactly as
 * written, so each one is a check of the reader, the writer and the features it shows.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { unevenMessage } from '@/features/tab/clip';
import { builtinsFrom, folderTitle, SAMPLES_FOLDER } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';

const builtins = builtinsFrom(await readBuiltinFiles());
const examples = builtins.filter(b => b.folder !== SAMPLES_FOLDER);

describe('the built-in arrangements', () => {
  it.each(examples.map(e => [`${e.folder}/${e.id}`, e] as const))('%s reads with no warnings, every bar full, and writes back as written', (_, example) => {
    const result = readAlphaTexWith(alphaTab, example.text);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.warnings).toEqual([]);
    expect(result.clip.name).toBe(example.title);
    expect(unevenMessage(result.clip)).toBeNull();
    expect(`${writeAlphaTex(result.clip)}\n`).toBe(example.text);
  });

  it('have different ids, safe in a link', () => {
    const ids = builtins.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(builtins.find(b => b.id === 'bends')).toMatchObject({ folder: 'articulations', title: 'Bends and vibrato' });
    expect(builtins.some(b => b.folder === SAMPLES_FOLDER)).toBe(true);
  });

  it('are titled by their \\title, an ASCII Title: line, else the file name, in folders named for people', () => {
    expect(builtinsFrom([
      { folder: 'a', file: 'riff.atex', text: '\\title "Opening riff"\n5.6.4 |\n' },
      { folder: 'a', file: 'ascii.txt', text: 'Title: Strum\ne|-0-|\n' },
      { folder: 'a', file: 'bare.atex', text: '5.6.4 |\n' },
    ]).map(b => [b.id, b.title])).toEqual([['riff', 'Opening riff'], ['ascii', 'Strum'], ['bare', 'bare']]);
    expect(folderTitle('song_structure')).toBe('Song structure');
    expect(folderTitle('samples')).toBe('Samples');
  });
});
