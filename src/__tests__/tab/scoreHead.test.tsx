/**
 * The score's head drawn over the clip, on the page and in the exported image, as a printed score's
 * first page has it. See docs/specs/2026-10-28-tab-score-head-design.md.
 */
import { render } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { DEFAULT_TAB_EXPORT, TabImage, tabImageSize } from '@/features/tab/exportTab';
import { ScoreHead } from '@/features/tab/ScoreHead';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const SONG = clipOf([
  '\\title "Song"', '\\artist "Band"', '\\words "Ann"', '\\music "Ann"',
  '\\tuning (D#4 A#3 F#3 C#3 G#2 D#2)', '0.1.1 |',
].join('\n'));

describe("the score's head", () => {
  it('on the page: the title as the heading, then the artist, credits and tuning', () => {
    const { getByRole, getByTestId, getByLabelText } = render(<ScoreHead clip={SONG} />);
    expect(getByRole('heading', { level: 1 })).toHaveTextContent('Song');
    const head = getByTestId('score-head');
    expect(head).toHaveTextContent("BandWords & Music by Ann");
    expect(getByLabelText('Tuning')).toHaveTextContent('Tune down 1/2 step');
    expect(getByLabelText('string 1').parentElement).toHaveTextContent('1 = E♭');
  });

  it('in the image: the title, artist and credits centred, the tuning on the left with its strings circled', () => {
    const { container } = render(<TabImage clip={SONG} style={DEFAULT_TAB_EXPORT} title="Song" />);
    const head = container.querySelector('[data-testid="score-head-drawn"]')!;
    const centred = [...head.querySelectorAll('text[text-anchor="middle"]')].map(t => t.textContent).filter(t => t!.length > 1);
    expect(centred).toEqual(['Song', 'Band', 'Words & Music by Ann']);
    expect(head.querySelectorAll('circle')).toHaveLength(6);
    expect(head.textContent).toContain('Tune down 1/2 step');
  });

  it('in the image without the name: only the tuning, and less room taken', () => {
    const named = tabImageSize(SONG, DEFAULT_TAB_EXPORT, 'Song').height;
    const style = { ...DEFAULT_TAB_EXPORT, name: false };
    const { container } = render(<TabImage clip={SONG} style={style} title="Song" />);
    const head = container.querySelector('[data-testid="score-head-drawn"]')!;
    expect(head.textContent).not.toContain('Band');
    expect(head.textContent).toContain('Tune down 1/2 step');
    expect(tabImageSize(SONG, style, 'Song').height).toBeLessThan(named);
  });
});
