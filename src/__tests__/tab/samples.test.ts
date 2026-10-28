import { samplesFrom } from '@/features/tab/samples';

describe('samplesFrom', () => {
  it('titles each sample by its \\title, its ASCII Title: line, else its file name', () => {
    expect(samplesFrom([
      { file: 'riff.atex', text: '\\title "Opening riff"\n5.6.4 |\n' },
      { file: 'ascii.txt', text: 'Title: Strum\ne|-0-|\nB|-1-|\nG|-0-|\nD|-2-|\nA|-3-|\nE|---|\n' },
      { file: 'bare.atex', text: '5.6.4 |\n' },
    ])).toEqual([
      { id: 'sample-riff', title: 'Opening riff', shows: 'riff.atex', text: '\\title "Opening riff"\n5.6.4 |\n' },
      { id: 'sample-ascii', title: 'Strum', shows: 'ascii.txt', text: expect.any(String) },
      { id: 'sample-bare', title: 'bare', shows: 'bare.atex', text: '5.6.4 |\n' },
    ]);
  });
});
