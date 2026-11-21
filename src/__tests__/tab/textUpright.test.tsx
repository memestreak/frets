/**
 * Text annotations are drawn upright, not in italics (Jeremy, 2026-11-21;
 * docs/specs/2026-10-26-tab-words-design.md). The image export draws the same TabClip.
 */
import * as alphaTab from '@coderline/alphatab';
import { render } from '@testing-library/react';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { TabClip } from '@/features/tab/TabClip';

const clipOf = (tex: string): Part => {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
};

describe('text annotations', () => {
  it('are drawn upright: no italic on the text, its lines or its bold runs', () => {
    const clip = clipOf('\\ts (4 4)\n0.6.4{txt "let ring"} 2.5.4{txt "slowing, **louder**\\nthen fade"} 3.4.4{ch "Am" txt "rit."} 0.3.4 |');
    const { container } = render(<TabClip clip={clip} width={800} title="t" chordDiagrams />);
    const texts = [...container.querySelectorAll('[data-testid="beat-text"]')];
    expect(texts).toHaveLength(3);
    for (const text of texts) {
      for (const node of [text, ...text.querySelectorAll('tspan')]) {
        expect(node.getAttribute('font-style')).toBeNull();
      }
    }
  });
});
