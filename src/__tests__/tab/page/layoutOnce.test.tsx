import { vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { layoutClip } from '@/features/tab/layout';
import { readAscii } from '@/features/tab/ascii';
import { setUpPage, RIFF, renderAt, keepOpen } from './helpers';

// Counts the clip's layouts: the page works it out once and hands it to all that draws over the tab, and
// the Export dialog lays it out only while open.
vi.mock('@/features/tab/layout', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/tab/layout')>();
  return { ...actual, layoutClip: vi.fn(actual.layoutClip) };
});

setUpPage();

describe('TabPage lays the clip out once (issue #302)', () => {
  it('lays the clip out again only when it, the width or the parts change, not each time the page draws', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    const layouts = vi.mocked(layoutClip);
    layouts.mockClear();
    // Opening Settings draws the page again, with the same clip: no new layout, and the tab isn't drawn again.
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(layouts).not.toHaveBeenCalled();
    // Staff | Tab | Both changes what is laid out: once more, for the drawing and all over it.
    fireEvent.click(screen.getByRole('button', { name: 'Both' }));
    expect(layouts).toHaveBeenCalledTimes(1);
  });
});
